// Avatar Agent — Generates avatar lip-sync video using Kling Avatar v2
// Wraps the FAL/Replicate submission logic from talking-avatar-pipeline.ts
// For 'avatar' scenes: submits avatar image + audio → Kling Avatar v2 → lip-sync video
// Supports product images for composite overlay (physical products)

import { BaseAgent } from './base-agent';
import { Env } from '../types/env';
import { sanitizePrompt } from '../utils/prompt-sanitizer';

export interface AvatarAgentInput {
  avatarImageUrl: string;
  audioUrl: string;
  aspectRatio: string;
  model: 'standard' | 'pro' | 'omnihuman';
  userId: string;
  jobId: string;
  storyId: string;
  sceneIndex: number;
  baseUrl: string;
  motionInstructions?: string;
  resolution?: string;
  // Product display support
  productImages?: string[];
  displayStrategy?: 'composite' | 'pip-overlay' | 'full-screen-overlay';
  // AI Director creative fields
  shotDescription?: string;
  cameraStyle?: string;
}

export interface AvatarAgentOutput {
  success: boolean;
  provider: string;
  model: string;
  predictionId?: string;
  error?: string;
}

const FAL_AVATAR_MODELS: Record<string, string> = {
  standard: 'fal-ai/kling-video/ai-avatar/v2/standard',
  pro: 'fal-ai/kling-video/ai-avatar/v2/pro',
  omnihuman: 'fal-ai/bytedance/omnihuman/v1.5',
};

const REPLICATE_AVATAR_MODEL = 'kwaivgi/kling-avatar-v2';
const REPLICATE_MODE_MAP: Record<string, string> = {
  standard: 'std',
  pro: 'pro',
};

export class AvatarAgent extends BaseAgent<AvatarAgentInput, AvatarAgentOutput> {
  readonly name = 'AvatarAgent';

  async execute(input: AvatarAgentInput): Promise<AvatarAgentOutput> {
    this.log(`Generating avatar video for scene ${input.sceneIndex}, model: ${input.model}, strategy: ${input.displayStrategy || 'default'}`);

    // Build enhanced motion instructions based on display strategy
    const enhancedMotion = this.buildMotionInstructions(input);

    const webhookMetadata = {
      storyId: input.storyId,
      sceneIndex: String(input.sceneIndex),
      type: 'avatar',
      userId: input.userId,
      jobId: input.jobId,
      model: input.model,
    };
    const origin = new URL(input.baseUrl).origin;
    const replicateWebhookUrl = `${origin}/webhooks/replicate?${new URLSearchParams(webhookMetadata).toString()}`;

    const { ModelProviderFactory, PROVIDER_NAMES, isProviderConfigured } = await import('@artflicks/model-provider');

    const falAvailable = isProviderConfigured(PROVIDER_NAMES.FALAI, this.env);
    const replicateAvailable = isProviderConfigured(PROVIDER_NAMES.REPLICATE, this.env);

    // Try FAL first
    if (falAvailable) {
      try {
        const falModel = FAL_AVATAR_MODELS[input.model] || FAL_AVATAR_MODELS.standard;
        const falProvider = ModelProviderFactory.createProvider(PROVIDER_NAMES.FALAI, { apiKey: this.env.FAL_API_KEY });
        if (falProvider.generateVideoAsync) {
          const result = await falProvider.generateVideoAsync(falModel, {
            imageUrl: input.avatarImageUrl,
            audioUrl: input.audioUrl,
            aspect_ratio: input.aspectRatio,
            ...(enhancedMotion && { prompt: enhancedMotion }),
          }, {
            webhookUrl: origin,
            webhookMetadata,
            webhookEvents: ['completed'],
            ...(input.model === 'omnihuman' && {
              input: {
                resolution: input.resolution || '720p',
                turbo_mode: false,
              },
            }),
          });
          this.log(`FAL submission succeeded: ${result.predictionId}`);
          return { success: true, provider: 'falai', model: falModel, predictionId: result.predictionId };
        }
      } catch (err) {
        this.warn(`FAL submission failed, trying Replicate:`, err);
      }
    }

    // Fallback to Replicate
    if (replicateAvailable) {
      try {
        const replicateProvider = ModelProviderFactory.createProvider(PROVIDER_NAMES.REPLICATE, { apiKey: this.env.REPLICATE_API_TOKEN });
        if (replicateProvider.generateVideoAsync) {
          const result = await replicateProvider.generateVideoAsync(REPLICATE_AVATAR_MODEL, {
            imageUrl: input.avatarImageUrl,
            audioUrl: input.audioUrl,
            aspect_ratio: input.aspectRatio,
          }, {
            input: {
              mode: REPLICATE_MODE_MAP[input.model] || 'std',
              ...(enhancedMotion && { prompt: enhancedMotion }),
            },
            webhookUrl: replicateWebhookUrl,
            webhookEvents: ['completed'],
          });
          this.log(`Replicate submission succeeded: ${result.predictionId}`);
          return { success: true, provider: 'replicate', model: REPLICATE_AVATAR_MODEL, predictionId: result.predictionId };
        }
      } catch (err) {
        this.error(`Replicate submission failed:`, err);
      }
    }

    return { success: false, provider: '', model: '', error: 'No provider available for avatar video generation' };
  }

  /**
   * Build enhanced motion instructions based on display strategy and product context.
   * Kling Avatar v2 accepts a prompt field for motion/scene instructions.
   * Now uses shotDescription and cameraStyle from AI Director when available.
   */
  private buildMotionInstructions(input: AvatarAgentInput): string | undefined {
    const parts: string[] = [];

    // Base motion instructions from user
    if (input.motionInstructions) {
      parts.push(input.motionInstructions);
    }

    // AI Director shot description (primary creative direction)
    if (input.shotDescription) {
      parts.push(input.shotDescription);
    }

    // AI Director camera style
    if (input.cameraStyle) {
      parts.push(`Camera: ${input.cameraStyle}`);
    }

    // Strategy-specific instructions (fallback if no shotDescription)
    if (!input.shotDescription) {
      switch (input.displayStrategy) {
        case 'composite':
          parts.push('Maintain natural pose, speak directly to camera');
          break;

        case 'pip-overlay':
          parts.push('Speak to camera with occasional hand gestures');
          break;

        case 'full-screen-overlay':
          parts.push('Present enthusiastically, gesture toward product');
          break;

        default:
          parts.push('Speak directly to camera');
      }
    } else {
      // Add display strategy context to shot description
      switch (input.displayStrategy) {
        case 'composite':
          parts.push('Avatar is holding the product, maintain natural pose');
          break;
        case 'pip-overlay':
          parts.push('Avatar in corner, speak to camera with gestures');
          break;
        case 'full-screen-overlay':
          parts.push('Present enthusiastically');
          break;
      }
    }

    return parts.length > 0 ? sanitizePrompt(parts.join('. ')) : undefined;
  }
}
