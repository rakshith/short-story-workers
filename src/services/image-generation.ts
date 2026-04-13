// Image generation service using Model Provider

import { R2Bucket } from '@cloudflare/workers-types';
import { generateUUID } from '../utils/storage';
import { video_output_format } from '../config/table-config';
import { VideoConfig } from '../types';
import { attachImageInputs } from '../utils/replicate-model-config';
import { ScriptTemplateIds } from '../script-generator';
import { ModelProviderFactory, PROVIDER_NAMES, type ProviderType } from '@artflicks/model-provider';

export interface ImageGenerationParams {
  prompt: string;
  model: string;
  width: number;
  height: number;
  num_outputs?: number;
  output_format?: string;
  output_quality?: number;
  aspect_ratio?: string;
  seed?: number;
  videoConfig: VideoConfig;
}

export interface ImageGenerationResult {
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

export async function triggerReplicateGeneration(
  params: ImageGenerationParams,
  options: {
    userId: string;
    seriesId: string;
    storyId: string;
    sceneIndex: number;
    replicateApiToken: string;
    falApiToken?: string;  // Optional Fal.ai API token
    webhookUrl: string;
  }
): Promise<ImageGenerationResult> {
  const { replicateApiToken, falApiToken, webhookUrl } = options;

  // Determine which provider to use based on model
  const providerType = getProviderType(params.model);
  console.log(`[IMAGE-GENERATION] Using provider: ${providerType} for model: ${params.model}`);

  // Get the appropriate API key
  const apiKey = providerType === PROVIDER_NAMES.FALAI ? (falApiToken || replicateApiToken) : replicateApiToken;

  // Initialize provider using Model Provider Factory
  const provider = ModelProviderFactory.createProvider(providerType, { apiKey });

  // Prepare input for generation
  const input: any = {
    prompt: `${params.prompt} ${params.videoConfig?.preset?.stylePrompt}`,
    width: params.width,
    height: params.height,
    num_outputs: params.num_outputs || 1,
    output_format: params.output_format || 'jpg',
  };

  // Get model config and apply default inputs
  const { getModelImageConfig } = await import('../utils/replicate-model-config');
  const modelConfig = getModelImageConfig(params.model);
  if (modelConfig.defaultInputs) {
    Object.assign(input, modelConfig.defaultInputs);
  }
  // Remove width/height if model uses size parameter instead
  if (modelConfig.ignoreWidthHeight) {
    delete input.width;
    delete input.height;
  }

  let attachedImageFields: import('../utils/replicate-model-config').AttachedImageFields = {};
  if (params.videoConfig.templateId === ScriptTemplateIds.CHARACTER_STORY || 
      params.videoConfig.templateId === ScriptTemplateIds.SKELETON_3D_SHORTS ||
      params.videoConfig.templateId === ScriptTemplateIds.BODY_SCIENCE_SHORTS) {
    // Attach image inputs based on model type for CHARACTER_STORY and SKELETON_3D_SHORTS
    console.log('[IMAGE-GEN] Template ID:', params.videoConfig.templateId);
    console.log('[IMAGE-GEN] Character References:', params.videoConfig?.characterReferenceImages);
    attachedImageFields = attachImageInputs(input, params.model, params.videoConfig?.characterReferenceImages);
  }

  if (params.output_quality) {
    input.output_quality = params.output_quality;
  }
  if (params.aspect_ratio) {
    input.aspect_ratio = params.aspect_ratio;
  }
  if (params.seed !== undefined) {
    input.seed = params.seed;
  }

  // Filter out excluded fields based on model config
  if (modelConfig.excludeFields) {
    for (const field of modelConfig.excludeFields) {
      if (field in input) {
        console.log(`[IMAGE-GEN] Excluding field '${field}' for model ${params.model}`);
        delete input[field];
      }
    }
  }

  // Create prediction with webhook - This returns immediately without waiting
  console.log(`[IMAGE-GENERATION] Creating prediction for image - Story: ${options.storyId}, Scene: ${options.sceneIndex}`);

  // Append model to webhook for tracking
  const webhookWithModel = `${webhookUrl}&model=${encodeURIComponent(params.model)}`;

  // Use Model Provider's async generation method
  // Note: generateImageAsync is available on ReplicateProvider for webhook-based async generation
  if (!provider.generateImageAsync) {
    throw new Error(`Provider ${providerType} does not support async image generation`);
  }

  // Build replicateInput with only image fields from replicate-model-config
  const replicateInput: Record<string, unknown> = {};
  if (attachedImageFields.singleField) {
    replicateInput[attachedImageFields.singleField] = input[attachedImageFields.singleField];
  }
  if (attachedImageFields.multiField) {
    replicateInput[attachedImageFields.multiField] = input[attachedImageFields.multiField];
  }

  const result = await provider.generateImageAsync(params.model, {
    prompt: input.prompt,
    negativePrompt: input.negative_prompt,
  }, {
    width: input.width,
    height: input.height,
    aspect_ratio: input.aspect_ratio,
    guidance: input.guidance_scale,
    seed: input.seed,
    input: replicateInput,
    webhookUrl: webhookWithModel,
    webhookEvents: ["completed"],
  });

  console.log(`[REPLICATE-ASYNC] Prediction created: ${result.predictionId}`);

  return {
    predictionId: result.predictionId,
    status: result.status,
  };
}

/**
 * Legacy support or internal helper to process finished prediction
 * This will be used by the webhook handler to download and upload to R2
 */
export async function processFinishedPrediction(
  prediction: any,
  options: {
    userId: string;
    seriesId: string;
    storyId: string;
    imagesBucket: R2Bucket;
    pathName: string;
    outputFormat?: string;
  }
): Promise<string[]> {
  const { imagesBucket, pathName } = options;

  // Extract image URLs using the extractImageUrls function
  const imageUrls = await extractImageUrls(prediction.output, '[REPLICATE-WEBHOOK]');
  console.log(`[REPLICATE-WEBHOOK] Extracted URLs:`, imageUrls);

  const storageUrls: string[] = [];
  for (const imageUrl of imageUrls) {
    if (!imageUrl) continue;

    const urlString = typeof imageUrl === 'string' ? imageUrl : String(imageUrl);

    let imageBlob: ArrayBuffer;
    if (urlString.startsWith('data:')) {
      const base64Data = urlString.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBlob = bytes.buffer;
    } else {
      const imageResponse = await fetch(urlString);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch generated content: ${imageResponse.statusText}`);
      }
      imageBlob = await imageResponse.arrayBuffer();
    }

    const fileName = `${generateUUID()}.${options.outputFormat || 'jpg'}`;
    const key = `${pathName}/${fileName}`;

    await imagesBucket.put(key, imageBlob, {
      httpMetadata: {
        contentType: options.outputFormat === video_output_format ? 'video/mp4' : `image/${options.outputFormat || 'jpg'}`,
      },
    });

    const publicUrl = `https://image.artflicks.app/${key}`;
    storageUrls.push(publicUrl);
  }

  return storageUrls;
}


// Helper function to convert any URL-like value to a string
function toUrlString(value: any): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    // Handle URL objects (check for href property or instanceof URL)
    if (value.href && typeof value.href === 'string') {
      return value.href;
    }
    // Handle URL objects via instanceof check (works in most environments)
    if (value instanceof URL) {
      return value.href;
    }
    // Handle objects with url() method
    if (typeof value.url === 'function') {
      const urlResult = value.url();
      return toUrlString(urlResult); // Recursively convert in case url() returns a URL object
    }
  }
  // Fallback to String conversion
  return String(value);
}

