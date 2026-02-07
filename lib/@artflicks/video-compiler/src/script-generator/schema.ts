import { z } from "zod";

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
}

// ═══════════════════════════════════════════════════════════════
// SCENE OBJECT SCHEMAS (shared shape, reusable)
// ═══════════════════════════════════════════════════════════════

const youtubeShortsSceneSchema = z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    duration: z.number().describe('Estimated duration of this scene in seconds, derived from narration word count. TTS audio determines actual playback duration.'),
    details: z.string().describe('A brief, readable description of what happens in this scene. Write 2-3 sentences describing the action, setting, and key moment.'),
    narration: z.string().describe('Engaging voiceover narration for this scene. Write naturally — the narration length DETERMINES the scene duration via text-to-speech. Fill the scene fully. No dead air.'),
    imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English. Include: dramatic lighting, vivid colors, emotional expressions, dynamic composition, atmospheric elements. Scene 1 must be the MOST visually striking.'),
    cameraAngle: z.string().nullable().describe('Camera angle or shot type (e.g., close-up, wide shot, birds eye view)'),
    mood: z.string().nullable().describe('Emotional tone or atmosphere of the scene')
});

const characterStorySceneSchema = z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    duration: z.number().describe('Estimated scene duration in seconds, derived from narration word count. TTS audio determines actual playback duration.'),
    details: z.string().describe('Internal production note about the scene (not shown to viewer).'),
    narration: z.string().describe('Voiceover narration. Write naturally — narration length DETERMINES scene duration via TTS. Emotionally engaging, character-focused.'),
    imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description. The main character MUST be the focal point. Describe: character action/pose, emotional expression, environment, lighting, camera angle.'),
    cameraAngle: z.enum(['close-up', 'medium shot', 'wide shot', 'birds-eye', 'low angle', 'over-the-shoulder']).describe('Camera angle for this scene'),
    mood: z.enum(['tense', 'hopeful', 'melancholic', 'triumphant', 'mysterious', 'peaceful', 'dramatic', 'romantic']).describe('Emotional tone of the scene')
});

// ═══════════════════════════════════════════════════════════════
// HELPER — count total narration words across all scenes
// ═══════════════════════════════════════════════════════════════

function countTotalNarrationWords(scenes: { narration: string }[]): number {
    return scenes.reduce(
        (sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length,
        0
    );
}

// ═══════════════════════════════════════════════════════════════
// DYNAMIC SCHEMA FACTORIES
//
// Two layers of Zod enforcement:
//   1. .min(minScenes) — rejects if too few scenes
//   2. .refine(totalWordsMin) — rejects if narration is too short
//
// If the LLM under-generates, Zod catches it at parse time.
// ═══════════════════════════════════════════════════════════════

export function createYouTubeShortsSchema(constraints: SchemaConstraints) {
    const { minScenes, totalWordsMin, durationSeconds } = constraints;

    return z.object({
        title: z.string().describe('Short, punchy title (3-6 words MAX). Catchy, intriguing, or hook-driven.'),
        totalDuration: z.number().describe('Estimated total duration in seconds (sum of all scene durations)'),
        scenes: z.array(youtubeShortsSceneSchema)
            .min(minScenes, `Must have at least ${minScenes} scenes to fill ${durationSeconds}s`)
            .describe(`Array of scenes. MINIMUM ${minScenes} scenes required, with at least ${totalWordsMin} total narration words.`)
    }).refine(
        (data) => countTotalNarrationWords(data.scenes) >= totalWordsMin,
        {
            message: `Total narration must be at least ${totalWordsMin} words to fill ${durationSeconds}s of video. The generated narration is too short.`,
            path: ['scenes'],
        }
    );
}

export function createCharacterStorySchema(constraints: SchemaConstraints) {
    const { minScenes, totalWordsMin, durationSeconds } = constraints;

    return z.object({
        title: z.string().describe('Compelling story title (4-8 words). Should hint at the character journey.'),
        totalDuration: z.number().describe('Estimated total duration in seconds (sum of all scene durations)'),
        scenes: z.array(characterStorySceneSchema)
            .min(minScenes, `Must have at least ${minScenes} scenes to fill ${durationSeconds}s`)
            .describe(`Array of scenes. MINIMUM ${minScenes} scenes required, with at least ${totalWordsMin} total narration words.`)
    }).refine(
        (data) => countTotalNarrationWords(data.scenes) >= totalWordsMin,
        {
            message: `Total narration must be at least ${totalWordsMin} words to fill ${durationSeconds}s of video. The generated narration is too short.`,
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
