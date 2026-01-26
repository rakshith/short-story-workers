import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { SCRIPT_WRITER_SCENE_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';

export class CharacterStoryTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.CHARACTER_STORY,
        name: 'Character Centric Story',
        version: '1.0.0',
        description: 'Generates a story with strict character consistency and defined visual style.',
        tags: ['character', 'story', 'consistent', 'cinematic'],
    };

    getSchema(): z.ZodType<any> {
        return SCRIPT_WRITER_SCENE_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const {
            duration,
            characterReference,
            visualPreset = 'cinematic'
        } = context;

        // If no character reference needed, fallback to generic guidance
        const characterGuidance = characterReference
            ? `CRITICAL: You MUST feature the following MAIN CHARACTER in most scenes:
"${characterReference}"
- Always describe this character consistently (hair, clothes, age).
- In imagePrompt, verify the character description matches this reference exactly.`
            : `Create a compelling main character and describe them consistently using physical traits (e.g., "a weathered sailor with a grey beard").`;

        return `You are a professional film director and screenwriter specializing in character-driven storytelling.
        
GOAL: Write a ${duration}-second visual script focusing on a specific character and visual style.

VISUAL STYLE: ${visualPreset.toUpperCase()}
- Apply this style to ALL image prompts.
- Ensure lighting, color palette, and composition match this style.

CHARACTER CONSISTENCY:
${characterGuidance}

STRUCTURE:
1. Scenes must fit total duration: ${duration}s.
2. Mix scene durations (5s or 10s) for pacing.
3. Narrative must be emotionally resonant and focused on the character's journey.

OUTPUT FORMAT:
Return a JSON object with a 'scenes' array. Each scene matches the schema:
- narration: Voiceover story (2-3 sentences).
- imagePrompt: HIGHLY DETAILED description for image generation. MUST include the Visual Style and Character details.
- duration: 5 or 10.
`;
    }
}
