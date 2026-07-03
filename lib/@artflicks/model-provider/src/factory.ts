/**
 * Model Provider Factory
 * 
 * Factory for creating provider instances with automatic fallback
 */

import type { 
  ModelProvider, 
  ProviderType, 
  MediaType,
  ImageInput,
  VideoInput,
  AudioInput,
  ImageResult,
  VideoResult,
  AudioResult,
  ImageGenerationOptions,
  VideoGenerationOptions,
  AudioGenerationOptions,
  FactoryConfig,
  ProviderConfig,
  ProviderHealthMap,
  HealthStatus,
} from './types';

import { PROVIDER_NAMES } from './types';

import { 
  getFactoryConfig,
  getProviderForModel,
  getActualModelId,
  DEFAULT_PROVIDER,
  DEFAULT_FALLBACK_PROVIDER,
  DEFAULT_RETRY_ATTEMPTS,
  SeedanceGenerationType,
} from './config';

import { translateModelId, GenerationType, detectGenerationType } from './model-map';

import { ReplicateProvider } from './providers/replicate';
import { FalProvider } from './providers/fal';
import { GatewayProvider } from './providers/gateway';

/**
 * Provider with automatic fallback
 */
export class FallbackProvider implements ModelProvider {
  constructor(
    private primary: ModelProvider,
    private fallback: ModelProvider,
    private retryAttempts: number = DEFAULT_RETRY_ATTEMPTS
  ) {}
  
  getProviderType(): ProviderType {
    return this.primary.getProviderType();
  }
  
  async healthCheck(): Promise<boolean> {
    return this.primary.healthCheck().catch(() => false);
  }
  
  async generateImage(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<ImageResult> {
    let lastError: Error | undefined;
    const attempts = (options?.retries ?? this.retryAttempts) + 1;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.primary.generateImage(model, input, options);
      } catch (error) {
        console.log(`[FallbackProvider] Primary image generation failed (attempt ${i + 1}/${attempts}):`, error);
        lastError = error as Error;
        
        // Try fallback on last attempt
        if (i === attempts - 1 && this.fallback) {
          console.log(`[FallbackProvider] Trying fallback...`);
          return await this.fallback.generateImage(model, input, options);
        }
      }
    }
    
    throw lastError;
  }
  
  async generateVideo(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<VideoResult> {
    let lastError: Error | undefined;
    const attempts = (options?.retries ?? this.retryAttempts) + 1;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.primary.generateVideo(model, input, options);
      } catch (error) {
        console.log(`[FallbackProvider] Primary video generation failed (attempt ${i + 1}/${attempts}):`, error);
        lastError = error as Error;
        
        // Try fallback on last attempt
        if (i === attempts - 1 && this.fallback) {
          console.log(`[FallbackProvider] Trying fallback...`);
          return await this.fallback.generateVideo(model, input, options);
        }
      }
    }
    
    throw lastError;
  }
  
  async generateAudio(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<AudioResult> {
    let lastError: Error | undefined;
    const attempts = (options?.retries ?? this.retryAttempts) + 1;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.primary.generateAudio(model, input, options);
      } catch (error) {
        console.log(`[FallbackProvider] Primary audio generation failed (attempt ${i + 1}/${attempts}):`, error);
        lastError = error as Error;
        
        // Try fallback on last attempt
        if (i === attempts - 1 && this.fallback) {
          console.log(`[FallbackProvider] Trying fallback...`);
          return await this.fallback.generateAudio(model, input, options);
        }
      }
    }
    
    throw lastError;
  }
}

/**
 * Factory for creating provider instances
 */
