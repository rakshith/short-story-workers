// Image generation service using Replicate SDK

import { R2Bucket } from '@cloudflare/workers-types';
import Replicate from 'replicate';
import { generateShortStoryPath, generateUUID } from '../utils/storage';
import { uploadToDefaultBucket } from '../utils/image-upload';
import { FOLDER_NAMES } from '../config/table-config';
import { v4 as uuidv4 } from 'uuid';
import { VideoConfigData } from './supabase';

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
  videoConfig: VideoConfigData;
}

export interface ImageGenerationResult {
  storageUrls: string[];
  generationParams: any;
  prompt: string;
  model: string;
}

export async function generateAndUploadImages(
  params: ImageGenerationParams,
  options: {
    userId: string;
    seriesId: string;
    storyId: string;
    imagesBucket: R2Bucket;
    replicateApiToken: string;
    pathName: string;
  }
): Promise<ImageGenerationResult> {
  const { imagesBucket, replicateApiToken, pathName } = options;

  // Verify bucket exists
  if (!imagesBucket) {
    throw new Error('imagesBucket is not configured. Check R2 bucket binding in wrangler.toml');
  }
  
  console.log(`[IMAGE-GEN] Using R2 bucket:`, typeof imagesBucket, imagesBucket);

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

  // Run the model - Replicate SDK handles polling automatically
  console.log(`[IMAGE-GEN] Calling Replicate with model: ${params.model}`);
  const output = await replicate.run(params.model as `${string}/${string}`, { input });
  console.log(`[IMAGE-GEN] Replicate output:`, output);

  // Extract image URLs using the extractImageUrls function
  const imageUrls = await extractImageUrls(output, '[IMAGE-GEN]');
  console.log(`[IMAGE-GEN] Extracted image URLs:`, imageUrls);

  // Upload images to R2
  const storageUrls: string[] = [];
  for (const imageUrl of imageUrls) {
    if (!imageUrl) {
      console.warn(`[IMAGE-GEN] Skipping empty image URL`);
      continue;
    }

    // Ensure imageUrl is a string
    const urlString = typeof imageUrl === 'string' ? imageUrl : String(imageUrl);
    if (!urlString || urlString === 'undefined' || urlString === 'null') {
      console.warn(`[IMAGE-GEN] Skipping invalid image URL:`, imageUrl);
      continue;
    }

    // Handle data URLs and regular URLs
    let imageBlob: ArrayBuffer;
    if (urlString.startsWith('data:')) {
      // Extract base64 data from data URL
      const base64Data = urlString.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBlob = bytes.buffer;
    } else {
      // It's a regular URL - fetch it
      console.log(`[IMAGE-GEN] Processing URL: ${urlString}`);
      const imageResponse = await fetch(urlString);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
      }
      imageBlob = await imageResponse.arrayBuffer();
    }

    const fileName = `${generateUUID()}.${params.output_format || 'jpg'}`;
    const key = `${pathName}/${fileName}`;

    // Validate imageBlob before upload
    if (!imageBlob || imageBlob.byteLength === 0) {
      console.error(`[IMAGE-GEN] Invalid image blob for URL: ${urlString}`);
      throw new Error(`Invalid image blob: empty or undefined`);
    }

    console.log(`[IMAGE-GEN] Uploading to R2 - Key: ${key}, Size: ${imageBlob.byteLength} bytes`);

    // Upload to R2
    try {
      const uploadResult = await imagesBucket.put(key, imageBlob, {
        httpMetadata: {
          contentType: `image/${params.output_format || 'jpg'}`,
        },
      });

      console.log(`[IMAGE-GEN] Upload result:`, uploadResult);
      console.log(`[IMAGE-GEN] Successfully uploaded to R2: ${key}`);

      // Verify the upload by checking if the file exists
      const headResult = await imagesBucket.head(key);
      if (!headResult) {
        throw new Error(`Upload verification failed: File not found after upload at key: ${key}`);
      }
      console.log(`[IMAGE-GEN] Verified file exists in R2:`, {
        key,
        size: headResult.size,
        uploaded: headResult.uploaded,
        etag: headResult.etag
      });
    } catch (uploadError) {
      console.error(`[IMAGE-GEN] Failed to upload to R2:`, uploadError);
      throw new Error(`Failed to upload image to R2: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
    }

    // Generate public URL
    const publicUrl = `https://image.artflicks.app/${key}`;
    console.log(`[IMAGE-GEN] Generated public URL: ${publicUrl}`);
    storageUrls.push(publicUrl);
  }

  console.log(`[IMAGE-GEN] All storage URLs:`, storageUrls);

  return {
    storageUrls,
    generationParams: params,
    prompt: params.prompt,
    model: params.model,
  };
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

export async function extractImageUrls(images: any, logPrefix: string): Promise<string[]> {
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
