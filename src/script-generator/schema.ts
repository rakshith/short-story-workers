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

const createYouTubeShortsSceneSchema = (mediaType?: 'image' | 'video') => {
    if (mediaType === 'video') {
        return z.object({
            sceneNumber: z.number().describe('Scene number in sequence'),
            duration: sceneDurationSchema(mediaType),
            narration: z.string().describe(narrationDescribe('Engaging voiceover narration for this scene. Write naturally — the narration length DETERMINES the scene duration via text-to-speech. Fill the scene fully. No dead air.', mediaType)),
            imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English. Include: dramatic lighting, vivid colors, emotional expressions, dynamic composition, atmospheric elements. Scene 1 must be the MOST visually striking.'),
            cameraAngle: z.string().nullable().describe('Camera angle or shot type (e.g., close-up, wide shot, tracking shot, slow push-in)'),
            mood: z.string().nullable().describe('Emotional tone or atmosphere of the scene (e.g., tense, mysterious, ominous)'),
            action: z.string().describe('Character action for video animation - what is happening in the scene (e.g., running toward camera, looking around)'),
            videoPrompt: z.string().describe('Detailed image-to-video animation prompt: cinematic motion, camera movement, subject action, secondary motion (particles, wind, light flicker), pace and energy, smooth cinematic motion'),
        });
    }
    
    return z.object({
        sceneNumber: z.number().describe('Scene number in sequence'),
        duration: sceneDurationSchema(mediaType),
        narration: z.string().describe(narrationDescribe('Engaging voiceover narration for this scene. Write naturally — the narration length DETERMINES the scene duration via text-to-speech. Fill the scene fully. No dead air.', mediaType)),
        imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English. Include: dramatic lighting, vivid colors, emotional expressions, dynamic composition, atmospheric elements. Scene 1 must be the MOST visually striking.'),
        cameraAngle: z.string().nullable().describe('Camera angle or shot type (e.g., close-up, wide shot, tracking shot, slow push-in)'),
        mood: z.string().nullable().describe('Emotional tone or atmosphere of the scene (e.g., tense, mysterious, ominous)'),
        action: z.string().describe('Character action for video animation - what is happening in the scene (e.g., running toward camera, looking around)'),
    });
};

const createCharacterStorySceneSchema = (mediaType?: 'image' | 'video') => {
    if (mediaType === 'video') {
        return z.object({
            sceneNumber: z.number().describe('Scene number in sequence'),
            duration: sceneDurationSchema(mediaType),
            narration: z.string().describe(narrationDescribe('Voiceover narration. Write naturally — narration length DETERMINES scene duration via TTS. Emotionally engaging, character-focused.', mediaType)),
            imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description. The main character MUST be the focal point. Describe: character action/pose, emotional expression, environment, lighting, camera angle.'),
            cameraAngle: z.string().describe('Camera angle for this scene (e.g., tracking shot, slow push-in, wide shot)'),
            mood: z.string().describe('Emotional tone of the scene (e.g., tense, mysterious, melancholic)'),
            action: z.string().describe('Character action for video animation - what the character is doing (e.g., running toward camera, looking around)'),
            videoPrompt: z.string().describe('Detailed image-to-video animation prompt: cinematic motion, camera movement, subject action, secondary motion (particles, wind, light flicker), pace and energy, smooth cinematic motion'),
        });
    }
    
    return z.object({
        sceneNumber: z.number().describe('Scene number in sequence'),
        duration: sceneDurationSchema(mediaType),
        narration: z.string().describe(narrationDescribe('Voiceover narration. Write naturally — narration length DETERMINES scene duration via TTS. Emotionally engaging, character-focused.', mediaType)),
        imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description. The main character MUST be the focal point. Describe: character action/pose, emotional expression, environment, lighting, camera angle.'),
        cameraAngle: z.string().describe('Camera angle for this scene (e.g., tracking shot, slow push-in, wide shot)'),
        mood: z.string().describe('Emotional tone of the scene (e.g., tense, mysterious, melancholic)'),
        action: z.string().describe('Character action for video animation - what the character is doing (e.g., running toward camera, looking around)'),
    });
};

