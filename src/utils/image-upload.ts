import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ROOT_BUCKET_NAME } from '../config/table-config';

export interface ImageUploadOptions {
  bucketName: string;
  folderPath?: string;
  fileName?: string;
  contentType?: string;
  upsert?: boolean;
  useSignedUrl?: boolean;
  signedUrlExpiry?: number; // in seconds
}

export interface ImageUploadResult {
  success: boolean;
  url: string;
  fileName: string;
  bucketName: string;
  error?: string;
}

/**
 * Downloads an image from a URL and uploads it to Supabase storage
 * @param imageUrl - The URL of the image to download
 * @param userId - The user ID for organizing files
 * @param options - Configuration options for the upload
 * @param supabaseClient - Supabase client instance (server or client)
 * @returns Promise<ImageUploadResult>
 */
export async function uploadImageToStorage(
  imageUrl: string, 
  userId: string, 
  options: ImageUploadOptions,
  supabaseClient: SupabaseClient,
  outputFormat?: string
): Promise<ImageUploadResult> {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    
    // Generate file name
    const fileName = options.fileName || 
      `${options.folderPath || 'generated-images'}/${userId}/${uuidv4()}.${outputFormat || 'png'}`;

            // Upload to Supabase storage
        const { data, error } = await supabaseClient.storage
      .from(options.bucketName)
      .upload(fileName, imageBuffer, {
        contentType: options.contentType || 'image/png',
        upsert: options.upsert || false
      });

    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    let finalUrl: string;

            // Handle URL generation based on options
        if (options.useSignedUrl) {
          try {
            const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
              .from(options.bucketName)
              .createSignedUrl(fileName, options.signedUrlExpiry || 60 * 60 * 24 * 365); // Default 1 year

            if (signedUrlError) {
              console.error('Error creating signed URL:', signedUrlError);
              // Fallback to public URL
              const { data: urlData } = supabaseClient.storage
                .from(options.bucketName)
                .getPublicUrl(fileName);
              finalUrl = urlData.publicUrl;
            } else {
              finalUrl = signedUrlData.signedUrl;
            }
          } catch (signedUrlError) {
            console.error('Error with signed URL, falling back to public URL:', signedUrlError);
            const { data: urlData } = supabaseClient.storage
              .from(options.bucketName)
              .getPublicUrl(fileName);
            finalUrl = urlData.publicUrl;
          }
        } else {
          // Use public URL
          const { data: urlData } = supabaseClient.storage
            .from(options.bucketName)
            .getPublicUrl(fileName);
          finalUrl = urlData.publicUrl;
        }

    return {
      success: true,
      url: finalUrl,
      fileName,
      bucketName: options.bucketName
    };

  } catch (error) {
    console.error('Error uploading image to storage:', error);
    return {
      success: false,
      url: imageUrl, // Fallback to original URL
      fileName: '',
      bucketName: options.bucketName,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convenience function for uploading to the default 'images' bucket
 * @param imageUrl - The URL of the image to download
 * @param userId - The user ID for organizing files
 * @param supabaseClient - Supabase client instance (server or client)
 * @param folderPath - Optional folder path within the bucket
 * @param index - Optional index for multiple images
 * @returns Promise<ImageUploadResult>
 */
export async function uploadToDefaultBucket(
  imageUrl: string, 
  userId: string, 
  supabaseClient: SupabaseClient,
  folderPath: string = 'generated-images',
  index?: number,
  outputFormat?: string
): Promise<ImageUploadResult> {
  return uploadImageToStorage(imageUrl, userId, {
    bucketName: ROOT_BUCKET_NAME,
    folderPath,
    fileName: index !== undefined ? `${folderPath}/${userId}/${uuidv4()}-${index}.${outputFormat || 'jpg'}` : undefined
  }, supabaseClient);
}

/**
 * Upload multiple images to storage
 * @param imageUrls - Array of image URLs to upload
 * @param userId - The user ID for organizing files
 * @param options - Configuration options for the upload
 * @param supabaseClient - Supabase client instance (server or client)
 * @returns Promise<ImageUploadResult[]>
 */
export async function uploadMultipleImages(
  imageUrls: string[],
  userId: string,
  options: ImageUploadOptions,
  supabaseClient: SupabaseClient
): Promise<ImageUploadResult[]> {
  const uploadPromises = imageUrls.map((imageUrl, index) => {
    const uploadOptions = {
      ...options,
      fileName: options.fileName ? `${options.fileName}-${index}` : undefined
    };
    return uploadImageToStorage(imageUrl, userId, uploadOptions, supabaseClient);
  });

  return Promise.all(uploadPromises);
}

/**
 * Upload a buffer directly to Supabase storage
 * @param buffer - The buffer to upload (ArrayBuffer for Workers compatibility)
 * @param userId - The user ID for organizing files
 * @param supabaseClient - Supabase client instance (server or client)
 * @param options - Configuration options for the upload
 * @returns Promise<ImageUploadResult>
 */
export async function uploadBufferToStorage(
  buffer: ArrayBuffer,
  userId: string,
  options: ImageUploadOptions,
  supabaseClient: SupabaseClient
): Promise<ImageUploadResult> {
  try {
    // Generate file name if not provided
    const fileName = options.fileName || 
      `${options.folderPath || 'generated-images'}/${userId}/${uuidv4()}.png`;

    // Upload buffer to Supabase storage
    const { data, error } = await supabaseClient.storage
      .from(options.bucketName)
      .upload(fileName, buffer, {
        contentType: options.contentType || 'image/png',
        upsert: options.upsert || false
      });

    if (error) {
      throw new Error(`Failed to upload buffer: ${error.message}`);
    }

    let finalUrl: string;

    // Handle URL generation based on options
    if (options.useSignedUrl) {
      try {
        const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
          .from(options.bucketName)
          .createSignedUrl(fileName, options.signedUrlExpiry || 60 * 60 * 24 * 365); // Default 1 year

        if (signedUrlError) {
          console.error('Error creating signed URL:', signedUrlError);
          // Fallback to public URL
          const { data: urlData } = supabaseClient.storage
            .from(options.bucketName)
            .getPublicUrl(fileName);
          finalUrl = urlData.publicUrl;
        } else {
          finalUrl = signedUrlData.signedUrl;
        }
      } catch (signedUrlError) {
        console.error('Error with signed URL, falling back to public URL:', signedUrlError);
        const { data: urlData } = supabaseClient.storage
          .from(options.bucketName)
          .getPublicUrl(fileName);
        finalUrl = urlData.publicUrl;
      }
    } else {
      // Use public URL
      const { data: urlData } = supabaseClient.storage
        .from(options.bucketName)
        .getPublicUrl(fileName);
      finalUrl = urlData.publicUrl;
    }

    return {
      success: true,
      url: finalUrl,
      fileName,
      bucketName: options.bucketName
    };

  } catch (error) {
    console.error('Error uploading buffer to storage:', error);
    return {
      success: false,
      url: '',
      fileName: '',
      bucketName: options.bucketName,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convenience function for uploading buffer to the default 'images' bucket
 * @param buffer - The buffer to upload (ArrayBuffer for Workers compatibility)
 * @param userId - The user ID for organizing files
 * @param supabaseClient - Supabase client instance (server or client)
 * @param folderPath - Optional folder path within the bucket
 * @param contentType - Optional content type (default: 'image/png')
 * @returns Promise<ImageUploadResult>
 */
export async function uploadBufferToDefaultBucket(
  buffer: ArrayBuffer,
  userId: string,
  supabaseClient: SupabaseClient,
  folderPath: string = 'generated-images',
  contentType: string = 'image/png'
): Promise<ImageUploadResult> {
  return uploadBufferToStorage(buffer, userId, {
    bucketName: 'images',
    folderPath,
    fileName: `${folderPath}/${userId}/${uuidv4()}.${contentType.split('/')[1] || 'png'}`,
    contentType
  }, supabaseClient);
}
