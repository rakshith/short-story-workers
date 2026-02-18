import { z } from "zod";
import { VIDEO_NARRATION_WPS } from "./constants";

// ═══════════════════════════════════════════════════════════════
// SCHEMA CONSTRAINTS (passed from templates at runtime)
// ═══════════════════════════════════════════════════════════════

export interface SchemaConstraints {
    /** Minimum number of scenes (Zod .min() on the scenes array) */
    minScenes: number;
    /** Minimum total narration words across ALL scenes (Zod .refine()) */
    totalWordsMin: number;
    /** Target duration in seconds (used in error messages) */
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
    details: z.string().describe('A brief, readable description of what happens in this scene. Write 2-3 sentences describing the action, setting, and key moment.'),
    narration: z.string().describe(narrationDescribe('Engaging voiceover narration for this scene. Write naturally — the narration length DETERMINES the scene duration via text-to-speech. Fill the scene fully. No dead air.', mediaType)),
    imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English. Include: dramatic lighting, vivid colors, emotional expressions, dynamic composition, atmospheric elements. Scene 1 must be the MOST visually striking.'),
    cameraAngle: z.string().nullable().describe('Camera angle or shot type (e.g., close-up, wide shot, birds eye view)'),
    mood: z.string().nullable().describe('Emotional tone or atmosphere of the scene')
});

const createCharacterStorySceneSchema = (mediaType?: 'image' | 'video') => z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    duration: sceneDurationSchema(mediaType),
    details: z.string().describe('Internal production note about the scene (not shown to viewer).'),
    narration: z.string().describe(narrationDescribe('Voiceover narration. Write naturally — narration length DETERMINES scene duration via TTS. Emotionally engaging, character-focused.', mediaType)),
    imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description. The main character MUST be the focal point. Describe: character action/pose, emotional expression, environment, lighting, camera angle.'),
    cameraAngle: z.enum(['close-up', 'medium shot', 'wide shot', 'birds-eye', 'low angle', 'over-the-shoulder']).describe('Camera angle for this scene'),
    mood: z.enum(['tense', 'hopeful', 'melancholic', 'triumphant', 'mysterious', 'peaceful', 'dramatic', 'romantic']).describe('Emotional tone of the scene')
});

// ═══════════════════════════════════════════════════════════════
// HELPERS — word count
// ═══════════════════════════════════════════════════════════════

function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

function countTotalNarrationWords(scenes: { narration: string }[]): number {
    return scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
}

// ═══════════════════════════════════════════════════════════════
// DYNAMIC SCHEMA FACTORIES
//
// Image: .min(minScenes) + total words ≥ totalWordsMin.
// Video: .min(minScenes) only. Word limits are enforced via
//        system prompt + schema field descriptions (not Zod refine).
//        Per spec: "compliance with scene duration SHALL be achieved
//        solely by ensuring the narration text produced by the LLM
//        fits at generation time". No post-generation rejection.
// ═══════════════════════════════════════════════════════════════

export function createYouTubeShortsSchema(constraints: SchemaConstraints) {
    const { minScenes, totalWordsMin, durationSeconds, mediaType } = constraints;

    const base = z.object({
        title: z.string().describe('Short, punchy title (3-6 words MAX). Catchy, intriguing, or hook-driven.'),
        totalDuration: z.number().describe('Estimated total duration in seconds (sum of all scene durations)'),
        scenes: z.array(createYouTubeShortsSceneSchema(mediaType))
            .min(minScenes, `Must have at least ${minScenes} scenes to fill ${durationSeconds}s`)
            .describe(
                mediaType === 'video'
                    ? `Array of scenes. 5s scene: ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. 10s scene: ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Never exceed max or audio exceeds scene duration. Sum of all scene durations must match the user-requested total.`
                    : `Array of scenes. MINIMUM ${minScenes} scenes, at least ${totalWordsMin} total narration words.`
            ),
    });

    if (mediaType === 'video') {
        return base;
    }
    return base.refine(
        (data) => countTotalNarrationWords(data.scenes) >= totalWordsMin,
        {
            message: `Total narration must be at least ${totalWordsMin} words to fill ${durationSeconds}s. The generated narration is too short.`,
            path: ['scenes'],
        }
    );
}

export function createCharacterStorySchema(constraints: SchemaConstraints) {
    const { minScenes, totalWordsMin, durationSeconds, mediaType } = constraints;

    const base = z.object({
        title: z.string().describe('Compelling story title (4-8 words). Should hint at the character journey.'),
        totalDuration: z.number().describe('Estimated total duration in seconds (sum of all scene durations)'),
        scenes: z.array(createCharacterStorySceneSchema(mediaType))
            .min(minScenes, `Must have at least ${minScenes} scenes to fill ${durationSeconds}s`)
            .describe(
                mediaType === 'video'
                    ? `Array of scenes. 5s scene: ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. 10s scene: ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Never exceed max or audio exceeds scene duration. Sum of all scene durations must match the user-requested total.`
                    : `Array of scenes. MINIMUM ${minScenes} scenes, at least ${totalWordsMin} total narration words.`
            ),
    });

    if (mediaType === 'video') {
        return base;
    }
    return base.refine(
        (data) => countTotalNarrationWords(data.scenes) >= totalWordsMin,
        {
            message: `Total narration must be at least ${totalWordsMin} words to fill ${durationSeconds}s. The generated narration is too short.`,
            path: ['scenes'],
        }
    );
}

// ═══════════════════════════════════════════════════════════════
// STATIC SCHEMAS (backward-compatible defaults, no strict enforcement)
// ═══════════════════════════════════════════════════════════════
export const YOUTUBE_SHORTS_SCHEMA = createYouTubeShortsSchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });
export const CHARACTER_STORY_SCHEMA = createCharacterStorySchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });

// Legacy alias
export const SCRIPT_WRITER_SCENE_SCHEMA = YOUTUBE_SHORTS_SCHEMA;
