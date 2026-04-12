/**
 * Cloudflare AI Gateway Provider Implementation
 * 
 * Routes requests through Cloudflare AI Gateway
 * Handles failover automatically via Gateway configuration
 */

import { BaseProvider, HealthyProviderWrapper, parseImageResponse, parseVideoResponse, parseAudioResponse } from './base';
import { 
  ProviderType,
  ImageInput,
  VideoInput,
  AudioInput,
  ImageResult,
  VideoResult,
  AudioResult,
  ImageGenerationOptions,
  VideoGenerationOptions,
  AudioGenerationOptions,
} from '../types';

import { getCloudflareKeys } from '../ENV_KEYS';

/**
 * Cloudflare AI Gateway Provider
 */
export class GatewayProvider extends HealthyProviderWrapper {
  readonly providerType: ProviderType = 'gateway';
  
  private apiToken: string;
  private gatewayUrl: string;
  
  constructor(apiToken?: string, gatewayUrl?: string) {
    super();
    const cfKeys = getCloudflareKeys();
    this.apiToken = apiToken || cfKeys.apiToken || '';
    this.gatewayUrl = gatewayUrl || cfKeys.gatewayUrl || '';
  }
  
  /**
   * Check if provider is enabled
   */
  protected isEnabled(): boolean {
    return !!this.apiToken && !!this.gatewayUrl;
  }
  
  /**
   * Health check for AI Gateway
   */
  async healthCheck(): Promise<boolean> {
    const start = Date.now();
    try {
      const response = await fetch(this.gatewayUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });
      
      const healthy = response.ok;
      this.updateHealthStatus(healthy, Date.now() - start);
      return healthy;
    } catch (error) {
      this.updateHealthStatus(false, undefined, String(error));
      return false;
    }
  }
  
  /**
   * Generate image via AI Gateway
   */
  async generateImage(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<ImageResult> {
    this.validateEnabled();
    
    const body = {
      model,
      input: {
        prompt: input.prompt,
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(input.imageUrl && { image_url: input.imageUrl }),
        ...(options?.width && { width: options.width }),
        ...(options?.height && { height: options.height }),
        ...(options?.guidance && { guidance: options.guidance }),
        ...(options?.seed && { seed: options.seed }),
      },
    };
    
    const result = await this.createRequest(body, options?.timeout);
    return parseImageResponse(result);
  }
  
  /**
   * Generate video via AI Gateway
   */
  async generateVideo(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<VideoResult> {
    this.validateEnabled();
    
    const body = {
      model,
      input: {
        ...(input.prompt && { prompt: input.prompt }),
        ...(input.imageUrl && { image_url: input.imageUrl }),
        ...(input.firstImageUrl && { first_image_url: input.firstImageUrl }),
        ...(input.audioUrl && { audio_url: input.audioUrl }),
        ...(input.duration && { duration: input.duration }),
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(options?.guidance && { guidance: options.guidance }),
        ...(options?.fps && { fps: options.fps }),
      },
    };
    
    const result = await this.createRequest(body, options?.timeout);
    return parseVideoResponse(result);
  }
  
  /**
   * Generate audio via AI Gateway
   */
  async generateAudio(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<AudioResult> {
    this.validateEnabled();
    
    const body = {
      model,
      input: {
        text: input.text,
        ...(input.voice && { voice_id: input.voice }),
        ...(input.language && { language: input.language }),
        ...(input.speed && { speed: input.speed }),
      },
    };
    
    const result = await this.createRequest(body, options?.timeout);
    return parseAudioResponse(result);
  }
  
  /**
   * Create request via AI Gateway
   */
  private async createRequest(
    body: any,
    timeout: number = 120000
  ): Promise<any> {
    // Gateway uses POST to create inference
    const response = await fetch(this.gatewayUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw this.parseError(response.status, error);
    }
    
    const result = await response.json();
    return result;
  }
}

/**
 * Create configured Gateway provider
 */
export function createGatewayProvider(apiToken?: string, gatewayUrl?: string): GatewayProvider {
  return new GatewayProvider(apiToken, gatewayUrl);
}