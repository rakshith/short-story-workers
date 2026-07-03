/**
 * Model ID Mapping
 * 
 * Maps canonical model names to provider-specific IDs.
 * Supports generation-type-specific endpoints for providers like FAL.
 */

import { ProviderType } from './types';

/**
 * Generation type for model endpoints
 */
export type GenerationType = 
  | 'text-to-image' 
  | 'image-to-image' 
  | 'text-to-video' 
  | 'image-to-video' 
  | 'reference-to-video'
  | 'audio';

/**
 * Provider model IDs can be:
 * - Simple string (same endpoint for all generation types, e.g., Replicate)
 * - Object mapping generation types to specific endpoints (e.g., FAL)
 */
export type ProviderModelIds = string | Partial<Record<GenerationType, string>>;

/**
 * Canonical model name -> provider-specific IDs
 * 
 * For models that need different endpoints per generation type (like FAL),
 * use an object mapping. For models with single endpoints (like Replicate),
 * use a simple string.
 */
export const MODEL_ID_MAP: Record<string, Record<ProviderType, ProviderModelIds>> = {
  // ============================================================================
  // VIDEO MODELS
  // ============================================================================
  
  // Kling Video Models
  'kling-v2.6': {
    replicate: 'kwaivgi/kling-v2.6',
    falai: {
      'text-to-video': 'fal-ai/kling-video/v2.6/pro/text-to-video',
      'image-to-video': 'fal-ai/kling-video/v2.6/pro/image-to-video',
    },
    gateway: 'kwaivgi/kling-v2.6',
  },
  'kling-v2.5-turbo': {
    replicate: 'kwaivgi/kling-v2.5-turbo-pro',
    falai: {
      'text-to-video': 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
      'image-to-video': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
    },
    gateway: 'kwaivgi/kling-v2.5-turbo-pro',
  },
  'kling-v2.1-master': {
    replicate: 'kwaivgi/kling-v2.1-master',
    falai: {
      'text-to-video': 'fal-ai/kling-video/v2.1/master/text-to-video',
      'image-to-video': 'fal-ai/kling-video/v2.1/master/image-to-video',
    },
    gateway: 'kwaivgi/kling-v2.1-master',
  },
  'kling-v2.1': {
    replicate: 'kwaivgi/kling-v2.1',
    falai: {
      'text-to-video': 'fal-ai/kling-video/v2.1/master/text-to-video', // not available in falai, fallback to master
      'image-to-video': 'fal-ai/kling-video/v2.1/standard/image-to-video',
    },
    gateway: 'kwaivgi/kling-v2.1',
  },
  'kling-v1.6-standard': {
    replicate: 'kwaivgi/kling-v1.6-standard',
    falai: {
      'text-to-video': 'fal-ai/kling-video/v1.6/standard/text-to-video',
      'image-to-video': 'fal-ai/kling-video/v1.6/standard/image-to-video',
    },
    gateway: 'kwaivgi/kling-v1.6-standard',
  },
  'kling-v3': {
    replicate: 'kwaivgi/kling-v3-video',
    falai: {
      'text-to-video': 'fal-ai/kling-video/v3/pro/text-to-video',
      'image-to-video': 'fal-ai/kling-video/v3/pro/image-to-video',
    },
    gateway: 'kwaivgi/kling-v3-video',
  },
  'kling-avatar-v2': {
    replicate: 'kwaivgi/kling-avatar-v2',
    falai: {
      'image-to-video': 'fal-ai/kling-video/ai-avatar/v2/standard',
    },
    gateway: 'kwaivgi/kling-avatar-v2',
  },
  
  // Wan Video Models
  'wan-2.5-i2v': {
    replicate: 'wan-video/wan-2.5-i2v',
    falai: {
      'text-to-video': 'fal-ai/wan-25-preview/text-to-image',
      'image-to-video': 'fal-ai/wan-25-preview/image-to-video',
    },
    gateway: 'wan-video/wan-2.5-i2v',
  },
  'wan-2.5-i2v-fast': {
    replicate: 'wan-video/wan-2.5-i2v-fast',
    falai: {
      'image-to-video': 'fal-ai/wan-video/v2/fast/image-to-video',
    },
    gateway: 'wan-video/wan-2.5-i2v-fast',
  },
  'wan-2.6-i2v': {
    replicate: 'wan-video/wan-2.6-i2v',
    falai: {
      'image-to-video': 'fal-ai/wan-video/v2.6/image-to-video',
    },
    gateway: 'wan-video/wan-2.6-i2v',
  },
  'wan-2.6-t2v': {
    replicate: 'wan-video/wan-2.6-t2v',
    falai: {
      'text-to-video': 'fal-ai/wan-video/v2.6/text-to-video',
    },
    gateway: 'wan-video/wan-2.6-t2v',
  },
  'wan-2.5-t2v': {
    replicate: 'wan-video/wan-2.5-t2v',
    falai: {
      'text-to-video': 'fal-ai/wan-video/v2/text-to-video',
    },
    gateway: 'wan-video/wan-2.5-t2v',
  },
  'wan-2.6-i2v-flash': {
    replicate: 'wan-video/wan2.6-i2v-flash',
    falai: {
      'image-to-video': 'fal-ai/wan-video/v2.6/flash/image-to-video',
    },
    gateway: 'wan-video/wan2.6-i2v-flash',
  },
  
  // Google Veo Models
  'veo-3.1-fast': {
    replicate: 'google/veo-3.1-fast',
    falai: {
      'text-to-video': 'fal-ai/veo3.1/fast',
      'image-to-video': 'fal-ai/veo3.1/fast/image-to-video',
    },
    gateway: 'google/veo-3.1-fast',
  },
  'veo-3.1-lite': {
    replicate: 'google/veo-3.1-lite',
    falai: {
      'text-to-video': 'fal-ai/veo3.1/lite',
      'image-to-video': 'fal-ai/veo3.1/lite/image-to-video',
    },
    gateway: 'google/veo-3.1-lite',
  },
  'veo-3.1-pro': {
    replicate: 'google/veo-3.1-pro',
    falai: {
      'text-to-video': 'fal-ai/veo/3.1/pro/text-to-video',
      'image-to-video': 'fal-ai/veo/3.1/pro/image-to-video',
    },
    gateway: 'google/veo-3.1-pro',
  },
  
  // Seedance Models
  'seedance-1-5-pro-fast': {
    replicate: 'bytedance/seedance-1.5-pro',
    falai: {
      'text-to-video': 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
      'image-to-video': 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
    },
    gateway: 'bytedance/seedance-1.5-pro',
  },
  'seedance-2.0': {
    replicate: 'bytedance/seedance-2.0',
    falai: {
      'text-to-video': 'bytedance/seedance-2.0/text-to-video',
      'image-to-video': 'bytedance/seedance-2.0/image-to-video',
      'reference-to-video': 'bytedance/seedance-2.0/reference-to-video'
    },
    gateway: 'bytedance/seedance-2.0',
  },
  'seedance-2.0-fast': {
    replicate: 'bytedance/seedance-2.0-fast',
    falai: {
      'text-to-video': 'bytedance/seedance-2.0/fast/text-to-video',
      'image-to-video': 'bytedance/seedance-2.0/fast/image-to-video',
      'reference-to-video': 'bytedance/seedance-2.0/fast/reference-to-video'
    },
    gateway: 'bytedance/seedance-2.0-fast',
  },
  'seedance-2.0-mini': {
    replicate: 'bytedance/seedance-2.0-mini',
    falai: {
      'text-to-video': 'bytedance/seedance-2.0/mini/text-to-video',
      'image-to-video': 'bytedance/seedance-2.0/mini/image-to-video',
      'reference-to-video': 'bytedance/seedance-2.0/mini/reference-to-video'
    },
    gateway: 'bytedance/seedance-2.0-mini',
  },
  
  // OpenAI Sora
  'sora-2': {
    replicate: 'openai/sora-2',
    falai: {
      'text-to-video': 'fal-ai/sora-2/text-to-video',
      'image-to-video': 'fal-ai/sora-2/image-to-video',
    },
    gateway: 'openai/sora-2',
  },
  
  // Runway Models
  'runway-gen4-turbo': {
    replicate: 'runwayml/gen4-turbo',
    falai: {
      'text-to-video': 'fal-ai/runway-gen4/turbo/text-to-video',
      'image-to-video': 'fal-ai/runway-gen4/turbo/image-to-video',
    },
    gateway: 'runwayml/gen4-turbo',
  },
  'runway-gen-4.5': {
    replicate: 'runwayml/gen-4.5',
    falai: {
      'text-to-video': 'fal-ai/runway-gen4.5/text-to-video',
      'image-to-video': 'fal-ai/runway-gen4.5/image-to-video',
    },
    gateway: 'runwayml/gen-4.5',
  },
  
  // ============================================================================
  // IMAGE MODELS
  // ============================================================================
  
  // Flux Models
  'flux-dev': {
    replicate: 'black-forest-labs/flux-dev',
    falai: {
      'text-to-image': 'fal-ai/flux/dev',
      'image-to-image': 'fal-ai/flux/dev/image-to-image',
    },
    gateway: 'black-forest-labs/flux-dev',
  },
  'flux-schnell': {
    replicate: 'black-forest-labs/flux-schnell',
    falai: {
      'text-to-image': 'fal-ai/flux/schnell',
    },
    gateway: 'black-forest-labs/flux-schnell',
  },
  'flux-2-dev': {
    replicate: 'black-forest-labs/flux-2-dev',
    falai: {
      'text-to-image': 'fal-ai/flux-2',
    },
    gateway: 'black-forest-labs/flux-2-dev',
  },
  'flux-2': {
    replicate: 'black-forest-labs/flux-2-dev',
    falai: {
      'text-to-image': 'fal-ai/flux-2',
      'image-to-image': 'fal-ai/flux-2/edit'
    },
    gateway: 'black-forest-labs/flux-2-dev',
  },
  'flux-2-flash': {
    replicate: 'black-forest-labs/flux-2-flash',
    falai: {
      'text-to-image': 'fal-ai/flux-2/flash',
      'image-to-image': 'fal-ai/flux-2/flash/edit',
    },
    gateway: 'black-forest-labs/flux-2-flash',
  },
  'flux-2-pro': {
    replicate: 'black-forest-labs/flux-2-pro',
    falai: {
      'text-to-image': 'fal-ai/flux-2-pro',
      'image-to-image': 'fal-ai/flux-2-pro/edit',
    },
    gateway: 'black-forest-labs/flux-2-pro',
  },
  'flux-2-turbo': {
    replicate: 'black-forest-labs/flux-2-turbo',
    falai: {
      'text-to-image': 'fal-ai/flux-2-turbo',
      'image-to-image': 'fal-ai/flux-2-turbo/edit',
    },
    gateway: 'black-forest-labs/flux-2-turbo',
  },
  'flux-kontext-pro': {
    replicate: 'black-forest-labs/flux-kontext-pro',
    falai: {
      'image-to-image': 'fal-ai/flux-pro/kontext',
    },
    gateway: 'black-forest-labs/flux-kontext-pro',
  },
  'flux-redux': {
    replicate: 'black-forest-labs/flux-redux',
    falai: {
      'image-to-image': 'fal-ai/flux-pro/redux',
    },
    gateway: 'black-forest-labs/flux-redux',
  },
  'flux-redux-dev': {
    replicate: 'black-forest-labs/flux-redux-dev',
    falai: {
      'image-to-image': 'fal-ai/flux-pro/redux',
    },
    gateway: 'black-forest-labs/flux-redux-dev',
  },
  'flux-redux-schnell': {
    replicate: 'black-forest-labs/flux-redux-schnell',
    falai: {
      'image-to-image': 'fal-ai/flux-pro/redux',
    },
    gateway: 'black-forest-labs/flux-redux-schnell',
  },
  'flux-1.1-pro-ultra': {
    replicate: 'black-forest-labs/flux-1.1-pro-ultra',
    falai: {
      'text-to-image': 'fal-ai/flux-pro/v1.1-ultra', // not there
    },
    gateway: 'black-forest-labs/flux-1.1-pro-ultra',
  },
  'flux-1.1-pro': {
    replicate: 'black-forest-labs/flux-1.1-pro-ultra',
    falai: {
      'text-to-image': 'fal-ai/flux-pro/v1.1-ultra', // not there
    },
    gateway: 'black-forest-labs/flux-1.1-pro-ultra',
  },
  
  // Other Image Models
  'grok-imagine-image': {
    replicate: 'xai/grok-imagine-image',
    falai: {
      'text-to-image': 'xai/grok-imagine-image',
      'image-to-image': 'xai/grok-imagine-image/edit',
    },
    gateway: 'xai/grok-imagine-image',
  },
  'grok-imagine-image-quality': {
    replicate: 'xai/grok-imagine-image-quality',
    falai: {
      'text-to-image': 'xai/grok-imagine-image/quality/text-to-image',
      'image-to-image': 'xai/grok-imagine-image/quality/edit',
    },
    gateway: 'xai/grok-imagine-image-quality',
  },
  'ideogram-v3-turbo': {
    replicate: 'ideogram-ai/ideogram-v3-turbo',
    falai: {
      'text-to-image': 'fal-ai/ideogram/v3',
    },
    gateway: 'ideogram-ai/ideogram-v3-turbo',
  },
  'ideogram-v3-quality': {
    replicate: 'ideogram-ai/ideogram-v3-quality',
    falai: {
      'text-to-image': 'fal-ai/ideogram/v3',
    },
    gateway: 'ideogram-ai/ideogram-v3-quality',
  },
  'nano-banana': {
    replicate: 'google/nano-banana',
    falai: {
      'text-to-image': 'fal-ai/nano-banana',
      'image-to-image':'fal-ai/nano-banana/edit'
    },
    gateway: 'google/nano-banana',
  },
  'nano-banana-pro': {
    replicate: 'google/nano-banana-pro',
    falai: {
      'text-to-image': 'fal-ai/nano-banana-pro',
      'image-to-image':'fal-ai/nano-banana-pro/edit'
    },
    gateway: 'google/nano-banana-pro',
  },
  'nano-banana-2': {
    replicate: 'google/nano-banana-2',
    falai: {
      'text-to-image': 'fal-ai/nano-banana-2',
      'image-to-image': 'fal-ai/nano-banana-2/edit',
    },
    gateway: 'google/nano-banana-2',
  },
  'gemini-2.5-flash-image': {
    replicate: 'google/gemini-2.5-flash-image',
    falai: {
      'text-to-image': 'fal-ai/gemini-25-flash-image/edit',
    },
    gateway: 'google/gemini-2.5-flash-image',
  },
  'seedream-4': {
    replicate: 'bytedance/seedream-4',
    falai: {
      'text-to-image': 'fal-ai/bytedance/seedream/v4/text-to-image',
    },
    gateway: 'bytedance/seedream-4',
  },
  'seedream-4.5': {
    replicate: 'bytedance/seedream-4.5',
    falai: {
      'text-to-image': 'fal-ai/bytedance/seedream/v4.5/text-to-image',
      'image-to-image': 'fal-ai/bytedance/seedream/v4.5/edit',
    },
    gateway: 'bytedance/seedream-4.5',
  },
  'gen4-image-pro': {
    replicate: 'runwayml/gen4-image-pro',
    falai: {
      'text-to-image': 'fal-ai/runway-gen4/image-pro',
    },
    gateway: 'runwayml/gen4-image-pro',
  },
  'gen4-image-turbo': {
    replicate: 'runwayml/gen4-image-turbo',
    falai: {
      'text-to-image': 'fal-ai/runway-gen4/image-turbo',
    },
    gateway: 'runwayml/gen4-image-turbo',
  },
};

