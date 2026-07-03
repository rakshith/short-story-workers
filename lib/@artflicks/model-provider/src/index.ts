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
export type { SeedanceGenerationType } from './config';

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
  getProviderAndModelId,
  resolveProvider,
  getProviderWithOverride,
} from './factory';

// ============================================================================
// Model ID Mapping
// ============================================================================

export {
  translateModelId,
  getCanonicalName,
  getModelIdForProvider,
  isKnownModelFormat,
  detectGenerationType,
  MODEL_ID_MAP,
} from './model-map';
export type { GenerationType, ProviderModelIds } from './model-map';

// ============================================================================
// Input Field Mapping
// ============================================================================

export {
  getInputFieldsForModel,
  attachImageInputsForProvider,
  applyDefaultInputs,
  shouldIgnoreWidthHeight,
  getExcludedFields,
  INPUT_FIELD_MAP,
} from './input-fields';
export type { ModelFieldConfig } from './input-fields';

// ============================================================================
// Duration Configuration
// ============================================================================

export {
  getNearestDuration,
  MODEL_DURATION_OPTIONS,
} from './duration-config';

// ============================================================================
// Webhook Strategy
// ============================================================================

export {
  WebhookStrategyFactory,
  ReplicateWebhookStrategy,
  FalWebhookStrategy,
} from './webhook-strategy';
export type { IWebhookStrategy, WebhookStatus } from './webhook-strategy';

// ============================================================================
// Webhook URL
// ============================================================================

export {
  buildWebhookUrl,
  getWebhookEndpoint,
  detectProviderFromWebhookUrl,
  buildWebhookMetadata,
  WEBHOOK_METADATA_KEYS,
  WEBHOOK_ENDPOINTS,
} from './webhook-url';

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
// Video Pricing (Shared with Cloudflare Workers)
// ============================================================================

export {
  getVideoModelConfig,
  getResolutionCreditCost,
  getVideoCreditCost,
  getAllVideoModels,
  isVideoModel,
} from './video-pricing';
export type { VideoModelConfig } from './video-pricing';

// ============================================================================
// Tier Pricing (Tier-to-Model Mappings)
// ============================================================================

export {
  getTierModel,
  getTierModelForProvider,
  getAvatarTierModel,
  getAvatarTierModelForProvider,
  getImageTierModel,
  getImageTierModelForProvider,
  validateTierModels,
  tierModels,
} from './tier-pricing';
export type { TemplateType } from './tier-pricing';

// ============================================================================
// Convenience Types
// ============================================================================

export type { ModelProvider } from './types';
export type { ProviderType } from './types';
export type { MediaType } from './types';