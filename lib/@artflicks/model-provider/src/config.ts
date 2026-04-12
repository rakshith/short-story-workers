/**
 * @artflicks/model-provider Configuration
 * 
 * Model → Provider mapping configuration
 * API Keys are now centralized in ENV_KEYS.ts
 */

import { ProviderType, FactoryConfig, ProviderConfig, PROVIDER_NAMES } from './types';
import { 
  ENV_KEYS, 
  getApiKeys,
  getConfiguredKeys,
  isProviderConfigured,
} from './ENV_KEYS';

// ============================================================================
// Model → Provider Mapping
// ============================================================================

/**
 * Maps model identifiers to their primary provider
 * Priority: 1 = primary choice, 2 = fallback
 */

// Video models (from existing Replicate config)
export const VIDEO_MODEL_PROVIDER_MAP: Record<string, ProviderType> = {
  // Fal.ai video models
  'fal-ai/kling-video-v2': PROVIDER_NAMES.FALAI,
  'fal-ai/kling-video-v3': PROVIDER_NAMES.FALAI,
  'fal-ai/kling-video': PROVIDER_NAMES.FALAI,
  'fal-ai/wan-video': PROVIDER_NAMES.FALAI,
  
  // Replicate video models (Kling)
  'kwaivgi/kling-v2': PROVIDER_NAMES.REPLICATE,
  'kwaivgi/kling-v2.5-turbo-pro': PROVIDER_NAMES.REPLICATE,
  'kwaivgi/kling-v3-video': PROVIDER_NAMES.REPLICATE,
  
  // Replicate video models (Wan)
  'wan-video/wan-2.5-i2v': PROVIDER_NAMES.REPLICATE,
  'wan-video/wan-2.5-t2v': PROVIDER_NAMES.REPLICATE,
  'wan-video/wan2.6-i2v-flash': PROVIDER_NAMES.REPLICATE,
  'wan-video/wan-2.6-i2v': PROVIDER_NAMES.REPLICATE,
  'wan-video/wan-2.6-t2v': PROVIDER_NAMES.REPLICATE,
  
  // Replicate video models (Veo - Google)
  'google/veo-3.1': PROVIDER_NAMES.REPLICATE,
  'google/veo-3.1-fast': PROVIDER_NAMES.REPLICATE,
  'google/veo-3.1-lite': PROVIDER_NAMES.REPLICATE,
  'google/veo-3.1-pro': PROVIDER_NAMES.REPLICATE,
  
  // Replicate video models (Runway)
  'runwayml/gen4-turbo': PROVIDER_NAMES.REPLICATE,
  'runwayml/gen-4.5': PROVIDER_NAMES.REPLICATE,
  
  // Replicate video models (ByteDance)
  'bytedance/seedance-1-pro-fast': PROVIDER_NAMES.REPLICATE,
  
  // Replicate video models (OpenAI)
  'openai/sora-2': PROVIDER_NAMES.REPLICATE,
};

// Image models
export const IMAGE_MODEL_PROVIDER_MAP: Record<string, ProviderType> = {
  // Fal.ai image models
  'fal-ai/flux-dev': PROVIDER_NAMES.FALAI,
  'fal-ai/flux-schnell': PROVIDER_NAMES.FALAI,
  'fal-ai/flux-realism': PROVIDER_NAMES.FALAI,
  
  // Replicate image models (Flux)
  'black-forest-labs/flux-dev': PROVIDER_NAMES.REPLICATE,
  'black-forest-labs/flux-schnell': PROVIDER_NAMES.REPLICATE,
  'black-forest-labs/flux-kontext-pro': PROVIDER_NAMES.REPLICATE,
  'black-forest-labs/flux-redux': PROVIDER_NAMES.REPLICATE,
  'black-forest-labs/flux-redux-dev': PROVIDER_NAMES.REPLICATE,
  'black-forest-labs/flux-1.1-pro-ultra': PROVIDER_NAMES.REPLICATE,
  'black-forest-labs/flux-2-dev': PROVIDER_NAMES.REPLICATE,
  
  // Replicate image models (Others)
  'xai/grok-imagine-image': PROVIDER_NAMES.REPLICATE,
  'midjourney/mj-platform': PROVIDER_NAMES.REPLICATE,
};