/**
 * Reverse map: provider-specific ID -> canonical name
 * Handles both simple strings and generation-type objects
 */
const REVERSE_MAP: Record<string, string> = Object.entries(MODEL_ID_MAP).reduce(
  (acc, [canonical, providers]) => {
    Object.entries(providers).forEach(([provider, ids]) => {
      if (typeof ids === 'string') {
        acc[ids] = canonical;
      } else {
        // For generation-type objects, map each endpoint to canonical
        Object.values(ids).forEach(endpoint => {
          if (endpoint) acc[endpoint] = canonical;
        });
      }
    });
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Detect generation type from input context
 * 
 * @param input - The input parameters for generation
 * @param mediaType - The media type (image, video, audio)
 * @returns The detected generation type
 */
export function detectGenerationType(
  input: Record<string, unknown>,
  mediaType: 'image' | 'video' | 'audio'
): GenerationType {
  if (mediaType === 'audio') return 'audio';
  
  if (mediaType === 'image') {
    // Check for image-to-image indicators (both singular and plural)
    if (input.image_url || input.image || input.input_image || 
        input.reference_image || input.reference_images) {
      return 'image-to-image';
    }
    return 'text-to-image';
  }
  
  if (mediaType === 'video') {
    // Check for reference-to-video (multiple images)
    if (input.reference_images || input.reference_videos) {
      return 'reference-to-video';
    }
    // Check for image-to-video (single image)
    if (input.image_url || input.image || input.start_image || input.input_reference) {
      return 'image-to-video';
    }
    return 'text-to-video';
  }
  
  return 'text-to-image'; // fallback
}

/**
 * Translate a model ID from any format to the target provider's format
 * 
 * @param modelId - The model ID (can be canonical or provider-specific)
 * @param targetProvider - The target provider to translate to
 * @param generationType - Optional generation type for provider-specific endpoints
 * @returns The provider-specific model ID
 */
export function translateModelId(
  modelId: string,
  targetProvider: ProviderType,
  generationType?: GenerationType
): string {
  // If already in target format, return as-is
  const existingCanonical = REVERSE_MAP[modelId];
  if (existingCanonical) {
    const mapping = MODEL_ID_MAP[existingCanonical]?.[targetProvider];
    if (mapping) {
      if (typeof mapping === 'string') return mapping;
      // For generation-type objects, use the specified type or first available
      if (generationType && mapping[generationType]) {
        return mapping[generationType]!;
      }
      // Fallback to first available endpoint
      return Object.values(mapping)[0] || modelId;
    }
  }
  
  // Check if it's already a canonical name
  const mapping = MODEL_ID_MAP[modelId]?.[targetProvider];
  if (mapping) {
    if (typeof mapping === 'string') return mapping;
    // For generation-type objects, use the specified type or first available
    if (generationType && mapping[generationType]) {
      return mapping[generationType]!;
    }
    // Fallback to first available endpoint
    return Object.values(mapping)[0] || modelId;
  }
  
  // Unknown model, pass through
  return modelId;
}

/**
 * Get the canonical name for a provider-specific model ID
 * 
 * @param providerModelId - The provider-specific model ID
 * @returns The canonical name, or the original ID if not found
 */
export function getCanonicalName(providerModelId: string): string {
  return REVERSE_MAP[providerModelId] || providerModelId;
}

/**
 * Get the provider-specific model ID for a canonical name
 * 
 * @param canonicalName - The canonical model name
 * @param provider - The target provider
 * @param generationType - Optional generation type for provider-specific endpoints
 * @returns The provider-specific model ID
 */
export function getModelIdForProvider(
  canonicalName: string,
  provider: ProviderType,
  generationType?: GenerationType
): string {
  const mapping = MODEL_ID_MAP[canonicalName]?.[provider];
  if (!mapping) return canonicalName;
  
  if (typeof mapping === 'string') return mapping;
  
  // For generation-type objects, use the specified type or first available
  if (generationType && mapping[generationType]) {
    return mapping[generationType]!;
  }
  
  return Object.values(mapping)[0] || canonicalName;
}

/**
 * Check if a model ID is in a known provider format
 */
export function isKnownModelFormat(modelId: string): boolean {
  return !!REVERSE_MAP[modelId] || !!MODEL_ID_MAP[modelId];
}
