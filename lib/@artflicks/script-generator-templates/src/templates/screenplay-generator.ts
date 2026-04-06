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
    return z.object({
      screenplay: z.string(),
    });
  }

  getSystemPrompt(context: ScriptGenerationContext): string {
    const { duration = 60, language = "en" } = context;
    const scenes = Math.max(5, Math.min(8, Math.ceil(duration / 8)));

    return `You are a short-form cinematic scriptwriter. Write in ${language}.

Output scripts in this exact format:

[visual scene description] Narration text.

Rules:
- Each line = one scene
- Visual in brackets: specific, vivid, 5–8 words
- Narration: punchy, emotional, flowing — 8–15 words per line
- Total ~${scenes} scenes (${duration} seconds)
- No [Character], no [Mood], no camera angles, no labels
- Just bracketed visuals + narration, nothing else
- Story flows as one continuous narrative
- Hook → build → payoff structure
- End with a haunting closer

Output only the script. No explanation, no preamble.`;
  }
}