import { createAiGateway } from "ai-gateway-provider";
import { createOpenAI } from "ai-gateway-provider/providers/openai";
import { ScriptAgentRouter } from "../script-generator/agents";
import { StoryTimeline } from "../types";
import { Env } from "../types/env";

export interface ScriptGenerationParams {
  prompt: string;
  duration: number;
  language?: string;
  model?: string;
  templateId?: string;
  mediaType?: "image" | "video";
  characterReferenceImages?: string[];
  speed?: number;
}

export interface AnchorScene {
  visualHint: string;
  narration: string;
  cameraAngle?: string;
  mood?: string;
  action?: string;
}

export interface ScriptFromAnchorsParams {
  anchors: AnchorScene[];
  duration: number;
  language?: string;
  model?: string;
  mediaType?: "image" | "video";
}

export interface ScriptFromTextParams {
  scriptText: string;
  duration: number;
  language?: string;
  model?: string;
  mediaType?: "image" | "video";
  minSceneDuration?: number;
  maxSceneDuration?: number;
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
    });

    if (!result.success || !result.script) {
      return {
        success: false,
        error: result.error || "Failed to generate script",
      };
    }

    const output = result.script;

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
        mood: scene.mood || "",
        action: scene.action || "",
      })),
    };

    return {
      success: true,
      story,
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

export async function generateScriptFromAnchors(
  params: ScriptFromAnchorsParams,
  env: Env,
): Promise<ScriptGenerationResult> {
  const { anchors, duration, language = "en", mediaType } = params;

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

    const result = await router.run("script-to-shorts", {
      prompt: anchors.map((a) => {
        let sceneText = `[${a.visualHint}]`;
        if (a.action) sceneText += ` [Action: ${a.action}]`;
        sceneText += ` ${a.narration}`;
        return sceneText;
      }).join(" "),
      duration,
      language,
      model: effectiveModel,
      mediaType,
    });

    if (!result.success || !result.script) {
      return {
        success: false,
        error: result.error || "Failed to generate script from anchors",
      };
    }

    const output = result.script;

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
        mood: scene.mood || "",
        action: scene.action || "",
      })),
    };

    return {
      success: true,
      story,
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

export async function generateScriptFromText(
  params: ScriptFromTextParams,
  env: Env,
): Promise<ScriptGenerationResult> {
  const { scriptText, duration, language = "en", mediaType, minSceneDuration, maxSceneDuration } = params;

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

    const result = await router.run("script-to-shorts", {
      prompt: scriptText,
      duration: duration || 30,
      language,
      model: effectiveModel,
      mediaType,
      minSceneDuration,
      maxSceneDuration,
    });

    if (!result.success || !result.script) {
      return {
        success: false,
        error: result.error || "Failed to generate script from text",
      };
    }

    const output = result.script;

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
        mood: scene.mood || "",
        action: scene.action || "",
      })),
    };

    return {
      success: true,
      story,
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
