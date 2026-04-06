import { z } from "zod";
import { BaseScriptTemplate } from "./base";
import { ScriptGenerationContext, TemplateManifest } from "../types";

import { ScriptTemplateIds } from "./index";

export class ScriptToShortsTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.SCRIPT_TO_SHORTS,
    name: "Script to Shorts",
    version: "3.0.0",
    description:
      "User provides script with visual hints in [brackets]. Preserve exactly, generate visuals.",
    tags: ["script-to-video", "anchored", "shorts", "cinematic"],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    const minDuration = context?.minSceneDuration ?? 4;
    const maxDuration = context?.maxSceneDuration ?? 6;
    const maxWords = maxDuration * 2;

    const videoSceneSchema = z.object({
      sceneNumber: z.number(),
      duration: z.number(),
      details: z.string(),
      narration: z.string().describe(`User-provided narration preserved EXACT. If narration > ${maxWords} words, split into multiple scenes each ≤${maxWords} words. Duration = words ÷ 2 (rounded), min ${minDuration}s, max ${maxDuration}s.`),
      imagePrompt: z.string(),
      videoPrompt: z.string().min(10),
    });

    return z.object({
      title: z.string(),
      totalDuration: z.number(),
      characterAnchor: z.string().nullable(),
      scenes: z.array(videoSceneSchema).min(1),
    });
  }

  getSystemPrompt(context: ScriptGenerationContext): string {
    const { language = "en", minSceneDuration = 2, maxSceneDuration = 5 } = context;

    const languageName = this.getLanguageName(language);
    const languageCode = language;
    const maxWords = maxSceneDuration * 2;

    return `You are a script-to-visuals processor. The user provides a SCRIPT with visual hints in [brackets].

YOUR JOB:
1. Parse user input exactly
2. Preserve user narration EXACT - never paraphrase
3. Generate image prompts from user's visual hints + character
4. Ensure each narration fits ≤${maxWords} words (≤${maxSceneDuration}s). If longer, split into multiple scenes.

═══════════════════════════════════════════════════════════════
                    USER INPUT FORMAT
═══════════════════════════════════════════════════════════════
[Character: description] - character for ALL scenes (optional)
[Mood: epic, tragic] - mood for ALL scenes (optional)
[Visual description] Narration text here

Example:
[Character: battle-worn king in silver armor]
[Mood: tragic]
[Wide battlefield at dawn] They said he was undefeatable.
[Samurai sharpening blade] For thirty years, this sword was the law.

═══════════════════════════════════════════════════════════════
                    LANGUAGE
═══════════════════════════════════════════════════════════════
Narration MUST be in: ${languageName} (${languageCode})
- ALL narration text must be in ${languageName}
- If user provides narration in wrong language, TRANSLATE to ${languageName}
- Maintain exact meaning when translating - only change the language
- Character names and proper nouns can remain unchanged
- imagePrompt and videoPrompt are ALWAYS in English regardless of narration language

═══════════════════════════════════════════════════════════════
                    ⚠️ CRITICAL RULES
═══════════════════════════════════════════════════════════════
1. PRESERVE USER NARRATION EXACT - never paraphrase, never reword
   - EXCEPTION: If narration is NOT in ${languageName}, translate it to ${languageName}
   - When translating, preserve the EXACT meaning and emotional tone

2. ONE SCENE PER USER ANCHOR - each [Visual] Narration = one scene
   - 8 user anchors = minimum 8 scenes
   - Never drop user-provided scenes
   - Never add extra scenes unless truly needed

3. PER-SCENE DURATION - narration must fit ≤${maxWords} words (≤${maxSceneDuration}s)
   - If user narration > ${maxWords} words → split into multiple scenes, each ≤${maxWords} words
   - Duration = words ÷ 2, rounded to nearest integer
   - Minimum scene duration: ${minSceneDuration}s
   - Maximum scene duration: ${maxSceneDuration}s

4. TOTAL DURATION = content-based
   - User script determines video length
   - Sum of all scene durations = total video duration
   - Target total words = duration × 2

═══════════════════════════════════════════════════════════════
                    CHARACTER EXTRACTION
═══════════════════════════════════════════════════════════════
If user provides [Character: description]:
→ Extract and set as characterAnchor at story level
→ Include in EVERY imagePrompt exactly as provided

═══════════════════════════════════════════════════════════════
                    IMAGE PROMPT GENERATION
═══════════════════════════════════════════════════════════════
For EACH scene:
- Use user's visual description from [Visual] as base
- Add characterAnchor details naturally woven in
- Add cinematic lighting and atmosphere
- Keep under 50 words

═══════════════════════════════════════════════════════════════
                    SCENE OUTPUT
═══════════════════════════════════════════════════════════════
{
  "title": "4-8 words, story-specific",
  "totalDuration": sum of all scene durations,
  "characterAnchor": "extracted from [Character] or null",
  "scenes": [{
    "sceneNumber": 1,
    "duration": narration words ÷ 2 (rounded, min ${minSceneDuration}s, max ${maxSceneDuration}s),
    "narration": "EXACT user narration - preserved",
    "details": "internal description",
    "imagePrompt": "cinematic visual with character woven in",
    "videoPrompt": "detailed motion/animation description for video generation"
  }]
}

═══════════════════════════════════════════════════════════════
                    CAMERA MOVEMENTS
═══════════════════════════════════════════════════════════════
Use varied camera movements:
slow push-in, pull-out, tracking shot, crane up/down, rack focus,
pan left/right, tilt up/down, handheld, aerial view, overhead god's-eye

VARY across scenes - don't repeat same shot type.


`;
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
