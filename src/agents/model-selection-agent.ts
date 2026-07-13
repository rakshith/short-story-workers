// Model Selection Agent — LLM-based model selection for each generation task
// Reads CreativePlan and decides which models to use for image, avatar, voice, video
// Uses decision tree for video model selection (strictly enforced)

import { BaseAgent } from './base-agent';
import { CreativePlan, ModelPlan } from '../types/creative-plan';
import { generateText, Output } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { resolveVideoModel, mapComplexityScore, type VideoModelResolution } from '../utils/video-model-resolver';

export interface ModelSelectionAgentInput {
  creativePlan: CreativePlan;
  userTier: string;
  aspectRatio: string;
  selectedVideoTier: string;        // 'auto' | 'basic' | 'pro' | 'ultra' | 'max'
  videoComplexityScore?: number;    // From AI Director (0-1)
  targetDuration: number;           // For cost optimization
  sceneCount: number;               // For model selection
}

export interface ModelSelectionAgentOutput {
  success: boolean;
  modelPlan?: ModelPlan;
  error?: string;
}

const ModelPlanSchema = z.object({
  image: z.object({
    model: z.string(),
    reason: z.string(),
  }),
  avatar: z.object({
    model: z.enum(['standard', 'pro', 'omnihuman']),
    reason: z.string(),
  }),
  voice: z.object({
    model: z.string(),
    reason: z.string(),
  }),
  video: z.object({
    model: z.string(),
    resolution: z.string(),
    variant: z.string(),
    modelKey: z.string(),
    reason: z.string(),
  }),
});

const SELECTOR_MODEL = 'google/gemini-2.5-flash-lite';

export class ModelSelectionAgent extends BaseAgent<ModelSelectionAgentInput, ModelSelectionAgentOutput> {
  readonly name = 'ModelSelectionAgent';

  async execute(input: ModelSelectionAgentInput): Promise<ModelSelectionAgentOutput> {
    this.log(`Selecting models for plan: ${input.creativePlan.inference.productCategory}, tone: ${input.creativePlan.inference.brandTone}`);

    const apiKey = this.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      this.error('AI_GATEWAY_API_KEY not set');
      return { success: false, error: 'AI_GATEWAY_API_KEY not configured' };
    }

    // ── Step 1: Resolve video model from decision tree (strictly enforced) ──
    const videoComplexityScore = input.videoComplexityScore ?? input.creativePlan.videoProductAnalysis?.videoComplexityScore ?? 0;
    const productComplexity = mapComplexityScore(videoComplexityScore);
    
    this.log(`Video complexity score: ${videoComplexityScore}, mapped to: ${productComplexity}`);

    const videoResolution = resolveVideoModel({
      selectedTier: input.selectedVideoTier || 'auto',
      userTier: input.userTier,
      productComplexity,
    });

    if (!videoResolution) {
      this.error(`Failed to resolve video model for tier=${input.selectedVideoTier}, userTier=${input.userTier}, complexity=${productComplexity}`);
      return { success: false, error: 'Failed to resolve video model from decision tree' };
    }

    this.log(`Video model resolved: ${videoResolution.modelKey} (${videoResolution.variant}, ${videoResolution.resolution})`);

    // ── Step 2: LLM selects image, avatar, voice models ──
    const modelPlan = await this.selectModels(input, apiKey, videoResolution);

    if (!modelPlan) {
      return { success: false, error: 'Failed to select models' };
    }

    this.log(`Models selected: image=${modelPlan.image.model}, avatar=${modelPlan.avatar.model}, voice=${modelPlan.voice.model}, video=${modelPlan.video.model}`);

