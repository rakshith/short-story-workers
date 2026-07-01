import { BaseSkill } from './base';
import { SkillContext } from './types';

export class QualityValidationSkill extends BaseSkill {
  id = 'quality-validation';
  name = 'Quality Validation';
  version = '1.0.0';

  render(context: SkillContext): string {
    const { scenePlan, mediaType } = context;
    const variant = (context.flags?.validationVariant as string) || 'default';

    switch (variant) {
      case 'faceless-video':
        return this.facelessVideo(scenePlan, mediaType, context);
      case 'character-story':
        return this.characterStory(scenePlan, mediaType, context);
      case 'skeleton-3d':
        return this.skeleton3D(scenePlan);
      case 'body-science':
        return this.bodyScience();
      case 'talking-character-3d':
        return this.talkingCharacter3D(scenePlan, context);
      case 'screenplay':
        return this.screenplay(scenePlan);
      default:
        return '';
    }
  }

  private facelessVideo(scenePlan: any, mediaType: string, context: SkillContext): string {
    return `══════════════════════════════════════════════════════════════
                    SCENE OUTPUT
══════════════════════════════════════════════════════════════
Each scene:
1. sceneNumber — sequential
2. duration — ${mediaType === "video" ? "5 or 10 only (no other values)" : "word count ÷ 2.5, rounded"}
3. narration — ${scenePlan.perSceneWordsMin}–${scenePlan.perSceneWordsMax} words. ONE flowing sentence.
4. details — internal notes (not spoken)
5. imagePrompt — English. Cinematic, dramatic, visually distinct per scene.
6. cameraAngle — shot type

══════════════════════════════════════════════════════════════
                    RULES
══════════════════════════════════════════════════════════════
✔ AT LEAST ${scenePlan.minScenes} scenes (target ${scenePlan.targetScenes})
✔ Each scene: ${scenePlan.perSceneWordsMin}–${scenePlan.perSceneWordsMax} words MAX
✔ Total narration: ${scenePlan.totalWordsMin}–${scenePlan.totalWordsMax} words
✔ All scene narrations read as ONE flowing story back-to-back
✔ duration = ${mediaType === "video" ? "5 or 10 only per scene" : "word count ÷ 2.5"}
✔ Sum of durations: ${scenePlan.tolerance.min}–${scenePlan.tolerance.max}s — adjust scene count and 5s/10s mix so total = ${context.duration}s
✔ Story completes with resolution

ADJUST YOUR OUTPUT so none of these occur (fix before returning):
❌ Fewer than ${scenePlan.minScenes} scenes — add more scenes to reach ${context.duration}s
❌ Total words under ${scenePlan.totalWordsMin} — add more scenes
❌ Any scene over ${scenePlan.perSceneWordsMax} words — shorten or split
❌ Sum of scene durations over ${scenePlan.tolerance.max}s — use fewer scenes or more 5s and fewer 10s so total = ${context.duration}s
❌ Narration reads like disconnected facts (slideshow feel)
❌ Story unfinished or cut off`;
  }

  private characterStory(scenePlan: any, mediaType: string, context: SkillContext): string {
    return `══════════════════════════════════════════════════════════════
                    OUTPUT FORMAT
══════════════════════════════════════════════════════════════
{
  "title": "4-8 words",
  "totalDuration": ${context.duration},
  "scenes": [{
    "sceneNumber": 1,
    "duration": ${mediaType === "video" ? "5 or 10 only" : "<words ÷ 2.5, rounded>"},
    "narration": "${scenePlan.perSceneWordsMin}–${scenePlan.perSceneWordsMax} words. One flowing sentence.",
    "details": "Internal note.",
    "imagePrompt": "Character-centric. ${context.hasCharacterImages ? "Actions/pose only." : "Include appearance."} Cinematic.",
    "cameraAngle": "close-up | medium shot | wide shot | birds-eye | low angle | over-the-shoulder"
  }]
}

══════════════════════════════════════════════════════════════
                    RULES
══════════════════════════════════════════════════════════════
✓ AT LEAST ${scenePlan.minScenes} scenes (target ${scenePlan.targetScenes})
✓ Each scene: ${scenePlan.perSceneWordsMin}–${scenePlan.perSceneWordsMax} words MAX
✓ Total narration: ${scenePlan.totalWordsMin}–${scenePlan.totalWordsMax} words
✓ All narrations read as ONE flowing story
✓ No scene over ${scenePlan.perSceneDurationMax}s
✓ duration: ${mediaType === "video" ? "5 or 10 only per scene" : "word count ÷ 2.5"}
✓ Sum of durations: ${scenePlan.tolerance.min}–${scenePlan.tolerance.max}s — adjust scene count and 5s/10s mix so total = ${context.duration}s
✓ Character in every imagePrompt
✓ Story resolves — not cut off

ADJUST YOUR OUTPUT so none of these occur (fix before returning):
❌ Fewer than ${scenePlan.minScenes} scenes — add more scenes to reach ${context.duration}s
❌ Total words under ${scenePlan.totalWordsMin} — add more scenes
❌ Any scene over ${scenePlan.perSceneWordsMax} words — shorten or split
❌ Sum of scene durations over ${scenePlan.tolerance.max}s — use fewer scenes or more 5s and fewer 10s so total = ${context.duration}s
❌ Narration reads like disconnected facts (slideshow)
❌ Story unfinished`;
  }

