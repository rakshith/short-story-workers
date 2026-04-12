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
  DEFAULT_PROVIDER,
  DEFAULT_FALLBACK_PROVIDER,
  DEFAULT_RETRY_ATTEMPTS,
} from './config';

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
 * Get provider for a specific model
 * Uses config to determine primary and fallback
 */
  static getProviderForModel(
    modelId: string,
    mediaType: 'video' | 'image' | 'audio',
    config?: Partial<FactoryConfig>
  ): ModelProvider {
    const cfg = config || getFactoryConfig();
    
    const resolvedProviderType = getProviderForModel(modelId, mediaType) ?? cfg.primary;
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