async function extractImageUrls(images: any, logPrefix: string): Promise<string[]> {
  console.log(`${logPrefix} Raw images response:`, {
    type: typeof images,
    isArray: Array.isArray(images),
    length: Array.isArray(images) ? images.length : 'N/A',
    value: images
  });

  let imageArray: string[] = [];

  try {
    // Handle the result format from runReplicateModel
    if (Array.isArray(images)) {
      if (images.length > 0) {
        // Convert all items to string URLs
        imageArray = images.map((item: any) => {
          try {
            return toUrlString(item);
          } catch (error) {
            throw new Error(`Invalid image format in array: ${error}`);
          }
        });
      }
    } else if (images && typeof images.url === 'function') {
      // Handle single object with url() method
      imageArray = [toUrlString(images.url())];
    } else if (typeof images === 'string') {
      // Handle single string URL
      imageArray = [images];
    } else if (images && typeof images === 'object' && images.href) {
      // Handle single URL object
      imageArray = [toUrlString(images)];
    } else {
      try {
        const stream = images.image;
        const response = new Response(stream);
        const blob = await response.blob();
        // Convert blob to data URL (URL.createObjectURL is not available in Workers)
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const mimeType = blob.type || 'image/jpeg';
        const url = `data:${mimeType};base64,${base64}`;
        imageArray = [url];
      } catch (error) {
        console.log(`${logPrefix} Failed to extract image URLs new Response(stream):`, error);
        if (!imageArray || imageArray.length === 0) {
          throw new Error(`No images were generated: ${error}`);
        }
      }
    }

  } catch (error) {
    console.log(`${logPrefix} Failed to extract image URLs:`, error);
    throw new Error(`No images were generated`);
  }

  // Ensure all items are strings
  imageArray = imageArray.map(item => toUrlString(item));

  console.log(`${logPrefix} Successfully generated`, imageArray.length, 'images');
  return imageArray;
}