// Audio/TTS models
export const AUDIO_MODEL_PROVIDER_MAP: Record<string, ProviderType> = {
  // ElevenLabs (via Replicate)
  'eleven_monolingual': PROVIDER_NAMES.REPLICATE,
  'eleven_multilingual': PROVIDER_NAMES.REPLICATE,
  'eleven_turbo_v2_5': PROVIDER_NAMES.REPLICATE,
  
  // OpenAI TTS
  'openai/tts-1': PROVIDER_NAMES.REPLICATE,
  'openai/tts-1-hd': PROVIDER_NAMES.REPLICATE,
  
  // Fal.ai audio (if available)
  'fal-ai/tts': PROVIDER_NAMES.FALAI,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get provider for a model
 */
export function getProviderForModel(
  modelId: string,
  mediaType: 'video' | 'image' | 'audio'
): ProviderType | undefined {
  const modelMap = mediaType === 'video' 
    ? VIDEO_MODEL_PROVIDER_MAP 
    : mediaType === 'image'
    ? IMAGE_MODEL_PROVIDER_MAP
    : AUDIO_MODEL_PROVIDER_MAP;
  
  // Exact match
  if (modelMap[modelId]) {
    return modelMap[modelId];
  }
  
  // Partial match (check if modelId contains the key)
  for (const [key, provider] of Object.entries(modelMap)) {
    if (modelId.includes(key)) {
      return provider;
    }
  }
  
  // Default - return undefined (factory will use configured default)
  return undefined as ProviderType | undefined;
}

// ============================================================================
// Factory Configuration (can be overridden via env vars)
// ============================================================================

/**
 * Get factory configuration from environment or defaults
 */
export function getFactoryConfig(): FactoryConfig {
  const keys = getApiKeys();
  
  // Use browser window or Node.js process.env
  const isBrowser = typeof window !== 'undefined';
  const env = isBrowser ? (window as any).__CONFIG__ : null;
  
  // Primary provider - try browser env, then node env, then default
  const primary = (isBrowser ? env?.primary : keys.PRIMARY_PROVIDER) as ProviderType | undefined;
  const fallback = (isBrowser ? env?.fallback : keys.FALLBACK_PROVIDER) as ProviderType | undefined;
  const retryAttemptsStr = isBrowser ? env?.retryAttempts : keys.RETRY_ATTEMPTS;
  const retryAttempts = parseInt(retryAttemptsStr || '2', 10);
  
  // Get provider configurations
  const replicateEnabled = isProviderConfigured(PROVIDER_NAMES.REPLICATE);
  const falaiEnabled = isProviderConfigured(PROVIDER_NAMES.FALAI);
  const gatewayEnabled = isProviderConfigured(PROVIDER_NAMES.GATEWAY);
  
  // Default configuration
  const config: FactoryConfig = {
    primary: primary || (falaiEnabled ? PROVIDER_NAMES.FALAI : replicateEnabled ? PROVIDER_NAMES.REPLICATE : PROVIDER_NAMES.FALAI),
    fallback: fallback || (replicateEnabled ? PROVIDER_NAMES.REPLICATE : PROVIDER_NAMES.FALAI),
    retryAttempts: retryAttempts || 2,
    providers: {
      replicate: { enabled: replicateEnabled },
      falai: { enabled: falaiEnabled },
      gateway: { 
        enabled: gatewayEnabled,
        apiUrl: isBrowser ? env?.gatewayUrl : keys.CF_AI_GATEWAY_URL,
      },
    },
  };
  
  return config;
}

/**
 * Set factory config (for client-side usage)
 */
export function setFactoryConfig(config: Partial<FactoryConfig>): void {
  if (typeof window !== 'undefined') {
    (window as any).__CONFIG__ = {
      ...(window as any).__CONFIG__,
      primary: config.primary,
      fallback: config.fallback,
      retryAttempts: config.retryAttempts?.toString(),
      gatewayUrl: config.providers?.gateway?.apiUrl,
    };
  }
}

// ============================================================================
// Default Provider Selection
// ============================================================================

export const DEFAULT_PROVIDER: ProviderType = PROVIDER_NAMES.FALAI;
export const DEFAULT_FALLBACK_PROVIDER: ProviderType = PROVIDER_NAMES.REPLICATE;
export const DEFAULT_RETRY_ATTEMPTS = 1;

// Re-export from ENV_KEYS for convenience
export { getConfiguredKeys, isProviderConfigured };