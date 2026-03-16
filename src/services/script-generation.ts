import { createAiGateway } from 'ai-gateway-provider';
import { createOpenAI } from 'ai-gateway-provider/providers/openai';
import { StoryTimeline } from '../types';
import { Env } from '../types/env';

export interface ScriptGenerationParams {
  prompt: string;
  duration: number;
  language?: string;
  model?: string;
  templateId?: string;
  // Media type: 'image' (many short scenes) or 'video' (fewer longer scenes)
  mediaType?: 'image' | 'video';
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
  env: Env
): Promise<ScriptGenerationResult> {
  const {
    prompt,
    duration,
    language = 'en',
    model,
    templateId,
    mediaType,
    characterReferenceImages
  } = params;

  try {
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const gateway = env.CF_AI_GATEWAY_ID;
    if (!accountId || !gateway) {
      throw new Error('CLOUDFLARE_ACCOUNT_ID and CF_AI_GATEWAY_ID are required for script generation');
    }
    const aigateway = createAiGateway({
      accountId,
      gateway,
      apiKey: env.CF_AIG_TOKEN,
    });
    
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const effectiveModel = 'gpt-5.2';
    const model = aigateway(openai(effectiveModel));

    const { ScriptGenerator, ScriptTemplateIds } = await import('@artflicks/video-compiler');
    const generator = new ScriptGenerator(model);

    const result = await generator.generate({
      prompt,
      duration,
      language,
      model: effectiveModel,
      mediaType,
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
