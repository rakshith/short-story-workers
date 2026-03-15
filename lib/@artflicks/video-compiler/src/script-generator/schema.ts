import { z } from "zod";
import { VIDEO_NARRATION_WPS } from "./constants";

// ═══════════════════════════════════════════════════════════════
// SCHEMA CONSTRAINTS (passed from templates at runtime)
// ═══════════════════════════════════════════════════════════════

export interface SchemaConstraints {
    /** Minimum number of scenes (Zod .min() → JSON Schema minItems) */
    minScenes: number;
    /** Maximum number of scenes (Zod .max() → JSON Schema maxItems) */
    maxScenes?: number;
    /** Minimum total narration words (used in .describe() guidance) */
    totalWordsMin: number;
    /** Maximum total narration words (used in .describe() guidance) */
    totalWordsMax?: number;
    /** Target duration in seconds (used in descriptions) */
    durationSeconds: number;
    /** When 'video', scene duration must be 5 or 10 only */
    mediaType?: 'image' | 'video';
}

// ═══════════════════════════════════════════════════════════════
// SCENE OBJECT SCHEMAS (shared shape, reusable)
// ═══════════════════════════════════════════════════════════════

const sceneDurationSchema = (mediaType?: 'image' | 'video') =>
    mediaType === 'video'
        ? z.union([z.literal(5), z.literal(10)]).describe('Scene duration in seconds. Must be exactly 5 or 10 (standard for video generation).')
        : z.number().describe('Estimated duration of this scene in seconds, derived from narration word count. TTS audio determines actual playback duration.');

const narrationDescribe = (base: string, mediaType?: 'image' | 'video') =>
    mediaType === 'video'
        ? `Word count must match scene duration: duration=5 → ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words; duration=10 → ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Adjust so narration fits the scene. ${base}`
        : base;

const createYouTubeShortsSceneSchema = (mediaType?: 'image' | 'video') => z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    duration: sceneDurationSchema(mediaType),
    narration: z.string().describe(narrationDescribe('Engaging voiceover narration for this scene. Write naturally — the narration length DETERMINES the scene duration via text-to-speech. Fill the scene fully. No dead air.', mediaType)),
    imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English. Include: dramatic lighting, vivid colors, emotional expressions, dynamic composition, atmospheric elements. Scene 1 must be the MOST visually striking.'),
    cameraAngle: z.string().nullable().describe('Camera angle or shot type (e.g., close-up, wide shot, birds eye view)'),
    mood: z.string().nullable().describe('Emotional tone or atmosphere of the scene')
});

const createCharacterStorySceneSchema = (mediaType?: 'image' | 'video') => z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    duration: sceneDurationSchema(mediaType),
    narration: z.string().describe(narrationDescribe('Voiceover narration. Write naturally — narration length DETERMINES scene duration via TTS. Emotionally engaging, character-focused.', mediaType)),
    imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description. The main character MUST be the focal point. Describe: character action/pose, emotional expression, environment, lighting, camera angle.'),
    cameraAngle: z.enum(['close-up', 'medium shot', 'wide shot', 'birds-eye', 'low angle', 'over-the-shoulder']).describe('Camera angle for this scene'),
    mood: z.enum(['tense', 'hopeful', 'melancholic', 'triumphant', 'mysterious', 'peaceful', 'dramatic', 'romantic']).describe('Emotional tone of the scene')
});

// ═══════════════════════════════════════════════════════════════
// DYNAMIC SCHEMA FACTORIES
//
// Duration compliance is achieved through generation-time
// constraints only (minItems/maxItems + descriptions).
// No post-generation .refine() rejection — the script must
// always be generated successfully. The system prompt +
// schema descriptions guide the LLM to the correct range.
// ═══════════════════════════════════════════════════════════════

export function createYouTubeShortsSchema(constraints: SchemaConstraints) {
    const { minScenes, maxScenes, totalWordsMin, totalWordsMax, durationSeconds, mediaType } = constraints;

    let scenesArray = z.array(createYouTubeShortsSceneSchema(mediaType))
        .min(minScenes, `Must have at least ${minScenes} scenes to fill ${durationSeconds}s`);

    if (maxScenes) {
        scenesArray = scenesArray.max(maxScenes, `Must have at most ${maxScenes} scenes for ${durationSeconds}s`);
    }

    const scenesDescription = mediaType === 'video'
        ? `Array of scenes for ${durationSeconds}s video. MUST have ${minScenes}–${maxScenes ?? minScenes} scenes. 5s scene: ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. 10s scene: ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Sum of all scene durations must equal ~${durationSeconds}s. Do NOT exceed ${maxScenes ?? minScenes} scenes.`
        : `Array of scenes for ${durationSeconds}s video. MUST have ${minScenes}–${maxScenes ?? minScenes} scenes and ${totalWordsMin}–${totalWordsMax ?? totalWordsMin} total narration words. Do NOT exceed ${maxScenes ?? minScenes} scenes or ${totalWordsMax ?? totalWordsMin} words — that makes the video too long.`;

    return z.object({
        title: z.string().describe('Short, punchy title (3-6 words MAX). Catchy, intriguing, or hook-driven.'),
        totalDuration: z.number().describe(`Estimated total duration in seconds (sum of all scene durations). Must be close to ${durationSeconds}s.`),
        scenes: scenesArray.describe(scenesDescription),
    });
}

export function createCharacterStorySchema(constraints: SchemaConstraints) {
    const { minScenes, maxScenes, totalWordsMin, totalWordsMax, durationSeconds, mediaType } = constraints;

    let scenesArray = z.array(createCharacterStorySceneSchema(mediaType))
        .min(minScenes, `Must have at least ${minScenes} scenes to fill ${durationSeconds}s`);

    if (maxScenes) {
        scenesArray = scenesArray.max(maxScenes, `Must have at most ${maxScenes} scenes for ${durationSeconds}s`);
    }

    const scenesDescription = mediaType === 'video'
        ? `Array of scenes for ${durationSeconds}s video. MUST have ${minScenes}–${maxScenes ?? minScenes} scenes. 5s scene: ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. 10s scene: ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Sum of all scene durations must equal ~${durationSeconds}s. Do NOT exceed ${maxScenes ?? minScenes} scenes.`
        : `Array of scenes for ${durationSeconds}s video. MUST have ${minScenes}–${maxScenes ?? minScenes} scenes and ${totalWordsMin}–${totalWordsMax ?? totalWordsMin} total narration words. Do NOT exceed ${maxScenes ?? minScenes} scenes or ${totalWordsMax ?? totalWordsMin} words — that makes the video too long.`;

    return z.object({
        title: z.string().describe('Compelling story title (4-8 words). Should hint at the character journey.'),
        totalDuration: z.number().describe(`Estimated total duration in seconds (sum of all scene durations). Must be close to ${durationSeconds}s.`),
        scenes: scenesArray.describe(scenesDescription),
    });
}

// ═══════════════════════════════════════════════════════════════
// STATIC SCHEMAS (backward-compatible defaults, no strict enforcement)
// ═══════════════════════════════════════════════════════════════
export const YOUTUBE_SHORTS_SCHEMA = createYouTubeShortsSchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });
export const CHARACTER_STORY_SCHEMA = createCharacterStorySchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });

// Legacy alias
export const SCRIPT_WRITER_SCENE_SCHEMA = YOUTUBE_SHORTS_SCHEMA;
