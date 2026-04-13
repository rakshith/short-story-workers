// Video generation service using Model Provider

import { R2Bucket } from '@cloudflare/workers-types';
import { generateUUID } from '../utils/storage';
import { VideoConfig } from '../types';
import { attachImageInputs, getNearestDuration, getModelImageConfig } from '../utils/replicate-model-config';
import { TemplatePipelineConfig } from '../config/template-config';
import { ModelProviderFactory, PROVIDER_NAMES, type ProviderType } from '@artflicks/model-provider';

export interface VideoGenerationParams {
    prompt: string;
    model: string;
    width: number;
    height: number;
    resolution: string;
    /** Scene duration in seconds (5 or 10 for video). Passed to the video model when supported. */
    duration?: number;
    aspect_ratio?: string;
    seed?: number;
    videoConfig: VideoConfig;
    referenceImageUrl?: string; // The generated image to use as reference for video
    templateConfig?: TemplatePipelineConfig;
}

export interface VideoGenerationResult {
    predictionId: string;
    status: string;
}

/**
 * Determine provider type based on model ID
 * Supports automatic provider switching between Replicate and Fal.ai
 */
function getProviderType(model: string): ProviderType {
  // Fal.ai models start with 'fal-ai/'
  if (model.startsWith('fal-ai/')) {
    return PROVIDER_NAMES.FALAI;
  }
  // Default to Replicate for all other models
  return PROVIDER_NAMES.REPLICATE;
}

/**
 * Trigger async video generation via Model Provider
 */
export async function triggerVideoGeneration(
    params: VideoGenerationParams,
    options: {
        userId: string;
        seriesId: string;
        storyId: string;
        sceneIndex: number;
        replicateApiToken: string;
        falApiToken?: string;  // Optional Fal.ai API token
        webhookUrl: string;
    }
): Promise<VideoGenerationResult> {
    const { replicateApiToken, falApiToken, webhookUrl } = options;

    // Determine which provider to use based on model
    const providerType = getProviderType(params.model);
    console.log(`[VIDEO-GENERATION] Using provider: ${providerType} for model: ${params.model}`);

    // Get the appropriate API key
    const apiKey = providerType === PROVIDER_NAMES.FALAI ? (falApiToken || replicateApiToken) : replicateApiToken;

    // Initialize provider using Model Provider Factory
    const provider = ModelProviderFactory.createProvider(providerType, { apiKey });

    // Prepare input for Replicate video models
    const input: any = {
        prompt: `${params.prompt} ${params.videoConfig?.preset?.stylePrompt || ''}, high quality motion, cinematic`,
    };

    const modelConfig = getModelImageConfig(params.model, params.videoConfig?.enableImmersiveAudio, params.templateConfig);
    if (modelConfig.defaultInputs) {
        Object.assign(input, modelConfig.defaultInputs);
    }

    // Attach image inputs - priority: generated image (for templates that use it) > characterReferenceImages
    // Uses template config to determine which to use
    const usesGeneratedImage = params.templateConfig?.usesGeneratedImage === true;
    const characterRefs = params.videoConfig?.characterReferenceImages;
    const hasCharacterRefs = characterRefs && characterRefs.length > 0;

    let attachedImageFields: import('../utils/replicate-model-config').AttachedImageFields = {};
    if (params.referenceImageUrl && usesGeneratedImage) {
        // Priority 1: Use generated image from imagePrompt (for templates that use generated image)
        console.log('[VIDEO-GEN] Using generated image as reference:', params.referenceImageUrl);
        attachedImageFields = attachImageInputs(input, params.model, [params.referenceImageUrl]);
    } else if (hasCharacterRefs && characterRefs) {
        // Priority 2: Use character reference images from request
        console.log('[VIDEO-GEN] Using character reference images:', params.videoConfig.templateId);
        attachedImageFields = attachImageInputs(input, params.model, characterRefs);
    }

    // Scene duration — snap to model-allowed values (e.g. Veo: 4, 6, 8) when applicable
    if (params.duration !== undefined && params.duration > 0) {
        input.duration = getNearestDuration(params.duration, params.model);
    }
    // Video models often use aspect_ratio instead of width/height
    if (params.aspect_ratio) {
        input.aspect_ratio = params.aspect_ratio;
    }
    if (params.seed !== undefined) {
        input.seed = params.seed;
    }

    console.log(`[VIDEO-GENERATION] Creating prediction for video - Story: ${options.storyId}, Scene: ${options.sceneIndex}`);

    // Append model to webhook for tracking
    const webhookWithModel = `${webhookUrl}&model=${encodeURIComponent(params.model)}`;

    // Use Model Provider's async generation method
    // Note: generateVideoAsync is available on ReplicateProvider for webhook-based async generation
    if (!provider.generateVideoAsync) {
      throw new Error(`Provider ${providerType} does not support async video generation`);
    }

    // Build replicateInput with only image fields from replicate-model-config
    const replicateInput: Record<string, unknown> = {};
    if (attachedImageFields.singleField) {
      replicateInput[attachedImageFields.singleField] = input[attachedImageFields.singleField];
    }
    if (attachedImageFields.multiField) {
      replicateInput[attachedImageFields.multiField] = input[attachedImageFields.multiField];
    }

    const result = await provider.generateVideoAsync(params.model, {
      prompt: input.prompt,
      audioUrl: input.audio,
      duration: input.duration,
      negativePrompt: input.negative_prompt,
      aspect_ratio: input.aspect_ratio,
    }, {
      input: replicateInput,
      webhookUrl: webhookWithModel,
      webhookEvents: ["completed"],
    });

    console.log(`[VIDEO-GENERATION] Prediction created: ${result.predictionId}`);

    return {
      predictionId: result.predictionId,
      status: result.status,
    };
}

/**
 * Process finished video prediction - download from Replicate and upload to R2
 */
export async function processFinishedVideoPrediction(
    prediction: any,
    options: {
        userId: string;
        seriesId: string;
        storyId: string;
        bucket: R2Bucket;
        pathName: string;
    }
): Promise<string[]> {
    const { bucket, pathName } = options;

    // Video output is typically a single URL string or array
    const videoUrls = extractVideoUrls(prediction.output);
    console.log(`[VIDEO-GENERATION] Extracted video URLs:`, videoUrls);

    const storageUrls: string[] = [];
    for (const videoUrl of videoUrls) {
        if (!videoUrl) continue;

        const urlString = typeof videoUrl === 'string' ? videoUrl : String(videoUrl);

        const videoResponse = await fetch(urlString);
        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch generated video: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.arrayBuffer();

        const fileName = `${generateUUID()}.mp4`;
        const key = `${pathName}/${fileName}`;

        await bucket.put(key, videoBlob, {
            httpMetadata: {
                contentType: 'video/mp4',
            },
        });

        const publicUrl = `https://videos.artflicks.app/${key}`;
        storageUrls.push(publicUrl);
    }

    return storageUrls;
}

/**
 * Extract video URLs from Replicate output
 */
function extractVideoUrls(output: any): string[] {
    if (!output) return [];

    // Handle array of URLs
    if (Array.isArray(output)) {
        return output.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item?.href) return item.href;
            if (item instanceof URL) return item.href;
            return String(item);
        });
    }

    // Handle single string URL
    if (typeof output === 'string') {
        return [output];
    }

    // Handle URL object
    if (output?.href) {
        return [output.href];
    }

    console.warn('[VIDEO-GENERATION] Unknown output format:', output);
    return [];
}
