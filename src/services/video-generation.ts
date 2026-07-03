// Video generation service using Model Provider

import { R2Bucket } from '@cloudflare/workers-types';
import { generateUUID } from '../utils/storage';
import { VideoConfig } from '../types';
import { TemplatePipelineConfig } from '../config/template-config';
import { 
  ModelProviderFactory, 
  type ProviderType,
  attachImageInputsForProvider,
  applyDefaultInputs,
  getNearestDuration,
} from '@artflicks/model-provider';

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
 * Trigger async video generation via Model Provider
 */
export async function triggerVideoGeneration(
    params: VideoGenerationParams,
    options: {
        userId: string;
        seriesId: string;
        storyId: string;
        sceneIndex: number;
        provider: ProviderType;
        apiKey: string;
        webhookUrl: string;
    }
): Promise<VideoGenerationResult> {
    const { provider, apiKey, webhookUrl } = options;

    console.log(`[VIDEO-GENERATION] Using provider: ${provider} for model: ${params.model}`);

    const providerInstance = ModelProviderFactory.createProvider(provider, { apiKey });

    const input: any = {
        prompt: params.prompt,
    };

    applyDefaultInputs(input, params.model, provider);

    const usesGeneratedImage = params.templateConfig?.usesGeneratedImage === true;
    const characterRefs = params.videoConfig?.characterReferenceImages;
    const hasCharacterRefs = characterRefs && characterRefs.length > 0;

    let attachedImageFields: { singleField?: string; multiField?: string } = {};
    if (params.referenceImageUrl && usesGeneratedImage) {
        console.log('[VIDEO-GEN] Using generated image as reference:', params.referenceImageUrl);
        attachedImageFields = attachImageInputsForProvider(input, params.model, provider, [params.referenceImageUrl]);
    } else if (hasCharacterRefs && characterRefs) {
        console.log('[VIDEO-GEN] Using character reference images:', params.videoConfig.templateId);
        attachedImageFields = attachImageInputsForProvider(input, params.model, provider, characterRefs);
    }

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

    if (!providerInstance.generateVideoAsync) {
      throw new Error(`Provider ${provider} does not support async video generation`);
    }

    const replicateInput: Record<string, unknown> = {};
    if (attachedImageFields.singleField) {
      replicateInput[attachedImageFields.singleField] = input[attachedImageFields.singleField];
    }
    if (attachedImageFields.multiField) {
      replicateInput[attachedImageFields.multiField] = input[attachedImageFields.multiField];
    }

    const result = await providerInstance.generateVideoAsync(params.model, {
      prompt: input.prompt,
      audioUrl: input.audio,
      duration: input.duration,
      negativePrompt: input.negative_prompt,
      aspect_ratio: input.aspect_ratio,
    }, {
      input: {
        ...replicateInput,
        ...(input.seed !== undefined && { seed: input.seed }),
      },
      webhookUrl,
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
