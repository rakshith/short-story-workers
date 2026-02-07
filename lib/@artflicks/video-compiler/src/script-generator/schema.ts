import { z } from "zod";

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
// DYNAMIC SCHEMA FACTORIES
// These enforce minimum scene count via Zod .min() validation.
// If the LLM generates fewer scenes, Zod will reject the output.
// ═══════════════════════════════════════════════════════════════

export function createYouTubeShortsSchema(minScenes: number) {
    return z.object({
        title: z.string().describe('Short, punchy title (3-6 words MAX). Catchy, intriguing, or hook-driven.'),
        totalDuration: z.number().describe('Estimated total duration in seconds (sum of all scene durations)'),
        scenes: z.array(youtubeShortsSceneSchema)
            .min(minScenes, `Must have at least ${minScenes} scenes to fill the target duration`)
            .describe(`Array of scenes. MINIMUM ${minScenes} scenes required.`)
    });
}

export function createCharacterStorySchema(minScenes: number) {
    return z.object({
        title: z.string().describe('Compelling story title (4-8 words). Should hint at the character journey.'),
        totalDuration: z.number().describe('Estimated total duration in seconds (sum of all scene durations)'),
        scenes: z.array(characterStorySceneSchema)
            .min(minScenes, `Must have at least ${minScenes} scenes to fill the target duration`)
            .describe(`Array of scenes. MINIMUM ${minScenes} scenes required.`)
    });
}

// ═══════════════════════════════════════════════════════════════
// STATIC SCHEMAS (backward-compatible defaults, no min enforced)
// ═══════════════════════════════════════════════════════════════
export const YOUTUBE_SHORTS_SCHEMA = createYouTubeShortsSchema(1);
export const CHARACTER_STORY_SCHEMA = createCharacterStorySchema(1);

// Legacy alias
export const SCRIPT_WRITER_SCENE_SCHEMA = YOUTUBE_SHORTS_SCHEMA;
