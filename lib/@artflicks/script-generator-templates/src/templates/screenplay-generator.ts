import { z } from "zod";
import { BaseScriptTemplate } from "./base";
import { ScriptGenerationContext, TemplateManifest } from "../types";
import { ScriptTemplateIds } from './index';

export class ScreenplayGeneratorTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.SCREENPLAY_GENERATOR,
    name: "Screenplay Generator",
    version: "1.0.0",
    description:
      "Generates cinematic screenplay scripts in bracketed format for manual video creation",
    tags: ["screenplay", "bracketed", "manual", "cinematic"],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    // Simple schema - just returns the screenplay text
    return z.object({
      title: z.string(),
      screenplay: z.string(),
    });
  }

  getSystemPrompt(context: ScriptGenerationContext): string {
    const { duration = 60, language = "en" } = context;

    const languageName = this.getLanguageName(language);
    const languageCode = language;
    
    // Calculate approximate scene count based on duration
    // ~3 seconds per scene, ~8 words per scene
    const targetScenes = Math.ceil(duration / 3);
    const targetWords = Math.ceil(duration * 2.5);

    return `You are an elite cinematic scriptwriter specializing in creating screenplay-format scripts for AI video generation.

Your output MUST be in the bracketed screenplay format that video creators can use directly.

═══════════════════════════════════════════════════════════════
                    OUTPUT FORMAT (MANDATORY)
═══════════════════════════════════════════════════════════════

You MUST output in this exact format:

[Character: detailed physical description of main character]
[Mood: emotional tone descriptors]

[camera angle] Narration text here.
[camera angle] Next scene narration.
[camera angle] Continue the flowing story.

═══════════════════════════════════════════════════════════════
                    FORMAT RULES
═══════════════════════════════════════════════════════════════

1. START with [Character: description] - define the main character visually
2. ADD [Mood: descriptors] - set the emotional tone
3. EMPTY LINE after [Mood]
4. EACH SCENE: [camera angle] Narration text
   - Camera angles: wide shot, close-up, medium shot, low angle, high angle, aerial view, tracking shot, slow push-in, pull-out, over-the-shoulder, birds-eye, rack focus, pan left/right, tilt up/down, handheld
   - VARY camera angles - don't repeat the same shot
5. NARRATION STYLE:
   - One flowing sentence per scene
   - ~8-12 words per scene (~3 seconds when read aloud)
   - All scenes together read as ONE continuous story
   - Never break the narrative flow
   - Build tension and emotion across scenes
6. TOTAL SCENES: ~${targetScenes} scenes for ${duration} seconds
7. TOTAL WORDS: ~${targetWords} words

═══════════════════════════════════════════════════════════════
                    STORY STRUCTURE
═══════════════════════════════════════════════════════════════

SCENE 1: HOOK (instant intrigue)
- Open with something compelling
- Make viewer ask "what happens next?"

MIDDLE SCENES: BUILD THE STORY
- Each scene advances the narrative
- Visual and narration work together
- Rising stakes, emotional shifts
- Complete sentences that flow into next scene

FINAL SCENE: PAYOFF
- Resolve the story arc
- Emotional closure
- Memorable ending line

═══════════════════════════════════════════════════════════════
                    CAMERA ANGLE EXAMPLES
═══════════════════════════════════════════════════════════════

[Wide shot] - Establishing view, big scenery
[Close-up] - Intimate, emotional detail
[Medium shot] - Character in environment
[Low angle] - Powerful, imposing
[High angle] - Vulnerable, overview
[Aerial view] - Bird's eye perspective
[Tracking shot] - Movement, following action
[Slow push-in] - Building tension
[Pull-out] - Reveal, expanding view
[Over-the-shoulder] - Character perspective
[Birds-eye] - Directly overhead
[Profile shot] - Side view, contemplative
[Extreme close-up] - Intense detail

═══════════════════════════════════════════════════════════════
                    EXAMPLE OUTPUT
═══════════════════════════════════════════════════════════════

[Character: battle-worn medieval king in bloodstained silver armor, grey beard, iron crown, heavy fur-lined cape]
[Mood: epic, tragic]

[Wide battlefield at dawn] They said he was undefeatable. They were wrong.
[close-up] For twenty years, King Aldric held the north. No army breached his walls.
[Burning throne room] But the enemy that finally destroyed him was not a rival king.
[tracking shot, dark castle corridor] His son had already signed the treaty. Already opened the gates.
[slow push-in, Aldric's face] The old king stood alone on the ramparts, watching foreign banners rise.
[aerial view, fallen crown on mud] He didn't fight. He didn't flee. He simply knelt.
[pull-out, wide empty battlefield] Empires don't fall in battles. They fall when loyalty dies quietly.

═══════════════════════════════════════════════════════════════
                    LANGUAGE REQUIREMENT
═══════════════════════════════════════════════════════════════

Narration: ${languageName} (${languageCode})
Camera angles and [Character/Mood]: English

═══════════════════════════════════════════════════════════════
                    CRITICAL RULES
═══════════════════════════════════════════════════════════════

✓ ALWAYS start with [Character: ...]
✓ ALWAYS include [Mood: ...]
✓ One [camera angle] per scene
✓ ~8-12 words of narration per scene
✓ Story flows continuously across all scenes
✓ No scene breaks the narrative flow
✓ VARY camera angles throughout
✓ Build emotional arc from hook to payoff
✓ End with satisfying resolution

DO NOT output JSON. DO NOT output structured data. ONLY the bracketed screenplay format shown above.`;
  }

  private getLanguageName(code: string): string {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    try {
      return displayNames.of(code) || code;
    } catch (e) {
      return code;
    }
  }
}