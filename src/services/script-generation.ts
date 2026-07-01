import { createAiGateway } from "ai-gateway-provider";
import { createOpenAI } from "ai-gateway-provider/providers/openai";
import { ScriptAgentRouter } from "../script-generator/agents";
import { StoryTimeline } from "../types";
import { Env } from "../types/env";
import { SceneAdapterOutput } from "../types/template-scenes";
import { mapToTimeline } from "../utils/template-scene-mapper";
import { getTemplateConfig, isSceneAdapterTemplate, TemplatePipelineConfig } from "../config/template-config";

export interface ScriptGenerationParams {
  prompt: string;
  duration: number;
  language?: string;
  model?: string;
  templateId?: string;
  mediaType?: "image" | "video";
  characterReferenceImages?: string[];
  speed?: number;
  motionInstructions?: string;
  stylePrompt?: string;
}

export interface ScriptGenerationResult {
  success: boolean;
  story?: StoryTimeline;
  enhancedMotionInstructions?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  templateConfig?: TemplatePipelineConfig;
}

export async function generateScript(
  params: ScriptGenerationParams,
  env: Env,
): Promise<ScriptGenerationResult> {
  const {
    prompt,
    duration,
    language = "en",
    templateId,
    mediaType,
    characterReferenceImages,
    speed,
    motionInstructions,
    stylePrompt,
  } = params;

  try {
    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const gateway = env.CF_AI_GATEWAY_ID;
    if (!accountId || !gateway) {
      throw new Error(
        "CLOUDFLARE_ACCOUNT_ID and CF_AI_GATEWAY_ID are required for script generation",
      );
    }
    const aigateway = createAiGateway({
      accountId,
      gateway,
      apiKey: env.CF_AIG_TOKEN,
    });

    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const effectiveModel = "gpt-5.2";
    const languageModel = aigateway(openai(effectiveModel));
    const router = new ScriptAgentRouter(languageModel);

    const result = await router.run(templateId, {
      prompt,
      duration,
      language,
      model: effectiveModel,
      mediaType,
      characterReferenceImages,
      speed,
      motionInstructions,
      stylePrompt,
    });

    if (!result.success || !result.script) {
      return {
        success: false,
        error: result.error || "Failed to generate script",
      };
    }

    const output = result.script;

    // Check if this template uses scene-adapter format (needs conversion to StoryTimeline)
    if (templateId && isSceneAdapterTemplate(templateId)) {
      const timeline = mapToTimeline(output as SceneAdapterOutput, templateId);
      const config = getTemplateConfig(templateId);
      return {
        success: true,
        story: timeline,
        enhancedMotionInstructions: output.enhancedMotionInstructions || undefined,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              outputTokens: result.usage.outputTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
        templateConfig: config,
      };
    }

    // Standard StoryTimeline format mapping
    const story: StoryTimeline = {
      id: "",
      title: output.title,
      totalDuration: output.totalDuration || duration,
      characterAnchor: output.characterAnchor || null,
      scenes: (output.scenes || []).map((scene: any) => ({
        sceneNumber: scene.sceneNumber,
        duration: scene.duration,
        narration: scene.narration,
        details: scene.details || "",
        imagePrompt: scene.imagePrompt,
        videoPrompt: scene.videoPrompt || "",
        cameraAngle: scene.cameraAngle || "",
      })),
    };

    return {
      success: true,
      story,
      enhancedMotionInstructions: output.enhancedMotionInstructions || undefined,
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  } catch (error) {
    console.error("[Script Generation] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
