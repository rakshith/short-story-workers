/**
 * Fal.ai Provider Implementation
 * 
 * Handles video, image, and audio generation via Fal.ai SDK
 */

import { fal } from '@fal-ai/client';

import { BaseProvider, HealthyProviderWrapper, extractImageUrls, extractVideoUrl, extractAudioUrl, parseImageResponse, parseVideoResponse, parseAudioResponse } from './base';
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

import { getFalKey } from '../ENV_KEYS';

/**
 * Fal.ai API client using official SDK
 */
export class FalProvider extends HealthyProviderWrapper {
  readonly providerType: ProviderType = 'falai';
  
  private apiKey: string;
  
  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || getFalKey() || '';
    
    // Configure Fal.ai client
    if (this.apiKey) {
      fal.config({ credentials: this.apiKey });
    }
  }
  
  /**
   * Check if provider is enabled
   */
  protected isEnabled(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Health check for Fal.ai
   */
  async healthCheck(): Promise<boolean> {
    const start = Date.now();
    try {
      // Simple health check - just verify we can submit
      const result = await fal.subscribe('fal-ai/stack', {
        input: { prompt: 'test' },
      });
      
      // Just verify we can submit - don't wait for completion
      this.updateHealthStatus(true, Date.now() - start);
      return !!result;
    } catch (error) {
      this.updateHealthStatus(false, undefined, String(error));
      return false;
    }
  }
  
  /**
   * Generate image via Fal.ai
   */
  async generateImage(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<ImageResult> {
    this.validateEnabled();
    
    const cleanedInput = this.cleanInput({
      prompt: input.prompt,
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(input.imageUrl && { image_url: input.imageUrl }),
      ...(options?.width && { width: options.width }),
      ...(options?.height && { height: options.height }),
      ...(options?.guidance && { guidance_scale: options.guidance }),
      ...(options?.seed && { seed: options.seed }),
    });
    
    const result = await this.runModel(model, cleanedInput, options?.timeout, options?.retries);
    return parseImageResponse(result);
  }
  
  /**
   * Generate video via Fal.ai
   */
  async generateVideo(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<VideoResult> {
    this.validateEnabled();
    
    const cleanedInput = this.cleanInput({
      ...(input.prompt && { prompt: input.prompt }),
      ...(input.imageUrl && { image_url: input.imageUrl }),
      ...(input.firstImageUrl && { first_image_url: input.firstImageUrl }),
      ...(input.audioUrl && { audio_url: input.audioUrl }),
      ...(input.duration && { duration: input.duration }),
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(options?.guidance && { guidance_scale: options.guidance }),
      ...(options?.fps && { fps: options.fps }),
    });
    
    const result = await this.runModel(model, cleanedInput, options?.timeout, options?.retries);
    return parseVideoResponse(result);
  }
  
  /**
   * Generate audio via Fal.ai
   */
  async generateAudio(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<AudioResult> {
    this.validateEnabled();
    
    const cleanedInput = this.cleanInput({
      text: input.text,
      ...(input.voice && { voice_id: input.voice }),
      ...(input.language && { language: input.language }),
      ...(input.speed && { speed: input.speed }),
    });
    
    const result = await this.runModel(model, cleanedInput, options?.timeout, options?.retries);
    return parseAudioResponse(result);
  }
  
  /**
   * Clean input - remove null/undefined values
   */
  private cleanInput(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(input).filter(
        ([, v]) => v !== null && v !== undefined
      )
    );
  }
  
  /**
   * Run a model using the Fal.ai SDK
   */
  private async runModel(
    model: string,
    input: Record<string, unknown>,
    _timeout: number = 180000,
    retries: number = 2
  ): Promise<unknown> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fal.subscribe(model, {
          input,
          logs: true,
        });
        
        // Extract data from result - follows existing provider-lib pattern
        if (result?.data?.images) return result.data.images;
        if (result?.data?.image) return [result.data.image];
        // Return full result for video/audio so extractVideoUrl can find data.data.video.url
        if (result?.data?.video?.url) return result;
        if (result?.data?.audio?.url) return result;

        return result?.data || result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[FalProvider] Attempt ${attempt + 1}/${retries + 1} failed:`, error);
      }
    }
    
    throw lastError || new Error('Fal.ai request failed');
  }
}

/**
 * Create configured Fal provider
 */
export function createFalProvider(apiKey?: string): FalProvider {
  return new FalProvider(apiKey);
}