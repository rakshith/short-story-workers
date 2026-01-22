// Image generation service using Replicate SDK

import { R2Bucket } from '@cloudflare/workers-types';
import Replicate from 'replicate';
import { generateShortStoryPath, generateUUID } from '../utils/storage';
import { uploadToDefaultBucket } from '../utils/image-upload';
import { FOLDER_NAMES, video_output_format } from '../config/table-config';
import { v4 as uuidv4 } from 'uuid';
import { VideoConfig } from '../types';

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

export async function triggerReplicateGeneration(
  params: ImageGenerationParams,
  options: {
    userId: string;
    seriesId: string;
    storyId: string;
    sceneIndex: number;
    replicateApiToken: string;
    webhookUrl: string;
  }
): Promise<ImageGenerationResult> {
  const { replicateApiToken, webhookUrl } = options;

  // Initialize Replicate client
  const replicate = new Replicate({
    auth: replicateApiToken,
  });

  // Prepare input for Replicate
  const input: any = {
    prompt: `${params.prompt} ${params.videoConfig?.preset?.stylePrompt}`,
    width: params.width,
    height: params.height,
    num_outputs: params.num_outputs || 1,
    output_format: params.output_format || 'jpg',
  };

  if (params.output_quality) {
    input.output_quality = params.output_quality;
  }
  if (params.aspect_ratio) {
    input.aspect_ratio = params.aspect_ratio;
  }
  if (params.seed !== undefined) {
    input.seed = params.seed;
  }

  // Create prediction with webhook - This returns immediately without waiting
  console.log(`[IMAGE-GENERATION] Creating prediction for image - Story: ${options.storyId}, Scene: ${options.sceneIndex}`);

  // Handle both versioned models (owner/name:version) and model names (owner/name)
  const hasVersion = params.model.includes(':');

  // Append model to webhook for tracking
  const webhookWithModel = `${webhookUrl}&model=${encodeURIComponent(params.model)}`;

  const predictionParams: any = {
    input,
    webhook: webhookWithModel,
    webhook_events_filter: ["completed"],
  };

  if (hasVersion) {
    // If model includes version hash, use version parameter
    predictionParams.version = params.model.split(':')[1];
  } else {
    // Otherwise use the model parameter (owner/name format)
    predictionParams.model = params.model;
  }

  const prediction = await replicate.predictions.create(predictionParams);

  console.log(`[REPLICATE-ASYNC] Prediction created: ${prediction.id}`);

  return {
    predictionId: prediction.id,
    status: prediction.status,
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
