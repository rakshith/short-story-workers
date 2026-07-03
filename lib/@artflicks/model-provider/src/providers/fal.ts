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

import { getFalKey, getFalWebhookUrl } from '../ENV_KEYS';

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
    
    // Pass through ALL parameters from input
    const inputData: Record<string, unknown> = {
      ...input,
      // Transform specific fields for Fal.ai format
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(input.imageUrl && { image_url: input.imageUrl }),
    };
    
    const normalizedInput = this.normalizeInput(inputData);
    const cleanedInput = this.cleanInput(normalizedInput);
    
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
    
    // Pass through ALL parameters from input
    const inputData: Record<string, unknown> = {
      ...input,
      // Transform specific fields for Fal.ai format
      ...(input.imageUrl && { image_url: input.imageUrl }),
      ...(input.firstImageUrl && { first_image_url: input.firstImageUrl }),
      ...(input.audioUrl && { audio_url: input.audioUrl }),
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
    };
    
    const normalizedInput = this.normalizeInput(inputData);
    const cleanedInput = this.cleanInput(normalizedInput);
    
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
    
    // Pass through ALL parameters from input
    const inputData: Record<string, unknown> = { ...input };
    
    const normalizedInput = this.normalizeInput(inputData);
    const cleanedInput = this.cleanInput(normalizedInput);
    
    const result = await this.runModel(model, cleanedInput, options?.timeout, options?.retries);
    return parseAudioResponse(result);
  }
  
  /**
   * Generate image asynchronously (for webhook/SSE pattern)
   * Returns immediately with predictionId, webhook handles completion
   */
  async generateImageAsync(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    this.validateEnabled();
    
    const webhookUrl = options?.webhookUrl || getFalWebhookUrl();
    if (!webhookUrl) {
      throw new Error('webhookUrl is required for async mode');
    }
    
    const inputData: Record<string, unknown> = {
      ...input,
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(input.imageUrl && { image_url: input.imageUrl }),
      ...(options?.input),
    };
    
    const normalizedInput = this.normalizeInput(inputData);
    const cleanedInput = this.cleanInput(normalizedInput);
    
    const result = await this.submitAsync(model, cleanedInput, webhookUrl);
    return result;
  }
  
  /**
   * Generate video asynchronously (for webhook/SSE pattern)
   * Returns immediately with predictionId, webhook handles completion
   */
  async generateVideoAsync(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    this.validateEnabled();
    
    const webhookUrl = options?.webhookUrl || getFalWebhookUrl();
    if (!webhookUrl) {
      throw new Error('webhookUrl is required for async mode');
    }
    
    const inputData: Record<string, unknown> = {
      ...input,
      ...(input.imageUrl && { image_url: input.imageUrl }),
      ...(input.firstImageUrl && { first_image_url: input.firstImageUrl }),
      ...(input.audioUrl && { audio_url: input.audioUrl }),
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(options?.input),
    };
    
    const normalizedInput = this.normalizeInput(inputData);
    const cleanedInput = this.cleanInput(normalizedInput);
    
    const result = await this.submitAsync(model, cleanedInput, webhookUrl, options?.webhookMetadata);
    return result;
  }
  
  /**
   * Generate audio asynchronously (for webhook/SSE pattern)
   * Returns immediately with predictionId, webhook handles completion
   */
  async generateAudioAsync(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    this.validateEnabled();
    
    const webhookUrl = options?.webhookUrl || getFalWebhookUrl();
    if (!webhookUrl) {
      throw new Error('webhookUrl is required for async mode');
    }
    
    const inputData: Record<string, unknown> = {
      ...input,
      ...(options?.input),
    };
    
    const normalizedInput = this.normalizeInput(inputData);
    const cleanedInput = this.cleanInput(normalizedInput);
    
    const result = await this.submitAsync(model, cleanedInput, webhookUrl);
    return result;
  }
  
  /**
   * Submit a job to FAL queue asynchronously (non-blocking)
   * Returns immediately with jobId for webhook tracking
   */
  private async submitAsync(
    model: string,
    input: Record<string, unknown>,
    webhookUrl: string,
    metadata?: Record<string, string>
  ): Promise<{ predictionId: string; status: string }> {
    const baseUrl = `${webhookUrl}/webhooks/fal`;
    const webhookUrlWithMetadata = metadata
      ? baseUrl + '?' + new URLSearchParams(metadata).toString()
      : baseUrl;

    const submission = await fal.queue.submit(model, {
      input,
      webhookUrl: webhookUrlWithMetadata,
    });
    
    return {
      predictionId: submission.request_id,
      status: 'queued',
    };
  }
  
  /**
   * Normalize input - convert format aliases for FAL API compatibility
   */
  private normalizeInput(input: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...input };
    
    // FAL API expects 'jpeg' not 'jpg'
    if (normalized.output_format === 'jpg') {
      normalized.output_format = 'jpeg';
    }
    
    return normalized;
  }
  
  /**
   * Clean input - remove null/undefined/false values for image references
   */
  private cleanInput(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(input).filter(([key, v]) => {
        // Remove null/undefined
        if (v === null || v === undefined) return false;
        // Remove false values for image reference fields
        if ((key.includes('image') || key.includes('match')) && v === false) return false;
        return true;
      })
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
