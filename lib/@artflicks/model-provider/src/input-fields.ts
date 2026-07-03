/**
 * Input Field Mapping
 * 
 * Maps provider-specific input field names for each model family.
 * Different providers use different field names for the same concept.
 */

import { ProviderType } from './types';

/**
 * Configuration for how to attach image inputs to a model
 */
export interface ModelFieldConfig {
  /** Field name for single image input */
  singleField?: string;
  /** Field name for multiple image inputs */
  multiField?: string;
  /** Whether to also set single field when multi images provided */
  setSingleFromFirst?: boolean;
  /** Minimum width required by the model */
  minWidth?: number;
  /** Default input parameters to apply for this model */
  defaultInputs?: Record<string, unknown>;
  /** If true, width and height will not be sent to the model */
  ignoreWidthHeight?: boolean;
  /** Fields to exclude from the input */
  excludeFields?: string[];
}

/**
 * Provider-specific field configurations
 * 
 * Key: model pattern (matched against model name, case-insensitive)
 * Value: configuration for how to attach image inputs
 */
export const INPUT_FIELD_MAP: Record<ProviderType, Record<string, ModelFieldConfig>> = {
  // ============================================================================
  // REPLICATE FIELD CONFIGS
  // ============================================================================
  replicate: {
    // Flux Models
    'flux-redux-schnell': { singleField: 'redux_image' },
    'flux-redux': { multiField: 'reference_images' },
    'flux-dev': { singleField: 'image' },
    'flux-2-dev': { multiField: 'input_images', defaultInputs: { disable_safety_checker: false } },
    'flux-redux-dev': { singleField: 'redux_image' },
    'flux-1.1-pro-ultra': { singleField: 'image_prompt' },
    'flux-kontext-pro': { singleField: 'input_image' },
    
    // Other Image Models
    'grok-imagine-image': { singleField: 'image', setSingleFromFirst: true },
    'ideogram-v3-turbo': { singleField: 'image' },
    'ideogram-v3-quality': { singleField: 'image' },
    'nano-banana': { multiField: 'image_input' },
    'nano-banana-pro': { multiField: 'image_input', defaultInputs: { resolution: '2K' } },
    'gemini-2.5-flash-image': { multiField: 'image_input' },
    'seedream-4': { 
      multiField: 'image_input', 
      defaultInputs: { size: '4K' }, 
      ignoreWidthHeight: true, 
      excludeFields: ['num_outputs', 'output_format', 'output_quality', 'seed'] 
    },
    'seedream-4.5': { 
      multiField: 'image_input', 
      defaultInputs: { size: '4K' }, 
      ignoreWidthHeight: true, 
      excludeFields: ['num_outputs', 'output_format', 'output_quality', 'seed'] 
    },
    'gen4-image-pro': { singleField: 'image' },
    'gen4-image-turbo': { multiField: 'reference_images' },
    
    // Video Models
    'sora-2': { singleField: 'input_reference' },
    'veo-3.1-fast': { singleField: 'image', defaultInputs: { generate_audio: false } },
    'veo-3.1-lite': { singleField: 'image' },
    'veo-3.1-pro': { singleField: 'image', defaultInputs: { generate_audio: false } },
    'seedance-1.5-pro': { singleField: 'image' },
    'wan-2.5-i2v': { singleField: 'image' },
    'wan-2.5-i2v-fast': { singleField: 'image' },
    'wan-2.6-i2v': { singleField: 'image' },
    'wan-2.6-t2v': { singleField: 'image' },
    'wan-2.5-t2v': { singleField: 'image' },
    'wan2.6-i2v-flash': { singleField: 'image', defaultInputs: { audio_enabled: false } },
    'kling-v2.6': { singleField: 'start_image', defaultInputs: { generate_audio: false } },
    'kling-v2.5-turbo': { singleField: 'start_image' },
    'kling-v2.1-master': { singleField: 'start_image' },
    'kling-v2.1': { singleField: 'start_image' },
    'kling-v1.6-standard': { singleField: 'start_image' },
    'kling-v3': { singleField: 'start_image', defaultInputs: { generate_audio: false } },
    'kling-avatar-v2': { singleField: 'image', defaultInputs: {} },
    'runway-gen4-turbo': { singleField: 'image' },
    'runway-gen-4.5': { singleField: 'image' },
  },
  
  // ============================================================================
  // FAL.AI FIELD CONFIGS
  // ============================================================================
  falai: {
    // Kling Models - Note: Different field names than Replicate
    'kling-video/v2.6': { singleField: 'image_url' },
    'kling-video/v2/standard': { singleField: 'start_image_url' },
    'kling-video/v2.5-turbo': { singleField: 'image_url' },
    'kling-video/v2.1': { singleField: 'start_image_url' },
    'kling-video/v1.6': { singleField: 'start_image_url' },
    'kling-video/v3': { singleField: 'start_image_url' },
    'kling-video/v2/standard/avatar': { singleField: 'image_url', defaultInputs: {} },
    
    // Wan Models
    'wan-video/v2/image-to-video': { singleField: 'image_url' },
    'wan-video/v2/fast': { singleField: 'image_url' },
    'wan-video/v2.6': { singleField: 'image_url' },
    'wan-video/v2.6/flash': { singleField: 'image_url', defaultInputs: { audio_enabled: false } },
    'wan-video/v2/text-to-video': { singleField: 'image_url' },
    
    // Seedance Models
    'seedance/v1.5': { singleField: 'image_url' },
    'seedance/v1/pro': { singleField: 'image_url' },
    'seedance-2.0': { singleField: 'image_url' },
    'seedance-2.0/fast': { singleField: 'image_url' },
    
    // Veo Models
    'veo3.1': { singleField: 'image_url', defaultInputs: { generate_audio: false } },
    
    // Sora Models
    'sora-2': { singleField: 'image_url' },
    
    // Runway Models
    'runway-gen4': { singleField: 'image_url' },
    'runway-gen4.5': { singleField: 'image_url' },
    
    // Image Models
    'flux/dev': { singleField: 'image_url' },
    'flux/schnell': { singleField: 'image_url' },
    'flux-2': { singleField: 'image_url' },
    'flux-2-pro': { singleField: 'image_url' },
    'flux-pro/kontext': { singleField: 'image_url' },
    'flux-pro/redux': { singleField: 'image_url' },
    'flux-pro/ultra': { singleField: 'image_url' },
    'flux-pro/v1.1-ultra': { singleField: 'image_url' },
    
    'ideogram/v3': { singleField: 'image_url' },
    'nano-banana': { singleField: 'image_url' },
    'nano-banana-pro': { singleField: 'image_url' },
    'nano-banana-2': { singleField: 'image_url' },
    'gemini-25-flash': { singleField: 'image_url' },
    'bytedance/seedream/v4': { singleField: 'image_url', ignoreWidthHeight: true },
    'bytedance/seedream/v4.5': { singleField: 'image_url', ignoreWidthHeight: true },
  },
  
  // ============================================================================
  // GATEWAY FIELD CONFIGS (same as Replicate for now)
  // ============================================================================
  gateway: {
    // Same as Replicate
    'kling': { singleField: 'start_image' },
    'wan-video': { singleField: 'image' },
    'veo': { singleField: 'image' },
    'seedance': { singleField: 'image' },
    'flux': { singleField: 'image' },
  },
};

