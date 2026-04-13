/**
 * @artflicks/model-provider
 * 
 * Unified model provider abstraction layer
 * Supports Replicate, Fal.ai, and Cloudflare AI Gateway
 * 
 * Video, Image, and Audio generation
 */

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType = 'replicate' | 'falai' | 'gateway';

/**
 * Centralized provider name constants
 * Use these instead of hardcoded strings throughout the codebase
 */
export const PROVIDER_NAMES = {
  REPLICATE: 'replicate',
  FALAI: 'falai',
  GATEWAY: 'gateway',
} as const;

export type MediaType = 'video' | 'image' | 'audio';

// ============================================================================
// Generation Options
// ============================================================================

export interface GenerationOptions {
  timeout?: number;
  retries?: number;
  webhookUrl?: string;
  webhookEvents?: string[];  // Defaults to ["completed"] if not specified
}

export interface ImageGenerationOptions extends GenerationOptions {
  width?: number;
  height?: number;
  aspect_ratio?: string;
  guidance?: number;
  seed?: number;
  input?: Record<string, unknown>;
}

export interface VideoGenerationOptions extends GenerationOptions {
  duration?: number;
  fps?: number;
  guidance?: number;
  seed?: number;
  input?: Record<string, unknown>;
}

export interface AudioGenerationOptions extends GenerationOptions {
  voice?: string;
  language?: string;
  speed?: number;
}

// ============================================================================
// Generation Inputs
// ============================================================================

export interface ImageInput {
  prompt: string;
  imageUrl?: string;
  negativePrompt?: string;
}

export interface VideoInput {
  prompt?: string;
  imageUrl?: string;
  firstImageUrl?: string;
  audioUrl?: string;
  duration?: number;
  negativePrompt?: string;
  aspect_ratio?: string;
}

export interface AudioInput {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
}

// ============================================================================
// Generation Results
// ============================================================================

export interface ImageResult {
  imageUrls: string[];
  url?: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface VideoResult {
  videoUrl: string;
  url?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface AudioResult {
  audioUrl: string;
  url?: string;
  duration?: number;
  format?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface ModelProvider {
  // Get provider type
  getProviderType(): ProviderType;
  
  // Health check
  healthCheck(): Promise<boolean>;
  
  // Image generation (synchronous - waits for completion)
  generateImage(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<ImageResult>;
  
  // Video generation (synchronous - waits for completion)
  generateVideo(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<VideoResult>;
  
  // Audio generation (synchronous - waits for completion)
  generateAudio(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<AudioResult>;
  
  // Image generation (asynchronous - returns prediction ID for webhooks)
  generateImageAsync?(
    model: string,
    input: ImageInput,
    options?: ImageGenerationOptions
  ): Promise<{ predictionId: string; status: string }>;
  
  // Video generation (asynchronous - returns prediction ID for webhooks)
  generateVideoAsync?(
    model: string,
    input: VideoInput,
    options?: VideoGenerationOptions
  ): Promise<{ predictionId: string; status: string }>;
  
  // Audio generation (asynchronous - returns prediction ID for webhooks)
  generateAudioAsync?(
    model: string,
    input: AudioInput,
    options?: AudioGenerationOptions
  ): Promise<{ predictionId: string; status: string }>;
}

// ============================================================================
// Factory Types
// ============================================================================

export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  apiUrl?: string;
}

export interface FactoryConfig {
  primary: ProviderType;
  fallback?: ProviderType;
  retryAttempts: number;
  providers: {
    replicate: ProviderConfig;
    falai: ProviderConfig;
    gateway: ProviderConfig;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class ProviderError extends Error {
  constructor(
    message: string,
    public providerType: ProviderType,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class FallbackError extends Error {
  constructor(
    message: string,
    public errors: Map<ProviderType, Error>
  ) {
    super(message);
    this.name = 'FallbackError';
  }
}

// ============================================================================
// Health Check Result
// ============================================================================

export interface HealthStatus {
  provider: ProviderType;
  healthy: boolean;
  latency?: number;
  error?: string;
}

export interface ProviderHealthMap {
  replicate?: HealthStatus;
  falai?: HealthStatus;
  gateway?: HealthStatus;
}