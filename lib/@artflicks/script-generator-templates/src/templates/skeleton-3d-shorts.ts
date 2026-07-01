import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { getScenePlan } from '../utils/scene-math';
import { VIDEO_NARRATION_WPS } from '../constants';
import { createCharacterStorySchema, createYouTubeShortsSchema, YOUTUBE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';
import { skillRegistry, SkillContext } from '../skills';

function buildSkillContext(context: ScriptGenerationContext, plan: ReturnType<typeof getScenePlan>): SkillContext {
  const languageName = getLanguageName(context.language || 'en');
  const effectiveReferences = (context.characterReferenceImages && context.characterReferenceImages.length > 0)
    ? context.characterReferenceImages
    : [];
  return {
    prompt: context.prompt,
    duration: context.duration,
    language: context.language || 'en',
    languageName,
    mediaType: context.mediaType || 'image',
    scenePlan: plan,
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
  } catch (e) {
    return code;
  }
}

export class Skeleton3DShortsTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.SKELETON_3D_SHORTS,
        name: 'Skeleton 3D Shorts',
        version: '2.0.0',
        description: '3D X-Ray Skeleton as main character — cinematic narrator voice, high-retention hooks, immersive storytelling.',
        tags: ['skeleton', '3d', 'x-ray', 'shorts', 'cinematic', 'immersive', 'high-retention', 'animation'],
    };

    getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
        if (context?.duration) {
            const plan = getScenePlan(context.duration, context.mediaType || 'image');
            return createCharacterStorySchema({
                minScenes: plan.minScenes,
                maxScenes: plan.maxScenes,
                totalWordsMin: plan.totalWordsMin,
                totalWordsMax: plan.totalWordsMax,
                durationSeconds: plan.durationSeconds,
                mediaType: context.mediaType,
            });
        }
        return YOUTUBE_SHORTS_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const {
            duration,
            language = 'en',
            mediaType = 'image',
        } = context;

        const plan = getScenePlan(duration, mediaType);
        const skillCtx = buildSkillContext(context, plan);

        const videoDurationBlock = mediaType === 'video' ? `⚠️ MANDATORY VIDEO WORD COUNTS — REJECTED IF WRONG
• duration 5 → ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words
• duration 10 → ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words
Count words per scene before output. Outside range = REJECTED.
` : '';

        return `You are an elite cinematic scriptwriter for 3D X-Ray Skeleton Shorts.

${skillRegistry.compose(['advertiser-friendly-filter'], skillCtx)}

Your job: Take the USER PREMISE and create a short, cinematic story featuring a SKELETON as the main character. The story GENRE comes from the user's prompt, but the TONE is ALWAYS cinematic — grounded, immersive, high-stakes, never goofy or comedic.

USER PREMISE: "${context.prompt}"

The user prompt decides WHAT the story is about. YOU decide HOW it sounds — and it ALWAYS sounds like cinema. Write every line as if a film director is reading it aloud in a dark screening room.

${videoDurationBlock}════ SCENE CONSTRAINTS ═══
Duration: ${duration}s | Scenes: ${plan.minScenes}–${plan.maxScenes ?? plan.targetScenes} (target ${plan.targetScenes}) | Words: ${plan.totalWordsMin}–${plan.totalWordsMax}
${plan.sceneGuidance}
Language: narration in ${skillCtx.languageName} (${language}), imagePrompt ALWAYS in English

${skillRegistry.compose(['youtube-metadata'], { ...skillCtx, flags: { youtubeVariant: 'skeleton-3d' } })}

${skillRegistry.compose(['retention-hooks'], skillCtx)}

${skillRegistry.compose(['style-engine'], { ...skillCtx, flags: { styleVariant: 'skeleton-3d' } })}

${skillRegistry.compose(['character-dna'], { ...skillCtx, flags: { characterType: 'skeleton' } })}

${skillRegistry.compose(['image-prompt-quality'], { ...skillCtx, flags: { imagePromptVariant: 'skeleton-3d' } })}

${skillRegistry.compose(['video-prompt-quality'], skillCtx)}

${skillRegistry.compose(['language-handling'], skillCtx)}

${skillRegistry.compose(['camera-framing'], { ...skillCtx, flags: { cameraVariant: 'skeleton-3d' } })}

${skillRegistry.compose(['cinematic-storytelling'], { ...skillCtx, flags: { storyStyle: 'skeleton-narrator' } })}

${skillRegistry.compose(['quality-validation'], { ...skillCtx, flags: { validationVariant: 'skeleton-3d' } })}`;
    }
}