export class ModelProviderFactory {
  /**
   * Get provider by type
   */
  static createProvider(type: ProviderType, config?: Partial<ProviderConfig>): ModelProvider {
    switch (type) {
      case PROVIDER_NAMES.REPLICATE:
        return new ReplicateProvider(config?.apiKey);
      case PROVIDER_NAMES.FALAI:
        return new FalProvider(config?.apiKey);
      case PROVIDER_NAMES.GATEWAY:
        return new GatewayProvider(config?.apiKey, config?.apiUrl);
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
  
  /**
 * Get provider for a specific model with resolved model ID
 * Handles Seedance 2.0 model ID mapping for FAL provider
 */
  static getProviderForModel(
    modelId: string,
    mediaType: 'video' | 'image' | 'audio',
    config?: Partial<FactoryConfig>,
    generationType?: SeedanceGenerationType
  ): ModelProvider {
    const cfg = config || getFactoryConfig();
    
    let resolvedProviderType = getProviderForModel(modelId, mediaType) ?? cfg.primary;
    
    // Override provider for Seedance models based on config
    const isSeedance = modelId.startsWith('bytedance/seedance');
    if (isSeedance && cfg.seedanceProvider) {
      resolvedProviderType = cfg.seedanceProvider;
    }
    
    const fallbackType = cfg.fallback;
    
    // Ensure resolvedProviderType is valid
    if (!resolvedProviderType) {
      const defaultType: ProviderType = cfg.primary ?? PROVIDER_NAMES.REPLICATE;
      return this.createProvider(defaultType, { enabled: true });
    }
    
    const providerConfig = cfg.providers?.[resolvedProviderType] ?? { enabled: true };
    const primary = this.createProvider(resolvedProviderType, providerConfig);
    
    if (fallbackType && fallbackType !== resolvedProviderType && cfg.providers) {
      const fallbackConfig = cfg.providers[fallbackType] ?? { enabled: true };
      const fallback = this.createProvider(fallbackType as ProviderType, fallbackConfig);
      return new FallbackProvider(primary, fallback, cfg.retryAttempts);
    }
    
    return primary;
  }
  
  /**
   * Get both provider and resolved model ID for a model
   * Returns the actual model ID to use based on provider and generation type
   */
  static getProviderAndModelId(
    modelId: string,
    mediaType: 'video' | 'image' | 'audio',
    generationType?: SeedanceGenerationType
  ): { provider: ModelProvider; actualModelId: string } {
    const cfg = getFactoryConfig();
    
    let resolvedProviderType = getProviderForModel(modelId, mediaType) ?? cfg.primary;
    
    // Override provider for Seedance models based on config
    const isSeedance = modelId.startsWith('bytedance/seedance');
    if (isSeedance && cfg.seedanceProvider) {
      resolvedProviderType = cfg.seedanceProvider;
    }
    
    // Get the actual model ID to use
    const actualModelId = getActualModelId(modelId, resolvedProviderType, generationType);
    
    // Get the provider (with fallback if configured)
    const provider = this.getProviderForModel(modelId, mediaType, undefined, generationType);
    
    return {
      provider,
      actualModelId,
    };
  }
  
  /**
   * Get provider with fallback (convenience method)
   */
  static getProvider(
    primary: ProviderType = DEFAULT_PROVIDER,
    fallbackProvider?: ProviderType
  ): ModelProvider {
    const config = getFactoryConfig();
    
    if (fallbackProvider && fallbackProvider !== primary) {
      const primaryProvider = this.createProvider(primary, config.providers[primary]);
      const fallback = this.createProvider(fallbackProvider, config.providers[fallbackProvider]);
      return new FallbackProvider(primaryProvider, fallback, config.retryAttempts);
    }
    
    return this.createProvider(primary, config.providers[primary]);
  }
  
  /**
   * Get provider with explicit override
   * 
   * @param provider - The explicit provider to use (from frontend request)
   * @param config - Optional provider config
   * @returns The provider instance
   */
  static getProviderWithOverride(
    provider: ProviderType,
    config?: Partial<ProviderConfig>
  ): ModelProvider {
    return this.createProvider(provider, config);
  }
  
  /**
   * Resolve provider and translate model ID in one call
   * 
   * This is the main entry point for the worker.
   * It handles:
   * 1. Provider resolution (explicit override or default)
   * 2. Model ID translation (canonical -> provider-specific)
   * 3. Provider instance creation
   * 
   * @param modelId - The model ID (canonical or provider-specific)
   * @param mediaType - The type of media (video, image, audio)
   * @param explicitProvider - Optional explicit provider from frontend
   * @param generationType - Optional generation type for Seedance models
   * @param inputContext - Optional input context for auto-detecting generation type
   * @returns Object with provider, translated model ID, and provider type
   */
  static resolveProvider(
    modelId: string,
    mediaType: 'video' | 'image' | 'audio',
    explicitProvider?: ProviderType,
    generationType?: SeedanceGenerationType,
    inputContext?: Record<string, unknown>
  ): {
    provider: ModelProvider;
    actualModelId: string;
    providerType: ProviderType;
  } {
    const cfg = getFactoryConfig();
    
    let resolvedProviderType: ProviderType;
    
    if (explicitProvider) {
      resolvedProviderType = explicitProvider;
    } else {
      resolvedProviderType = getProviderForModel(modelId, mediaType) ?? cfg.primary ?? DEFAULT_PROVIDER;
      
      const isSeedance = modelId.startsWith('bytedance/seedance');
      if (isSeedance && cfg.seedanceProvider) {
        resolvedProviderType = cfg.seedanceProvider;
      }
    }
    
    // Auto-detect generation type from input context if not provided
    const effectiveGenerationType = generationType || 
      (inputContext ? detectGenerationType(inputContext, mediaType) : undefined);
    
    const actualModelId = translateModelId(modelId, resolvedProviderType, effectiveGenerationType as any);
    
    const providerConfig = cfg.providers?.[resolvedProviderType] ?? { enabled: true };
    const provider = this.createProvider(resolvedProviderType, providerConfig);
    
    return {
      provider,
      actualModelId,
      providerType: resolvedProviderType,
    };
  }
  
  /**
   * Get health status for all providers
   */
  static async getHealthStatus(): Promise<ProviderHealthMap> {
    const config = getFactoryConfig();
    const result: ProviderHealthMap = {};
    
    const providers: { type: ProviderType; key: keyof ProviderHealthMap }[] = [
      { type: PROVIDER_NAMES.REPLICATE, key: PROVIDER_NAMES.REPLICATE },
      { type: PROVIDER_NAMES.FALAI, key: PROVIDER_NAMES.FALAI },
      { type: PROVIDER_NAMES.GATEWAY, key: PROVIDER_NAMES.GATEWAY },
    ];
    
    await Promise.all(
      providers.map(async ({ type, key }) => {
        if (config.providers[type].enabled) {
          const provider = this.createProvider(type, config.providers[type]);
          const healthy = await provider.healthCheck();
          result[key] = {
            provider: type,
            healthy,
          };
        }
      })
    );
    
    return result;
  }
}

// Convenience functions
export const getReplicateProvider = () => ModelProviderFactory.getProvider(PROVIDER_NAMES.REPLICATE);
export const getFalProvider = () => ModelProviderFactory.getProvider(PROVIDER_NAMES.FALAI);
export const getGatewayProvider = () => ModelProviderFactory.getProvider(PROVIDER_NAMES.GATEWAY);

// Get provider for specific model with fallback
export const getProviderForVideo = (modelId: string) => 
  ModelProviderFactory.getProviderForModel(modelId, 'video');

export const getProviderForImage = (modelId: string) => 
  ModelProviderFactory.getProviderForModel(modelId, 'image');

export const getProviderForAudio = (modelId: string) => 
  ModelProviderFactory.getProviderForModel(modelId, 'audio');

// Health check
export const checkProviderHealth = () => ModelProviderFactory.getHealthStatus();

// Get provider and resolved model ID for Seedance models
export const getProviderAndModelId = (
  modelId: string,
  mediaType: 'video' | 'image' | 'audio',
  generationType?: SeedanceGenerationType
) => ModelProviderFactory.getProviderAndModelId(modelId, mediaType, generationType);

// Resolve provider with explicit override support
export const resolveProvider = (
  modelId: string,
  mediaType: 'video' | 'image' | 'audio',
  explicitProvider?: ProviderType,
  generationType?: SeedanceGenerationType,
  inputContext?: Record<string, unknown>
) => ModelProviderFactory.resolveProvider(modelId, mediaType, explicitProvider, generationType, inputContext);

// Get provider with explicit override
export const getProviderWithOverride = (
  provider: ProviderType,
  config?: Partial<ProviderConfig>
) => ModelProviderFactory.getProviderWithOverride(provider, config);