  private skeleton3D(scenePlan: any): string {
    return `══════════════════════════════════════════════════════════════
═══ SCENE OUTPUT ═══

Each scene: sceneNumber | duration | narration | imagePrompt | cameraAngle

═══ RULES & FAIL CONDITIONS ═══

STRUCTURE:
✔ ${scenePlan.minScenes}–${scenePlan.maxScenes ?? scenePlan.targetScenes} scenes
✔ ${scenePlan.totalWordsMin}–${scenePlan.totalWordsMax} total words
✔ Title uses EXACT user terms | user details preserved
CINEMATIC TONE:
✔ Present tense | sensory detail per scene | retention hook per scene
✔ Short punchy sentences | no exclamation marks | no comedy`;
  }

  private bodyScience(): string {
    return `══════════════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════════════

For each scene output:
- sceneNumber: sequential integer
- narration: 10–12 word sentence
- imagePrompt: detailed prompt following ALL locked rules
- videoPrompt: detailed animation prompt following ALL locked rules

Also output:
- title: "What Happens To Your Body If…" format, 8–14 words, question mark
- fullNarration: all narration lines joined, one per line
- metadata: YouTube SEO metadata`;
  }

  private talkingCharacter3D(scenePlan: any, context: SkillContext): string {
    return `══════════════════════════════════════════════════════════════
STEP 7 — SCENE STRUCTURE
══════════════════════════════════════════════════════════════

Each scene must include:

- id: "scene_1", "scene_2", etc.
- type: "entry" | "main" | "transformation" | "damage" | "reaction" | "warning"
- imagePrompt (cinematic + biological + action)
- videoPrompt (animation + motion + interaction)
- dialogue (in ${context.languageName})
- duration: MUST be ONLY 4, 6, or 8 seconds
- camera: { type, movement }
- environment: Setting description
- character: { name, traits }
- mood: Emotional tone

══════════════════════════════════════════════════════════════
STEP 8 — QUALITY VALIDATION
══════════════════════════════════════════════════════════════

Before output:

✔ Cinematic lighting present
✔ PBR / GI / SSS present
✔ Micro textures included
✔ INTERNAL body environment (if food/health)
✔ MULTIPLE AGENTS present (ONLY for internal biological scenes)
✔ Strong visible action present (for object scenes)
✔ Action verbs present: cleaning/repairing/absorbing/dissolving/attacking
✔ CLEAR cause → action → result
✔ Visible transformation

If any missing → REWRITE

══════════════════════════════════════════════════════════════
STEP 9 — OUTPUT FORMAT
══════════════════════════════════════════════════════════════

Return ONLY valid JSON:

{
  "title": "...",
  "type": "single_scene" | "multi_scene",
  "scenes": [
    {
      "id": "scene_1",
      "type": "...",
      "imagePrompt": "...",
      "videoPrompt": "...",
      "dialogue": "...",
      "duration": 4 | 6 | 8,
      "camera": { "type": "...", "movement": "..." },
      "environment": "...",
      "character": { "name": "...", "traits": [...] },
      "mood": "..."
    }
  ]
}

══════════════════════════════════════════════════════════════
HARD RULES
══════════════════════════════════════════════════════════════

✓ Title: 4-15 words, catchy and descriptive
✓ No static scenes
✓ No single-agent scenes for health topics
✓ Use INTERNAL environment only when biologically required
✓ Otherwise allow EXTERNAL environments
✓ Must show transformation
✓ Must feel like a living system
✓ Always cinematic
✓ Always expressive
✓ Always 9:16
✓ imagePrompt ALWAYS in English
✓ dialogue ALWAYS in ${context.languageName}
✓ Total duration: ${context.duration} seconds (${scenePlan.tolerance.min}-${scenePlan.tolerance.max}s range)
✓ Scene durations DYNAMICALLY assigned via intelligent adjustment (dialogue → duration)
✓ NEVER cut dialogue — always upgrade duration if needed
✓ Camera is locked with micro parallax only — no pan, no zoom, no reframing

If unsure → ADD MORE ACTION, not less`;
  }

  private screenplay(scenePlan: any): string {
    return `══════════════════════════════════════════════════════════════
                    OUTPUT FORMAT
══════════════════════════════════════════════════════════════
[Visual description] The narration text goes here, written as a natural spoken sentence.
[Next visual description] The story flows seamlessly into the next thought.`;
  }
}

export const qualityValidationSkill = new QualityValidationSkill();
