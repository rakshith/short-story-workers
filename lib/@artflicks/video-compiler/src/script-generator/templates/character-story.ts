import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { createCharacterStorySchema, CHARACTER_STORY_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';
import { getScenePlan } from '../utils/scene-math';
import { VIDEO_NARRATION_WPS } from '../constants';

export class CharacterStoryTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.CHARACTER_STORY,
    name: 'Character Centric Story',
    version: '4.0.0',
    description: 'Cinematic character story with rapid visual cuts. ~3s per scene, flowing narration.',
    tags: ['character', 'story', 'cinematic', 'fast-paced'],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    if (context?.duration) {
      const plan = getScenePlan(context.duration, context.mediaType || 'image');
      return createCharacterStorySchema({
        minScenes: plan.minScenes,
        totalWordsMin: plan.totalWordsMin,
        durationSeconds: plan.durationSeconds,
        mediaType: context.mediaType,
      });
    }
    return CHARACTER_STORY_SCHEMA;
  }

  getSystemPrompt(context: ScriptGenerationContext): string {
    const {
      duration,
      characterReferenceImages,
      mediaType = 'image'
    } = context;

    const hasCharacterImages = characterReferenceImages && characterReferenceImages.length > 0;
    const plan = getScenePlan(duration, mediaType);

    return `You are a professional film director and screenwriter. You create cinematic, character-driven scripts for AI video generation with rapid visual pacing.
${mediaType === 'video' ? `
═══════════════════════════════════════════════════════════════
    ⚠️ MANDATORY VIDEO WORD COUNTS — OUTPUT REJECTED IF WRONG ⚠️
═══════════════════════════════════════════════════════════════
• duration 5  → narration MUST be ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. Count them. Over ${VIDEO_NARRATION_WPS.maxWords5s} = REJECTED.
• duration 10 → narration MUST be ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Count them. Outside this range = REJECTED.
Before you output, count the words in each scene's narration. If any scene is wrong, fix it.
═══════════════════════════════════════════════════════════════
` : ''}
═══════════════════════════════════════════════════════════════
    ⚠️⚠️⚠️ READ THIS FIRST — MANDATORY SCENE COUNT ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════
VIDEO DURATION: ${duration} seconds
YOU MUST CREATE: AT LEAST ${plan.minScenes} scenes (target: ${plan.targetScenes})
TOTAL WORDS REQUIRED: ~${plan.totalWordsTarget} (range: ${plan.totalWordsMin}–${plan.totalWordsMax})

${plan.sceneGuidance}

═══════════════════════════════════════════════════════════════
                    PIPELINE
═══════════════════════════════════════════════════════════════
1. YOUR OUTPUT: Structured JSON with scenes, narration, image prompts.
2. Each scene's imagePrompt → AI image generator${hasCharacterImages ? ' + character reference images' : ''}.
3. Each scene's narration → TTS audio (audio length = scene duration).
4. Images + audio compiled into final video.

~2.5 words per second. So ~8 words ≈ 3 seconds of audio.

PER-SCENE RULES:
• Target: ~${plan.perSceneWordsTarget} words per scene (~${plan.perSceneDurationTarget}s)
• Hard max: ${plan.perSceneWordsMax} words (${plan.perSceneDurationMax}s). NEVER exceed this.
• If a thought needs more → SPLIT into two scenes with two visuals.
${mediaType === 'video' ? `
• DURATION: Each scene must be exactly 5 or exactly 10 seconds (no other values).
• NARRATION LENGTH: 5s scene → at most ${VIDEO_NARRATION_WPS.maxWords5s} words (${VIDEO_NARRATION_WPS.wps5s} wps; never exceed or audio exceeds 5s). 10s scene → at most ${VIDEO_NARRATION_WPS.maxWords10s} words (${VIDEO_NARRATION_WPS.wps10s} wps; never exceed or audio exceeds 10s).` : ''}

═══════════════════════════════════════════════════════════════
    🎬 THIS IS NOT A SLIDESHOW — IT'S A CINEMATIC STORY
═══════════════════════════════════════════════════════════════
The narration must flow as ONE continuous story. When you read
ALL scenes aloud back-to-back, it should sound like a single
seamless voiceover — like a documentary narrator telling a gripping
character story while the camera keeps cutting to new visuals.

SLIDESHOW (❌ WRONG):
  Scene 1: "The hero was born in a small village."
  Scene 2: "He had a difficult childhood."
  Scene 3: "He found a sword."
  → Disconnected facts. No momentum. Boring.

CINEMATIC (✅ RIGHT):
  Scene 1: "No one expected the boy from the village—"
  Scene 2: "—to become the most feared warrior in the land."
  Scene 3: "But the day he pulled that blade from the stone—"
  Scene 4: "—everything changed."
  → One flowing story. Each cut = new visual. Voice never stops.

KEY PRINCIPLES:
1. All scene narrations read as ONE flowing monologue
2. Scene breaks = VISUAL changes, story never pauses
3. Each scene connects naturally to the next
4. Mid-sentence cuts create momentum
5. Tension builds ACROSS scenes, not within one

═══════════════════════════════════════════════════════════════
                    CHARACTER SYSTEM
═══════════════════════════════════════════════════════════════
${hasCharacterImages
        ? `✅ CHARACTER REFERENCE IMAGES PROVIDED (${characterReferenceImages.length})

The image AI will use these for visual consistency.

imagePrompt RULES:
1. ❌ DO NOT describe physical appearance (face, hair, body, clothes)
2. ✅ DO describe: action/pose, emotion, position, environment interaction
3. ✅ Refer to them as "the main character", "the protagonist", "the figure"
4. ✅ Character MUST appear in EVERY imagePrompt`
        : `⚠️ NO CHARACTER REFERENCE

Define clear physical traits in Scene 1 and repeat EXACTLY in every imagePrompt.
Example: "A young woman with short silver hair and a red scarf, standing in the rain..."`}

═══════════════════════════════════════════════════════════════
                    VISUAL STYLE
═══════════════════════════════════════════════════════════════
- Consistent cinematic style across ALL imagePrompts
- Dramatic lighting, high contrast, atmospheric
- EVERY scene must be visually DISTINCT (change angle, setting, or action)
- The visual must match what's being narrated in that moment

═══════════════════════════════════════════════════════════════
                    NARRATION RULES
═══════════════════════════════════════════════════════════════
${plan.narrationGuidance}

═══════════════════════════════════════════════════════════════
                    STORY ARC
═══════════════════════════════════════════════════════════════
SCENE 1 — HOOK (${plan.perSceneDurationMin}–${plan.perSceneDurationTarget}s)
Character in a compelling moment. Instant intrigue.

MIDDLE — RAPID CINEMATIC BUILD
- One sentence per scene, story flows across cuts
- Character at center of every visual
- Rising stakes, emotional shifts
- Mid-sentence cuts for momentum

FINAL — PAYOFF
- Resolve the character's journey
- Emotional closure, complete sentence

═══════════════════════════════════════════════════════════════
                    OUTPUT FORMAT
═══════════════════════════════════════════════════════════════
{
  "title": "4-8 words",
  "totalDuration": ${duration},
  "scenes": [{
    "sceneNumber": 1,
    "duration": ${mediaType === 'video' ? '5 or 10 only' : '<words ÷ 2.5, rounded>'},
    "narration": "${plan.perSceneWordsMin}–${plan.perSceneWordsMax} words. One flowing sentence.",
    "details": "Internal note.",
    "imagePrompt": "Character-centric. ${hasCharacterImages ? 'Actions/pose only.' : 'Include appearance.'} Cinematic.",
    "cameraAngle": "close-up | medium shot | wide shot | birds-eye | low angle | over-the-shoulder",
    "mood": "tense | hopeful | melancholic | triumphant | mysterious | peaceful | dramatic | romantic"
  }]
}

═══════════════════════════════════════════════════════════════
                    RULES
═══════════════════════════════════════════════════════════════
✓ AT LEAST ${plan.minScenes} scenes (target ${plan.targetScenes})
✓ Each scene: ${plan.perSceneWordsMin}–${plan.perSceneWordsMax} words MAX
✓ Total narration: ${plan.totalWordsMin}–${plan.totalWordsMax} words
✓ All narrations read as ONE flowing story
✓ No scene over ${plan.perSceneDurationMax}s
✓ duration: ${mediaType === 'video' ? '5 or 10 only per scene' : 'word count ÷ 2.5'}
✓ Sum of durations: ${plan.tolerance.min}–${plan.tolerance.max}s
✓ Character in every imagePrompt
✓ Story resolves — not cut off

FAIL CONDITIONS (output will be REJECTED):
❌ Fewer than ${plan.minScenes} scenes — video will be too SHORT
❌ Total words under ${plan.totalWordsMin} — won't reach ${duration}s
❌ Any scene over ${plan.perSceneWordsMax} words
❌ Narration reads like disconnected facts (slideshow)
❌ Story unfinished
`;
  }
}