// ═══════════════════════════════════════════════════════════════
// METADATA SCHEMA (YouTube SEO + monetization signals)
// ═══════════════════════════════════════════════════════════════

const youtubeMetadataSchema = z.object({
    youtubeTitle: z.string().describe(
        'SEO-optimized YouTube title, 60–70 characters. Include the core concept and setting. Use power words: "Actually", "Nobody Told You", "What Happens When", "The Day". Match the hook format used in Scene 1.'
    ),
    youtubeDescription: z.string().describe(
        'YouTube description. First 150 characters are critical (shown before "show more"). Open with the hook premise as a statement, not a question. Include 2–3 relevant keywords naturally.'
    ),
    hashtags: z.array(z.string()).min(6).max(8).describe(
        '6–8 hashtags. Mix: 2 broad (#Shorts #YouTubeShorts), 2 topic-specific, 2 niche. Do not include the # symbol — it will be added automatically.'
    ),
    thumbnailConcept: z.string().describe(
        'One sentence describing the strongest visual frame for the thumbnail. Format: "[Character action] + [setting detail] + [text overlay suggestion]".'
    ),
    hookFormat: z.enum(['A', 'B', 'C', 'D']).describe(
        'Which hook format was used in Scene 1. A = What if/Imagine if question. B = Day X cold open. C = Nobody told you opener. D = Pure sensory cold open.'
    ),
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
        metadata: youtubeMetadataSchema,
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
        metadata: youtubeMetadataSchema,
    });
}

// ═══════════════════════════════════════════════════════════════
// BODY SCIENCE SHORTS SCHEMA
//
// Separate scene shape: narration (10-12 words), imagePrompt
// (text-to-image), videoPrompt (image-to-video). No per-scene
// duration — that is calculated downstream after generation.
// ═══════════════════════════════════════════════════════════════

const createBodyScienceSceneSchema = () => z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    narration: z.string().describe('STRICT: EXACTLY 10–12 words — minimum 10, maximum 12. Complete meaningful thought. No fragments. Second-person ("you"). Must be speakable in under 7 seconds.'),
    imagePrompt: z.string().describe('Detailed text-to-image prompt following all locked visual rules, anatomical accuracy lock, solid teal background, 9:16 vertical framing. ABSOLUTELY NO TEXT/TYPOGRAPHY/LETTERS in the image.'),
    videoPrompt: z.string().describe('Detailed image-to-video animation prompt: cinematic motion, eye emotion shifts, lighting reflections, no text at any moment. Include narration line with alternating male/female voice consistency (odd scenes male, even scenes female).'),
});

export function createBodyScienceShortsSchema(constraints: { minScenes: number; maxScenes?: number }) {
    return z.object({
        title: z.string().describe('Title starting with "What Happens To Your Body If…" — 8–14 words, ends with question mark. Use EXACT terms from user premise.'),
        scenes: z.array(createBodyScienceSceneSchema())
            .min(constraints.minScenes, `Must have at least ${constraints.minScenes} micro-scenes`)
            .max(constraints.maxScenes ?? 20, `Must have at most ${constraints.maxScenes ?? 20} micro-scenes`),
        fullNarration: z.string().describe('Complete separate narration block — all narration lines joined in order, one per line.'),
        metadata: youtubeMetadataSchema,
    });
}

// ═══════════════════════════════════════════════════════════════
// STATIC SCHEMAS (backward-compatible defaults, no strict enforcement)
// ═══════════════════════════════════════════════════════════════
export const YOUTUBE_SHORTS_SCHEMA = createYouTubeShortsSchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });
export const CHARACTER_STORY_SCHEMA = createCharacterStorySchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });
export const BODY_SCIENCE_SHORTS_SCHEMA = createBodyScienceShortsSchema({ minScenes: 8 });

// Legacy alias
export const SCRIPT_WRITER_SCENE_SCHEMA = YOUTUBE_SHORTS_SCHEMA;


