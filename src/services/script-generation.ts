// Script generation service using Vercel AI SDK
import { createOpenAI } from '@ai-sdk/openai';
import { StoryTimeline } from '../types';

// The following imports are no longer needed as logic is moved to @artflicks/video-compiler
// import { generateText, LanguageModelUsage, Output } from 'ai';
// import { getScriptWriterPrompt } from '../utils/systemPrompts';
// import { SCRIPT_WRITER_SCENE_SCHEMA } from '../types/zod-types';

export interface ScriptGenerationParams {
  prompt: string;
  duration: number;
  language?: string;
  model?: string;
  templateId?: string;
  // Allow passing extra context fields for specific templates
  characterReferenceImages?: string[];
}

export interface ScriptGenerationResult {
  success: boolean;
  story?: StoryTimeline;
  error?: string;
  usage?: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export async function generateScript(
  params: ScriptGenerationParams,
  openaiApiKey: string
): Promise<ScriptGenerationResult> {
  const {
    prompt,
    duration,
    language = 'en',
    model,
    templateId,
    characterReferenceImages
  } = params;

  try {
    const openai = createOpenAI({
      apiKey: openaiApiKey,
    });

    // Import dynamically to avoid top-level side effects if needed, 
    // but static import is fine given we added paths
    const { ScriptGenerator, ScriptTemplateIds } = await import('@artflicks/video-compiler');

    const generator = new ScriptGenerator(openai(model || 'gpt-5.2'));

    const result = await generator.generate({
      prompt,
      duration,
      language,
      model: model || 'gpt-5.2',
      characterReferenceImages
    }, templateId || ScriptTemplateIds.YOUTUBE_SHORTS);

    if (!result.success || !result.script) {
      return {
        success: false,
        error: result.error || 'Failed to generate script'
      };
    }

    const output = result.script;

    // Convert to StoryTimeline format
    const story: StoryTimeline = {
      id: '', // Will be set later
      title: output.title,
      totalDuration: output.totalDuration || duration,
      scenes: (output.scenes || []).map((scene: any) => ({
        sceneNumber: scene.sceneNumber,
        duration: scene.duration,
        narration: scene.narration,
        details: scene.details || '',
        imagePrompt: scene.imagePrompt,
        cameraAngle: scene.cameraAngle || '',
        mood: scene.mood || '',
      })),
    };

    return {
      success: true,
      story,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      } : undefined,
    };
  } catch (error) {
    console.error('[Script Generation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
