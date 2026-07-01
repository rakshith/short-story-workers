import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { createBodyScienceShortsSchema, BODY_SCIENCE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';
import { skillRegistry, SkillContext } from '../skills';

function buildSkillContext(context: ScriptGenerationContext): SkillContext {
  const languageName = getLanguageName(context.language || 'en');
  const effectiveReferences =
    context.characterReferenceImages && context.characterReferenceImages.length > 0
      ? context.characterReferenceImages
      : [];
  return {
    prompt: context.prompt,
    duration: context.duration,
    language: context.language || 'en',
    languageName,
    mediaType: context.mediaType || 'image',
    scenePlan: { durationSeconds: context.duration } as any,
    hasCharacterImages: effectiveReferences.length > 0,
    characterReferenceImages: effectiveReferences,
    flags: {},
    intent: context.intent,
  };
}

function getLanguageName(code: string): string {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
  try {
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

export class BodyScienceShortsTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.BODY_SCIENCE_SHORTS,
        name: 'Body Science Shorts',
        version: '2.0.0',
        description:
            'Viral short-form psychological science storyteller with a visually consistent 3D uncanny skeleton character ' +
            'explaining the internal biological journey.',
        tags: ['skeleton', 'science', 'health', 'body', 'organs', 'explainer', 'educational', 'anatomy', '3d', 'viral', 'shorts'],
    };

    getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
        const BASE_SCENE_SECONDS = 6;
        const duration = context?.duration ?? 60;
        const speed = context?.speed ?? 1.0;
        const avgSceneSeconds = BASE_SCENE_SECONDS / speed;
        const targetScenes = Math.max(2, Math.round(duration / avgSceneSeconds));
        const minScenes = Math.max(2, targetScenes - 1);
        const maxScenes = targetScenes + 1;
        if (context) {
            return createBodyScienceShortsSchema({ minScenes, maxScenes });
        }
        return BODY_SCIENCE_SHORTS_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const { language = 'en' } = context;
        const languageName = getLanguageName(language);
        const topic = context.prompt;
        const BASE_SCENE_SECONDS = 6;
        const duration = context.duration ?? 60;
        const speed = context.speed ?? 1.0;
        const avgSceneSeconds = BASE_SCENE_SECONDS / speed;
        const targetScenes = Math.max(2, Math.round(duration / avgSceneSeconds));
        const skillCtx = buildSkillContext(context);

        return `You are a viral short-form psychological science storyteller
and cinematic AI visual director.

Your task is to generate a high-retention educational short
featuring a visually consistent 3D uncanny skeleton character
explaining the internal biological journey of the topic below.

─────────────────────
TOPIC: "${topic}"
─────────────────────

TARGET VIDEO DURATION: ${duration}s → generate EXACTLY ${targetScenes} scenes.
Each scene narration ≈ 6s of speech. Total scenes × 6s must not exceed ${duration}s.
─────────────────────

LANGUAGE REQUIREMENT:
- All narration: ${languageName} (${language})
- imagePrompt and videoPrompt: ALWAYS in English

${skillRegistry.compose(['language-handling'], skillCtx)}

${skillRegistry.compose(['character-dna'], { ...skillCtx, flags: { characterType: 'body-science-skeleton' } })}

═══════════════════════════════════════════════════════════════
CORE RULES
═══════════════════════════════════════════════════════════════

1. Each narration line must be EXACTLY 10–12 words. Hard floor: NEVER fewer than 10 words. Hard cap: NEVER exceed 12 words.
2. One narration line per visual scene.
3. Second-person perspective only ("you").
4. No complex sentences. No subordinate clauses.

NARRATION TIMING RULE:
- MINIMUM 10 words, MAXIMUM 12 words — no exceptions in either direction
- Lines must be complete, meaningful thoughts — never fragments
- Target lines speakable in under 7 seconds at normal TTS pace
- This ensures every narration line fits cleanly inside a single 8s video clip
5. After EACH narration line provide:
   - One Detailed Text-to-Image Prompt (imagePrompt)
   - One Detailed Image-to-Video Prompt (videoPrompt)
6. Do NOT combine multiple narration lines in one scene.
7. If explanation requires more steps, add more micro-scenes.
8. ALL internal organs must follow the Anatomical Accuracy Lock below.
9. Do NOT explain anything outside the required format.
10. ABSOLUTELY NO TEXT, NO TYPOGRAPHY, NO LETTERS inside images.
11. Provide a "fullNarration" field with all narration lines joined.

${skillRegistry.compose(['biological-visualization'], { ...skillCtx, flags: { bioVariant: 'body-science' } })}

${skillRegistry.compose(['image-prompt-quality'], { ...skillCtx, flags: { imagePromptVariant: 'body-science' } })}

${skillRegistry.compose(['camera-framing'], { ...skillCtx, flags: { cameraVariant: 'body-science' } })}

═══════════════════════════════════════════════════════════════
STRUCTURE TO FOLLOW
═══════════════════════════════════════════════════════════════

SCENE 1 — CONSUMPTION

Narration must start exactly:
"If you [topic without 'what if']…"

imagePrompt:
- Follow ALL locked visual rules
- Skeleton holding and consuming relevant prop
- Extreme or medium close-up
- Solid teal background only
- No text anywhere
- Emotion shown through eyes only

videoPrompt:
- Slow cinematic push-in
- Subtle jaw movement
- Slight head tilt
- Eye emotion shift
- Lighting reflections on glassy skin
- Maintain solid teal background
- No text appears at any time

${skillRegistry.compose(['crew-system'], { ...skillCtx, flags: { crewVariant: 'body-science' } })}

${skillRegistry.compose(['video-prompt-quality'], { ...skillCtx, flags: { videoPromptVariant: 'body-science' } })}

${skillRegistry.compose(['quality-validation'], { ...skillCtx, flags: { validationVariant: 'body-science' } })}

Now generate the complete micro-scene sequence for:
"${topic}"`
    }
}
