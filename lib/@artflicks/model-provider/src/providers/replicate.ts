/**
 * Replicate Provider Implementation
 * 
 * Handles video, image, and audio generation via Replicate SDK
 */

import Replicate from 'replicate';

import { HealthyProviderWrapper, parseImageResponse, parseVideoResponse, parseAudioResponse } from './base';
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

import { getReplicateKey } from '../ENV_KEYS';

/**
 * Replicate API client using official SDK
 */
export class ReplicateProvider extends HealthyProviderWrapper {
  readonly providerType: ProviderType = 'replicate';
  
  private client: Replicate;
  
  constructor(apiKey?: string) {
    super();
    const key = apiKey || getReplicateKey() || '';
    this.client = new Replicate({
      auth: key,
    });
  }
  
  /**
   * Check if provider is enabled
   */
  protected isEnabled(): boolean {
    return !!this.client.auth;
  }
  
  /**
   * Health check for Replicate
   */
  async healthCheck(): Promise<boolean> {
    const start = Date.now();
    try {
      // Simple API call to verify connection
      await this.client.fetch('https://api.replicate.com/v1/models', {
        method: 'GET',
      });
      
      this.updateHealthStatus(true, Date.now() - start);
      return true;
    } catch (error) {
      this.updateHealthStatus(false, undefined, String(error));
      return false;
    }
  }
  
  /**
   * Generate image via Replicate
   */
  async generateImage(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<ImageResult> {
    this.validateEnabled();
    
    const inputData: Record<string, unknown> = {
      prompt: input.prompt,
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(input.imageUrl && { image: input.imageUrl }),
      ...(options?.width && { width: options.width }),
      ...(options?.height && { height: options.height }),
      ...(options?.guidance && { guidance: options.guidance }),
      ...(options?.seed && { seed: options.seed }),
    };
    
    const output = await this.runModel(model, inputData, options?.timeout, options?.retries, options);
    return parseImageResponse(output);
  }
  
  /**
   * Generate video via Replicate
   */
  async generateVideo(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<VideoResult> {
    this.validateEnabled();
    
    const inputData: Record<string, unknown> = {
      ...(input.prompt && { prompt: input.prompt }),
      ...(input.imageUrl && { image: input.imageUrl }),
      ...(input.firstImageUrl && { first_image: input.firstImageUrl }),
      ...(input.audioUrl && { audio: input.audioUrl }),
      ...(input.duration && { duration: input.duration }),
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(options?.guidance && { guidance: options.guidance }),
      ...(options?.fps && { fps: options.fps }),
    };
    
    const output = await this.runModel(model, inputData, options?.timeout, options?.retries, options);
    return parseVideoResponse(output);
  }
  
  /**
   * Generate audio via Replicate
   */
  async generateAudio(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<AudioResult> {
    this.validateEnabled();
    
    const inputData: Record<string, unknown> = {
      text: input.text,
      ...(input.voice && { voice: input.voice }),
      ...(input.language && { language: input.language }),
      ...(input.speed && { speed: input.speed }),
    };
    
    const output = await this.runModel(model, inputData, options?.timeout, options?.retries, options);
    return parseAudioResponse(output);
  }
  
  /**
   * Generate image asynchronously (for Cloudflare webhook pattern)
   * Returns immediately with prediction ID, webhook handles completion
   */
  async generateImageAsync(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    this.validateEnabled();
    
    const inputData: Record<string, unknown> = {
      prompt: input.prompt,
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(input.imageUrl && { image: input.imageUrl }),
      ...(options?.width && { width: options.width }),
      ...(options?.height && { height: options.height }),
      ...(options?.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
      ...(options?.guidance && { guidance: options.guidance }),
      ...(options?.seed && { seed: options.seed }),
    };
    
    return this.createPrediction(model, inputData, options);
  }

  /**
   * Generate video asynchronously (for Cloudflare webhook pattern)
   * Returns immediately with prediction ID, webhook handles completion
   */
  async generateVideoAsync(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    this.validateEnabled();
    
    const inputData: Record<string, unknown> = {
      ...(input.prompt && { prompt: input.prompt }),
      ...(input.imageUrl && { image: input.imageUrl }),
      ...(input.firstImageUrl && { first_image: input.firstImageUrl }),
      ...(input.audioUrl && { audio: input.audioUrl }),
      ...(input.duration && { duration: input.duration }),
      ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      ...(input.aspect_ratio && { aspect_ratio: input.aspect_ratio }),
      ...(options?.guidance && { guidance: options.guidance }),
      ...(options?.fps && { fps: options.fps }),
    };
    
    return this.createPrediction(model, inputData, options);
  }
  
  /**
   * Generate audio asynchronously (for Cloudflare webhook pattern)
   * Returns immediately with prediction ID, webhook handles completion
   */
  async generateAudioAsync(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    this.validateEnabled();
    
    const inputData: Record<string, unknown> = {
      text: input.text,
      ...(input.voice && { voice: input.voice }),
      ...(input.language && { language: input.language }),
      ...(input.speed && { speed: input.speed }),
    };
    
    return this.createPrediction(model, inputData, options);
  }
  
  /**
   * Create prediction using predictions.create() - async pattern for webhooks
   * No retries - webhooks handle completion
   */
  private async createPrediction(
    model: string,
    input: Record<string, unknown>,
    options?: ImageGenerationOptions | VideoGenerationOptions | AudioGenerationOptions
  ): Promise<{ predictionId: string; status: string }> {
    // Handle both versioned models (owner/name:version) and model names (owner/name)
    const hasVersion = model.includes(':');
    
    const predictionParams: any = {
      input,
      // Add webhook support if webhookUrl is provided
      ...(options?.webhookUrl && {
        webhook: options.webhookUrl,
        webhook_events_filter: (options.webhookEvents || ["completed"]) as any,
      }),
    };
    
    if (hasVersion) {
      // If model includes version hash, use version parameter
      predictionParams.version = model.split(':')[1];
    } else {
      // Otherwise use the model parameter (owner/name format)
      predictionParams.model = model;
    }
    
    const prediction = await this.client.predictions.create(predictionParams);
    
    return {
      predictionId: prediction.id,
      status: prediction.status,
    };
  }
  
  /**
   * Run a model using the Replicate SDK
   */
  private async runModel(
    model: string,
    input: Record<string, unknown>,
    timeout: number = 180000,
    retries: number = 2,
    options?: ImageGenerationOptions | VideoGenerationOptions | AudioGenerationOptions
  ): Promise<unknown> {
    let lastError: Error | undefined;
    
    // Cast model to the expected format for SDK
    const modelId = model as `${string}/${string}` | `${string}/${string}:${string}`;
    
    // Replicate API expects timeout in seconds (1-60), not milliseconds
    // Convert and cap at 60 seconds (max allowed by Replicate)
    const timeoutSeconds = Math.min(Math.max(Math.floor(timeout / 1000), 1), 60);
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const output = await this.client.run(modelId, {
          input,
          wait: {
            mode: 'block',
            timeout: timeoutSeconds,
          },
          // Add webhook support if webhookUrl is provided
          ...(options?.webhookUrl && {
            webhook: options.webhookUrl,
            webhook_events_filter: (options.webhookEvents || ["completed"]) as any,
          }),
        });
        
        return output;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ReplicateProvider] Attempt ${attempt + 1}/${retries + 1} failed:`, error);
      }
    }
    
    throw lastError || new Error('Replicate request failed');
  }
}

/**
 * Create configured Replicate provider
 */
export function createReplicateProvider(apiKey?: string): ReplicateProvider {
  return new ReplicateProvider(apiKey);
}