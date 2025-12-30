import { z } from "zod";
import { SCENE_WORD_LIMITS } from "../config/narration-styles";

// Build narration description dynamically from config
const wpsDescription = `5s: ${SCENE_WORD_LIMITS.SCENE_5S.min}-${SCENE_WORD_LIMITS.SCENE_5S.max} words, 10s: ${SCENE_WORD_LIMITS.SCENE_10S.min}-${SCENE_WORD_LIMITS.SCENE_10S.max} words`;

// Define scene schema
export const SCRIPT_WRITER_SCENE_SCHEMA = z.object({
    title: z.string().describe('Short, punchy title for YouTube Shorts (3-6 words MAX). Make it catchy, intriguing, or hook-driven. Examples: "The $1M Mistake", "She Had No Idea", "This Changes Everything"'),
    totalDuration: z.number().describe('Total duration in seconds'),
    scenes: z.array(
        z.object({
            sceneNumber: z.number().describe('Scene number in sequence'),
            duration: z.number().describe('Duration of this scene in seconds. CRITICAL: Sum of ALL scene durations must equal totalDuration EXACTLY!'),
            details: z.string().describe('A brief, readable description of what happens in this scene. Write 2-3 sentences describing the action, setting, and key moment - like telling a story to someone.'),
            narration: z.string().describe(`Engaging voiceover narration for this scene. WORD LIMITS: ${wpsDescription}. Fill the scene duration naturally - aim for TARGET words, expand up to MAX if needed to fill time. Write compelling, complete sentences.`),
            // visualDescription: z.string().describe('Detailed visual description for image generation - include setting, characters, mood, lighting, composition, and style'),
            imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English. Include: dramatic lighting (golden hour, cinematic shadows, rim light), vivid high-contrast colors, emotional expressions (intense eyes, dramatic faces), dynamic composition, atmospheric elements (fog, particles, rain, lens flares). Scene 1 must be the MOST visually striking. Avoid flat lighting, static poses, or boring backgrounds. Make viewers STOP scrolling!'),
            cameraAngle: z.string().nullable().describe('Camera angle or shot type (e.g., close-up, wide shot, birds eye view)'),
            mood: z.string().nullable().describe('Emotional tone or atmosphere of the scene')
        })
    ).describe('Array of scenes breaking down the script')
});