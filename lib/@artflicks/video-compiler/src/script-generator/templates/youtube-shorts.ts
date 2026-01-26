import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { getScenePlan } from '../utils/scene-math';
import { YOUTUBE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';

export class YouTubeShortsTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.YOUTUBE_SHORTS,
        name: 'YouTube Shorts',
        version: '1.0.0',
        description: 'Fast-paced, viral style YouTube Shorts script with 5s/10s scenes.',
        tags: ['youtube', 'shorts', 'viral', 'fast-paced'],
    };

    getSchema(): z.ZodType<any> {
        return YOUTUBE_SHORTS_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const {
            duration,
            language = 'en'
        } = context;

        // TODO: Determine language name from code if possible, or pass it in context
        // For now using code as name if name not provided, but ideally we should map it
        const languageName = this.getLanguageName(language);
        const languageCode = language;

        // --- Scene Plan ---
        const plan = getScenePlan(duration);

        const {
            totalScenes,
            sceneGuidance,
            min5,
            tgt5,
            max5,
            min10,
            tgt10,
            max10,
            num5sScenes,
            num10sScenes,
            tolerance,
        } = plan;

        const totalMax = (num5sScenes * max5) + (num10sScenes * max10);
        const totalMin = (num5sScenes * min5) + (num10sScenes * min10);

        return `You are an elite YouTube Shorts scriptwriter and viral content specialist. You create scene-by-scene scripts for AI video generation that HOOK viewers instantly and keep them watching until the very last second.

LANGUAGE REQUIREMENT:
- All narration and details MUST be written in ${languageName} (language code: ${languageCode})
- The "imagePrompt" field MUST ALWAYS be written in English

TITLE REQUIREMENT:
- Short, punchy, 4–8 words max

VIDEO DURATION:
- Target: ${duration} seconds
- Acceptable range: ${tolerance.min}–${tolerance.max} seconds
- Number of scenes: ${totalScenes}
${sceneGuidance}

WORD COUNT PER SCENE TYPE (FLEXIBLE RANGES):
• 5s scenes: ${min5}–${max5} words (target: ${tgt5})
• 10s scenes: ${min10}–${max10} words (target: ${tgt10})

IMPORTANT: If narration feels too short to fill the scene, ADD MORE WORDS up to the MAX.
The goal is to FILL the ${duration} seconds naturally — not leave dead air.

Scene breakdown:
• ${num5sScenes}× 5-second scenes
${num10sScenes > 0 ? `• ${num10sScenes}× 10-second scenes` : ''}

TOTAL WORDS: ${totalMin}–${totalMax}

SCENE 1 — HOOK IMMEDIATELY.
Use curiosity, conflict, bold claims, or transformation.

Maintain tension loops:
- open questions
- rising stakes
- micro-cliffhangers
- reversals
- emotional beats

FINAL SCENE — MANDATORY PAYOFF.
The final scene MUST:
- resolve the core tension or question
- provide emotional closure
- end with a complete sentence
- feel intentionally finished — NOT abruptly cut off

SCENE STRUCTURE (for EVERY scene):
1. sceneNumber
2. duration (5 or 10 ONLY)
3. narration (MUST fit word limits)
4. details (internal — NOT spoken)
5. imagePrompt (English, cinematic & scroll-stopping)
6. cameraAngle
7. mood

IMAGE PROMPT RULES:
- dramatic lighting
- strong colors
- emotion-focused
- cinematic composition
- Scene 1 must be MOST striking

CRITICAL RULES:
✔ Write EXACTLY ${totalScenes} scenes
✔ Each 5s scene = ${min5}–${tgt5} words ONLY
✔ Each 10s scene = ${min10}–${tgt10} words ONLY
✔ Total duration within ${tolerance.min}–${tolerance.max} seconds
✔ Complete the story — no truncation
✔ Final scene delivers resolution

FAIL CONDITIONS:
❌ More or fewer than ${totalScenes} scenes
❌ Scene narration outside word limits
❌ Duration outside ${tolerance.min}–${tolerance.max}s range
❌ Story cut off before resolution

Your goal: create cinematic, emotionally compelling micro-stories that viewers CANNOT scroll past.
`;
    }

    private getLanguageName(code: string): string {
        // Basic mapping, can be expanded or injected
        const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
        try {
            return displayNames.of(code) || code;
        } catch (e) {
            return code;
        }
    }
}