    return {
      success: true,
      modelPlan,
    };
  }

  private async selectModels(
    input: ModelSelectionAgentInput,
    apiKey: string,
    videoResolution: VideoModelResolution
  ): Promise<ModelPlan | null> {
    const gateway = createGateway({ apiKey });

    const systemPrompt = this.buildSelectorSystemPrompt(videoResolution);
    const userPrompt = this.buildUserPrompt(input, videoResolution);

    try {
      const { output } = await generateText({
        model: gateway(SELECTOR_MODEL),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        output: Output.object({
          schema: ModelPlanSchema,
        }),
      });

      // Override video fields with resolved values (tree is strictly enforced)
      return {
        image: output!.image,
        avatar: output!.avatar,
        voice: output!.voice,
        video: {
          model: videoResolution.model,
          resolution: videoResolution.resolution,
          variant: videoResolution.variant,
          modelKey: videoResolution.modelKey,
          audioInput: videoResolution.audioInput,
          audioParam: videoResolution.audioParam,
          audioArray: videoResolution.audioArray,
          generateAudio: videoResolution.generateAudio,
          reason: output!.video?.reason || `Selected based on user tier ${input.userTier} and product complexity`,
        },
      } as ModelPlan;
    } catch (err) {
      this.error('Failed to select models:', err);
      return null;
    }
  }

  private buildSelectorSystemPrompt(videoResolution: VideoModelResolution): string {
    return `You are a Model Selection Agent for an AI video generation platform.

Your job is to select the optimal AI models for each generation task based on the creative plan.

═════════════════════════════════════════════════════════════
    VIDEO MODEL (ALREADY RESOLVED — DO NOT CHANGE)
═════════════════════════════════════════════════════════════

The video model has been strictly resolved from the decision tree:
- Model: ${videoResolution.model}
- Variant: ${videoResolution.variant}
- Resolution: ${videoResolution.resolution}
- Features: ${videoResolution.features.join(', ')}
- Strengths: ${videoResolution.strengths?.join(', ') || 'N/A'}
- Best for: ${videoResolution.bestFor?.join(', ') || 'N/A'}

You MUST use these exact values for the video model. Do NOT suggest alternatives.
Only provide a brief reason for the selection.

═════════════════════════════════════════════════════════════
    AVAILABLE MODELS
═════════════════════════════════════════════════════════════

IMAGE MODELS (for composite image generation):
- "nano-banana-pro" — Google quality (6 credits), supports multi-image reference, best for composites
- "grok-imagine-image" — Fast, cheap (1 credit), good for standard quality
- "flux-2-pro" — High quality (10 credits), best for premium/luxury products
- "seedream-4.5" — Best possible (12 credits), ultra-premium

AVATAR MODELS (Kling Avatar v2 or OmniHuman v1.5):
- "standard" — Kling Avatar v2 Standard, 15 credits/second, good for most use cases, supports non-human characters
- "pro" — Kling Avatar v2 Pro, 25 credits/second, best face quality for premium brands
- "omnihuman" — ByteDance OmniHuman v1.5, 35 credits/second, full-body gestures + body movement, best for luxury/beauty/fashion

VOICE MODELS (ElevenLabs TTS):
- "eleven_multilingual_v2" — Highest quality (0.002 credits/char), multi-language
- "eleven_turbo_v2_5" — Fast, balanced (0.001 credits/char), good for English
- "eleven_flash_v2_5" — Fastest (0.001 credits/char), lowest latency

═════════════════════════════════════════════════════════════
    SELECTION RULES
═════════════════════════════════════════════════════════════

IMAGE MODEL SELECTION:
- needsComposite = true → "nano-banana-pro" (multi-image reference, ignores white background)
- brandTone = "luxury" or "premium" → "flux-2-pro" or "seedream-4.5"
- brandTone = "casual" or "energetic" → "nano-banana-pro"
- productCategory = "beauty" or "fashion" → "nano-banana-pro"
- Default → "nano-banana-pro" (best quality/cost balance)

AVATAR MODEL SELECTION:
- brandTone = "luxury" or "premium" → "omnihuman" (full-body gestures, premium presentation)
- productCategory = "beauty" or "fashion" → "omnihuman" (body movement for product application)
- brandTone = "casual" or "energetic" → "standard" (cost-effective lip-sync)
- Higher quality non-luxury → "pro" (Kling Pro, better face quality)
- Non-human characters (cartoons, animals) → "standard" or "pro" (Kling supports non-humans)
- Default → "standard"

VOICE MODEL SELECTION:
- Default → "eleven_multilingual_v2" (highest quality)
- If target language is English and need speed → "eleven_turbo_v2_5"
- If need lowest latency → "eleven_flash_v2_5"

═════════════════════════════════════════════════════════════
    OUTPUT FORMAT
═════════════════════════════════════════════════════════════

Return JSON with:
- image: { model: string, reason: string }
- avatar: { model: "standard" | "pro" | "omnihuman", reason: string }
- voice: { model: string, reason: string }
- video: { model: string, resolution: string, variant: string, modelKey: string, reason: string }

IMPORTANT: For video, use the EXACT values provided above. Only fill in the reason field.

Include clear reasoning for each choice.`;
  }

  private buildUserPrompt(input: ModelSelectionAgentInput, videoResolution: VideoModelResolution): string {
    const { creativePlan, userTier, aspectRatio, selectedVideoTier, targetDuration, sceneCount } = input;
    const videoComplexityScore = input.videoComplexityScore ?? creativePlan.videoProductAnalysis?.videoComplexityScore ?? 0;

    return `Select the optimal models for this ad:

CREATIVE PLAN:
- Product Category: ${creativePlan.inference.productCategory}
- Brand Tone: ${creativePlan.inference.brandTone}
- Visual Style: ${creativePlan.inference.visualStyle}
- Product Type: ${creativePlan.inference.productType}
- Ad Format: ${creativePlan.inference.adFormat}
- Target Audience: ${creativePlan.inference.audience}

STORY:
- Scenes: ${sceneCount}
- Total Duration: ${targetDuration}s
- Pacing: ${creativePlan.story.pacing}

REQUIREMENTS:
- Needs Composite: ${creativePlan.requirements.needsComposite}
- Needs Avatar Video: ${creativePlan.requirements.needsAvatarVideo}
- Needs Voiceover: ${creativePlan.requirements.needsVoiceover}

VIDEO CONTEXT:
- Video Complexity Score: ${videoComplexityScore.toFixed(2)} (0-1, higher = more complex)
- Selected Video Tier: ${selectedVideoTier}
- User Tier: ${userTier}
- Aspect Ratio: ${aspectRatio}

RESOLVED VIDEO MODEL (USE THESE EXACT VALUES):
- Model: ${videoResolution.model}
- Resolution: ${videoResolution.resolution}
- Variant: ${videoResolution.variant}
- Model Key: ${videoResolution.modelKey}

Select the best models for each task. For video, use the EXACT values provided above.`;
  }
}
