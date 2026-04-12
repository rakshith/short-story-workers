/**
 * @artflicks/model-provider
 * 
 * Unified model provider abstraction layer
 * Supports Replicate, Fal.ai, and Cloudflare AI Gateway
 * 
 * Usage:
 * 
 * // Get specific provider
 * import { ModelProviderFactory, getReplicateProvider, getFalProvider } from '@artflicks/model-provider';
 * 
 * const provider = getReplicateProvider();
 * const result = await provider.generateVideo('kling-v2', { prompt: '...' });
 * 
 * // Get provider with automatic fallback
 * const providerWithFallback = ModelProviderFactory.getProvider('fal', 'replicate');
 * 
 * // Get provider for specific model
 * import { getProviderForVideo } from '@artflicks/model-provider';
 * const provider = getProviderForVideo('wan-video/wan-2.6');
 * 
 * // Health check
 * import { checkProviderHealth } from '@artflicks/model-provider';
 * const health = await checkProviderHealth();
 */

// ============================================================================
// Types
// ============================================================================

export * from './types';

// ============================================================================
// API Keys (Centralized)
// ============================================================================

export * from './ENV_KEYS';

// ============================================================================
// Config
// ============================================================================

export * from './config';

// ============================================================================
// Factory
// ============================================================================

export { 
  ModelProviderFactory,
  FallbackProvider,
  getReplicateProvider,
  getFalProvider,
  getGatewayProvider,
  getProviderForVideo,
  getProviderForImage,
  getProviderForAudio,
  checkProviderHealth,
} from './factory';

// ============================================================================
// Providers
// ============================================================================

export { 
  BaseProvider, 
  HealthyProviderWrapper,
  extractImageUrls,
  extractVideoUrl,
  extractAudioUrl,
} from './providers/base';
export { ReplicateProvider, createReplicateProvider } from './providers/replicate';
export { FalProvider, createFalProvider } from './providers/fal';
export { GatewayProvider, createGatewayProvider } from './providers/gateway';

// ============================================================================
// Convenience Types
// ============================================================================

export type { ModelProvider } from './types';
export type { ProviderType } from './types';
export type { MediaType } from './types';