/**
 * Get the field configuration for a model and provider
 * 
 * Matching priority:
 * 1. Exact match (full model ID)
 * 2. Longest matching pattern (more specific patterns win)
 * 3. Default fallback
 * 
 * @param modelId - The provider-specific model ID
 * @param provider - The provider type
 * @returns The field configuration for the model
 */
export function getInputFieldsForModel(
  modelId: string,
  provider: ProviderType
): ModelFieldConfig {
  const providerConfig = INPUT_FIELD_MAP[provider];
  if (!providerConfig) {
    return {};
  }
  
  const lowerModel = modelId.toLowerCase();
  
  // Try exact match first
  if (providerConfig[lowerModel]) {
    return providerConfig[lowerModel];
  }
  
  // Find all matching patterns and sort by length (longest first = most specific)
  const matches: Array<[string, ModelFieldConfig]> = [];
  for (const [pattern, config] of Object.entries(providerConfig)) {
    if (lowerModel.includes(pattern.toLowerCase())) {
      matches.push([pattern, config]);
    }
  }
  
  // Sort by pattern length (longest first) to prefer more specific matches
  matches.sort((a, b) => b[0].length - a[0].length);
  
  if (matches.length > 0) {
    return matches[0][1];
  }
  
  // Default fallback
  return { singleField: 'image_url' };
}

/**
 * Attach image inputs to the input object based on model and provider
 * 
 * @param input - The input object to modify
 * @param modelId - The provider-specific model ID
 * @param provider - The provider type
 * @param images - Array of image URLs to attach
 * @returns Object with field names that were set
 */
export function attachImageInputsForProvider(
  input: Record<string, unknown>,
  modelId: string,
  provider: ProviderType,
  images: string[] | undefined
): { singleField?: string; multiField?: string } {
  if (!images || images.length === 0) return {};
  
  const config = getInputFieldsForModel(modelId, provider);
  const result: { singleField?: string; multiField?: string } = {};
  
  // Attach multi-image field if configured
  if (config.multiField) {
    input[config.multiField] = images;
    result.multiField = config.multiField;
  }
  
  // Attach single image field
  if (config.singleField) {
    if (images.length === 1 || config.setSingleFromFirst) {
      input[config.singleField] = images[0];
      result.singleField = config.singleField;
    }
  }
  
  return result;
}

/**
 * Apply default inputs for a model and provider
 * 
 * @param input - The input object to modify
 * @param modelId - The provider-specific model ID
 * @param provider - The provider type
 */
export function applyDefaultInputs(
  input: Record<string, unknown>,
  modelId: string,
  provider: ProviderType
): void {
  const config = getInputFieldsForModel(modelId, provider);
  if (config.defaultInputs) {
    Object.assign(input, config.defaultInputs);
  }
}

/**
 * Check if width/height should be ignored for a model
 */
export function shouldIgnoreWidthHeight(
  modelId: string,
  provider: ProviderType
): boolean {
  const config = getInputFieldsForModel(modelId, provider);
  return config.ignoreWidthHeight === true;
}

/**
 * Get fields to exclude for a model
 */
export function getExcludedFields(
  modelId: string,
  provider: ProviderType
): string[] {
  const config = getInputFieldsForModel(modelId, provider);
  return config.excludeFields || [];
}
