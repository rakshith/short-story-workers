/**
 * Base Provider Interface
 * 
 * Abstract base class that all providers must implement
 * Also exports utility functions for extracting URLs from various response formats
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
  HealthStatus,
} from '../types';

import { getApiKeys } from '../ENV_KEYS';

/**
 * Extract image URLs from various response formats
 * Reuses logic from provider-lib.ts (fal.ai / replicate)
 */
export function extractImageUrls(data: any): string[] {
  // Handle Fal.ai format: result?.data?.images or result?.data?.image
  if (data?.data?.images) return Array.isArray(data.data.images) ? data.data.images : [data.data.images];
  if (data?.data?.image) return [data.data.image];
  
  // Handle Replicate format: result?.output (array or single)
  if (data?.output) {
    if (Array.isArray(data.output)) {
      return data.output.map((item: any) => {
        // Handle url as function (Replicate SDK returns objects with url() methods)
        if (item?.url && typeof item.url === 'function') {
          return item.url();
        }
        return item?.url || item;
      }).filter(Boolean);
    }
    if (data.output.url) {
      // Handle url as function
      if (typeof data.output.url === 'function') {
        return [data.output.url()];
      }
      return [data.output.url];
    }
    if (typeof data.output === 'string') return [data.output];
  }
  
  // Handle direct array
  if (Array.isArray(data)) {
    return data.map((item: any) => {
      // Handle url as function
      if (item?.url && typeof item.url === 'function') {
        return item.url();
      }
      return item?.url || item?.image || item;
    }).filter(Boolean);
  }
  
  // Handle object with common properties
  if (data?.url) {
    // Handle url as function
    if (typeof data.url === 'function') {
      return [data.url()];
    }
    return [data.url];
  }
  if (data?.imageUrl) return [data.imageUrl];
  if (data?.image_url) return [data.image_url];
  if (data?.image) return [data.image];
  
  // Handle single string
  if (typeof data === 'string') return [data];
  
  return [];
}

/**
 * Extract video URL from various response formats
 */
export function extractVideoUrl(data: any): string | null {
  // Fal.ai format
  if (data?.data?.video?.url) {
    if (typeof data.data.video.url === 'function') return data.data.video.url();
    return data.data.video.url;
  }
  if (data?.data?.videos?.[0]?.url) {
    const url = data.data.videos[0].url;
    if (typeof url === 'function') return url();
    return url;
  }
  
  // Replicate format
  if (data?.output?.url) {
    if (typeof data.output.url === 'function') return data.output.url();
    return data.output.url;
  }
  if (data?.output?.[0]?.url) {
    const url = data.output[0].url;
    if (typeof url === 'function') return url();
    return url;
  }
  
  // Direct array
  if (Array.isArray(data)) {
    const item = data[0];
    if (item?.url && typeof item.url === 'function') return item.url();
    return item?.url || item?.video || item?.videoUrl || null;
  }
  
  // Object properties
  if (data?.url) {
    if (typeof data.url === 'function') return data.url();
    return data.url;
  }
  if (data?.videoUrl) {
    if (typeof data.videoUrl === 'function') return data.videoUrl();
    return data.videoUrl;
  }
  if (data?.video_url) return data.video_url;
  if (data?.video) return data.video;
  
  // Single string
  if (typeof data === 'string') return data;
  
  return null;
}

/**
 * Extract audio URL from various response formats
 */
export function extractAudioUrl(data: any): string | null {
  // Fal.ai format
  if (data?.data?.audio?.url) {
    if (typeof data.data.audio.url === 'function') return data.data.audio.url();
    return data.data.audio.url;
  }
  if (data?.data?.audio?.[0]?.url) {
    const url = data.data.audio[0].url;
    if (typeof url === 'function') return url();
    return url;
  }
  
  // Replicate format
  if (data?.output?.url) {
    if (typeof data.output.url === 'function') return data.output.url();
    return data.output.url;
  }
  if (data?.output?.[0]?.url) {
    const url = data.output[0].url;
    if (typeof url === 'function') return url();
    return url;
  }
  
  // Direct array
  if (Array.isArray(data)) {
    const item = data[0];
    if (item?.url && typeof item.url === 'function') return item.url();
    return item?.url || item?.audio || item?.audioUrl || null;
  }
  
  // Object properties
  if (data?.url) {
    if (typeof data.url === 'function') return data.url();
    return data.url;
  }
  if (data?.audioUrl) {
    if (typeof data.audioUrl === 'function') return data.audioUrl();
    return data.audioUrl;
  }
  if (data?.audio_url) return data.audio_url;
  if (data?.audio) return data.audio;
  
  // Single string
  if (typeof data === 'string') return data;
  
  return null;
}

/**
 * Parse image response using extractImageUrls
 */
export function parseImageResponse(data: any): ImageResult {
  const imageUrls = extractImageUrls(data);
  const url = imageUrls[0] || '';
  
  if (!url) {
    throw new Error('No image URL in response');
  }
  
  return {
    imageUrls,
    url,
  };
}

/**
 * Parse video response using extractVideoUrl
 */
export function parseVideoResponse(data: any): VideoResult {
  const url = extractVideoUrl(data);
  
  if (!url) {
    throw new Error('No video URL in response');
  }
  
  return {
    videoUrl: url,
    url,
  };
}

/**
 * Parse audio response using extractAudioUrl
 */
export function parseAudioResponse(data: any): AudioResult {
  const url = extractAudioUrl(data);
  
  if (!url) {
    throw new Error('No audio URL in response');
  }
  
  return {
    audioUrl: url,
    url,
  };
}

/**
 * Abstract base provider class
 */
export abstract class BaseProvider implements ModelProvider {
  abstract readonly providerType: ProviderType;
  
  abstract healthCheck(): Promise<boolean>;
  
  abstract generateImage(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<ImageResult>;
  
  abstract generateVideo(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<VideoResult>;
  
  abstract generateAudio(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<AudioResult>;
  
  getProviderType(): ProviderType {
    return this.providerType;
  }

  /**
   * Build common headers for API requests
   */
  protected buildHeaders(apiKey: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  /**
   * Parse error from provider response
   */
  protected parseError(status: number, data: any): Error {
    const message = data?.error?.message || data?.message || 'Unknown error';
    return new Error(message);
  }

  /**
   * Validate provider is enabled
   */
  protected validateEnabled(): void {
    if (!this.isEnabled()) {
      throw new Error(
        `Provider ${this.providerType} is not enabled. Please configure API keys.`
      );
    }
  }

  /**
   * Check if provider is enabled (subclass should override)
   */
  protected isEnabled(): boolean {
    return true;
  }

  /**
   * Get environment variable value
   */
  protected getEnvVar(key: string): string | undefined {
    const keys = getApiKeys();
    return keys[key];
  }
}

/**
 * Provider with health status tracking
 */
export abstract class HealthyProviderWrapper extends BaseProvider {
  protected healthStatus: HealthStatus = {
    provider: 'replicate' as ProviderType,
    healthy: false,
    latency: 0,
  };
  
  /**
   * Update health status after check
   */
  protected updateHealthStatus(
    healthy: boolean,
    latencyMs?: number,
    error?: string
  ): void {
    this.healthStatus = {
      provider: this.providerType,
      healthy,
      latency: latencyMs,
      error,
    };
  }
}