import { z } from "zod";
import { BaseScriptTemplate } from "./base";
import { ScriptGenerationContext, TemplateManifest } from "../types";
import { getScenePlan } from '../utils/scene-math';
import { VIDEO_NARRATION_WPS } from '../constants';
import { createYouTubeShortsSchema, YOUTUBE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';
import { skillRegistry, SkillContext } from '../skills';

function buildSkillContext(context: ScriptGenerationContext, plan: ReturnType<typeof getScenePlan>): SkillContext {
  const languageName = getLanguageName(context.language || 'en');
  return {
    prompt: context.prompt,
    duration: context.duration,
    language: context.language || 'en',
    languageName,
    mediaType: context.mediaType || 'image',
    scenePlan: plan,
    hasCharacterImages: !!(context.characterReferenceImages && context.characterReferenceImages.length > 0),
    characterReferenceImages: context.characterReferenceImages,
    flags: {},
    intent: context.intent,
    stylePrompt: context.stylePrompt,
  };
}

function getLanguageName(code: string): string {
  const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
  try {
    return displayNames.of(code) || code;
  } catch (e) {
    return code;
  }
}

export class FacelessVideoTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.FACELESS_VIDEO,
    name: "Faceless Video",
    version: "2.0.0",
    description:
      "Cinematic fast-paced storytelling. ~3s per scene, flowing narration with rapid visual cuts.",
    tags: ["faceless", "shorts", "viral", "cinematic", "fast-paced"],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    if (context?.duration) {
      const plan = getScenePlan(context.duration, context.mediaType || "image");
      return createYouTubeShortsSchema({
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
    const { duration, language = "en", mediaType = "image" } = context;
    const languageName = getLanguageName(language);
    const plan = getScenePlan(duration, mediaType);
    const skillCtx = buildSkillContext(context, plan);

    const videoDurationBlock = mediaType === "video"
      ? `
══════════════════════════════════════════════════════════════
    ⚠️ ADJUST YOUR RESPONSE TO MATCH USER REQUEST ⚠️
══════════════════════════════════════════════════════════════
The user requested exactly ${duration} seconds. Always adjust your script so the SUM of all scene durations equals ${duration}s (range ${plan.tolerance.min}–${plan.tolerance.max}s). Never exceed ${plan.tolerance.max}s — if your draft is too long, use fewer scenes or more 5s and fewer 10s until total = ${duration}s.

• duration 5  → narration MUST be ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. Count and fix before output.
• duration 10 → narration MUST be ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Count and fix before output.
══════════════════════════════════════════════════════════════
`
      : "";

    return `You are an elite YouTube Shorts scriptwriter. You create cinematic, scene-by-scene scripts for AI video generation that grip viewers from first second to last.
${videoDurationBlock}══════════════════════════════════════════════════════════════
    ⚠️⚠️⚠️ READ THIS FIRST — MANDATORY SCENE COUNT ⚠️⚠️⚠️
══════════════════════════════════════════════════════════════
VIDEO DURATION: ${duration} seconds
YOU MUST CREATE: AT LEAST ${plan.minScenes} scenes (target: ${plan.targetScenes})${mediaType === "video" ? `, total duration SUM = ${duration}s` : ""}
TOTAL WORDS REQUIRED: ~${plan.totalWordsTarget} (range: ${plan.totalWordsMin}–${plan.totalWordsMax})

${plan.sceneGuidance}

LANGUAGE REQUIREMENT:
- All narration and details: ${languageName} (${language})
- imagePrompt: ALWAYS in English

TITLE: Short, punchy, 4–8 words max.

══════════════════════════════════════════════════════════════
                HOW THIS WORKS
══════════════════════════════════════════════════════════════
Your narration → converted to speech (TTS) → audio length = scene duration.
~2.5 words per second. So ~8 words ≈ 3 seconds of audio.

Each scene = ONE image/video on screen.
You control pacing by controlling narration length per scene.

PER-SCENE RULES:
• Target: ~${plan.perSceneWordsTarget} words per scene (~${plan.perSceneDurationTarget}s)
• Hard max: ${plan.perSceneWordsMax} words (${plan.perSceneDurationMax}s). NEVER exceed this.
• If a thought needs more → SPLIT into two scenes with two visuals.
${mediaType === "video"
    ? `
• DURATION: Each scene must be exactly 5 or exactly 10 seconds (no other values).
• NARRATION LENGTH: 5s scene → at most ${VIDEO_NARRATION_WPS.maxWords5s} words (${VIDEO_NARRATION_WPS.wps5s} wps; never exceed or audio exceeds 5s). 10s scene → at most ${VIDEO_NARRATION_WPS.maxWords10s} words (${VIDEO_NARRATION_WPS.wps10s} wps; never exceed or audio exceeds 10s).`
    : ""
}

${skillRegistry.compose(['advertiser-friendly-filter'], skillCtx)}

${skillRegistry.compose(['retention-hooks'], skillCtx)}

${skillRegistry.compose(['style-vocabulary'], skillCtx)}

${skillRegistry.compose(['cinematic-storytelling'], { ...skillCtx, flags: { storyStyle: 'fast-paced' } })}

${skillRegistry.compose(['narration-rules'], skillCtx)}

${skillRegistry.compose(['camera-framing'], skillCtx)}

${skillRegistry.compose(['image-prompt-quality'], skillCtx)}

${skillRegistry.compose(['video-prompt-quality'], skillCtx)}

${skillRegistry.compose(['quality-validation'], { ...skillCtx, flags: { validationVariant: 'faceless-video' } })}`;
  }
}
