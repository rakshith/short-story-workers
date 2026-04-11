import { z } from "zod";
import { BaseScriptTemplate } from "./base";
import { ScriptGenerationContext, TemplateManifest } from "../types";
import { getScenePlan } from "../utils/scene-math";
import { ScriptTemplateIds } from './index';

export class ScreenplayGeneratorTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.SCREENPLAY_GENERATOR,
    name: "Screenplay Generator",
    version: "1.1.0",
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
    const { duration = 60, mediaType = "image", language = "en" } = context;
    const plan = getScenePlan(duration, mediaType);
    const languageName = this.getLanguageName(language);

    return `You are a world-class cinematic storyteller. Your goal is to write simple, engaging scripts where visuals and narration flow together seamlessly.

    ═══════════════════════════════════════════════════════════════
                        OUTPUT FORMAT
    ═══════════════════════════════════════════════════════════════
    [Visual description] The narration text goes here, written as a natural spoken sentence.
    [Next visual description] The story flows seamlessly into the next thought.

    ═══════════════════════════════════════════════════════════════
                        STRICT CONSTRAINTS
    ═══════════════════════════════════════════════════════════════
    - PACE: Each scene is a 4-second "beat." 
    - WORD COUNT: Max ${plan.perSceneWordsMax} words per scene. If a sentence is too long, break it into TWO scenes with TWO different visuals.
    - SCENE COUNT: You MUST provide exactly ${plan.targetScenes} scenes to fill the ${duration}s duration.
    - SIMPLE VISUALS: Describe what the viewer sees in simple terms. Focus on the subject, action, and emotion - not camera movements.
    - LANGUAGE: All narration and details: ${languageName} (${language})

    ═══════════════════════════════════════════════════════════════
                    VISUAL ANCHOR & CONTINUITY
    ═══════════════════════════════════════════════════════════════
    - ESTABLISH ONE MAIN SUBJECT: Identify one main visual element (person, object, or concept) that anchors the entire video.
    - CHARACTER STORIES: If your story involves a person/character, lock their appearance once and keep them consistent throughout ALL scenes.
    - ABSTRACT STORIES: If your story is about a concept, process, nature, tutorial, or idea (no specific person needed), focus on visual continuity of the concept instead.
    - NO RANDOM JUMPS: Each scene must visually connect to the next - no sudden unrelated changes.
    - EVOLUTION, NOT JUMPING: If subject changes form, it should feel like natural evolution (skeleton → bones → dust), NOT random jump (skeleton → brown liquid).

    ═══════════════════════════════════════════════════════════════
                        EXAMPLE
    ═══════════════════════════════════════════════════════════════
    [Person staring at phone screen at 2am] Your phone is designed to be addictive.

    [Slot machine spinning] Social media uses the same psychology as slot machines.

    [Finger pulling down to refresh feed] Every pull-to-refresh is a tiny gamble.

    [Brain scan showing reward centers lighting up] Your brain cannot tell the difference between a like and a reward.

    [Person putting phone in drawer] The only way to win is to stop playing.`;
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