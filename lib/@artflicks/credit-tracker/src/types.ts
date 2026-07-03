/**
 * Centralized Pricing Types
 * Single source of truth for all credit costs across the platform
 * Compatible with Next.js and Cloudflare Workers
 */

// Load pricing data at runtime (compatible with both environments)
import pricingData from './pricing.json';

type PricingData = typeof pricingData;

// Re-export types
export type ModelCategory = 'image' | 'video' | 'chat' | 'inpaint' | 'upscaler';
export type GenerationMediaType = 'ai-images' | 'ai-videos' | 'avatar';
export type TemplateType = 'character-video' | 'faceless-video' | 'image' | 'talking-avatar';

// Pricing schema interface
export interface ModelPricingSchema {
  version: string;
  currency: string;
  description?: string;
  models: {
    image: Record<string, number>;
    video: Record<string, number>;
    chat: Record<string, number>;
    inpaint: Record<string, number>;
    upscaler: Record<string, number>;
  };
  operations: Record<string, number>;
  imageTiers: Record<string, number>;
  videoTiers: Record<string, number>;
  avatarTiers: Record<string, number>;
}

// Cost breakdown components
export interface VideoGenerationCost {
  type: 'videoGeneration';
  model: string;
  perScene: number;
  scenes: number;
  total: number;
}

export interface ImageGenerationCost {
  type: 'imageGeneration';
  model: string;
  perImage: number;
  images: number;
  total: number;
}

export interface ScriptGenerationCost {
  type: 'scriptGeneration';
  total: number;
}

export interface VoiceGenerationCost {
  type: 'voiceGeneration';
  perScene: number;
  scenes: number;
  total: number;
}

export interface BackgroundMusicCost {
  type: 'backgroundMusic';
  total: number;
}

export interface ImmersiveAudioCost {
  type: 'immersiveAudio';
  perScene: number;
  scenes: number;
  total: number;
}

export interface SpeechToTextCost {
  type: 'speechToText';
  perScene: number;
  scenes: number;
  total: number;
}

export interface YouTubeExtractCost {
  type: 'youtubeExtract';
  total: number;
}

// Union type for all cost components
export type CostComponent =
  | VideoGenerationCost
  | ImageGenerationCost
  | ScriptGenerationCost
  | VoiceGenerationCost
  | BackgroundMusicCost
  | ImmersiveAudioCost
  | YouTubeExtractCost;

// Full cost breakdown
export interface CostBreakdown {
  videoGeneration?: VideoGenerationCost;
  imageGeneration?: ImageGenerationCost;
  scriptGeneration?: ScriptGenerationCost;
  voiceGeneration?: VoiceGenerationCost;
  backgroundMusic?: BackgroundMusicCost;
  immersiveAudio?: ImmersiveAudioCost;
  speechToText?: SpeechToTextCost;
  youtubeExtract?: YouTubeExtractCost;
}

// Cost response
export interface CostResponse {
  credits: number;
  breakdown: CostBreakdown;
  currency: string;
  valid: boolean;
  error?: string;
}

// Estimation request/response
export interface VideoGenerationEstimateParams {
  duration: number;
  modelTier: string;
  mediaType: GenerationMediaType;
  enableImmersiveAudio?: boolean;
  scriptCharCount?: number;
}

export interface VideoGenerationEstimate {
  totalCredits: number;
  breakdown: CostBreakdown;
  numberOfScenes: number;
}

// Unified generation operation
export interface GenerationOperation {
  type: string;         // 'tts' | 'voice' | 'music' | 'script' | 'immersive-audio'
  charCount?: number;   // for TTS and voice (character-based pricing)
  perCharCost?: number; // optional: override default per-character cost for voice
}

// Unified generation estimate params
export interface GenerationEstimateParams {
  model: string;           // tier name: 'basic', 'pro', 'standard', etc.
  duration: number;        // seconds
  mediaType: GenerationMediaType;  // routes to correct tier table
  operations?: GenerationOperation[];
}

// Unified generation estimate result
export interface GenerationEstimate {
  totalCredits: number;
  breakdown: CostBreakdown;
  numberOfScenes?: number;
}

export interface CostOptions {
  voice?: boolean;
  music?: boolean;
  immersiveAudio?: boolean;
  scriptGeneration?: boolean;
  youtubeExtract?: boolean;
}

export interface GenerationCostRequest {
  model?: string;
  tier?: string;
  templateType?: TemplateType;
  scenes?: number;
  images?: number;
  options?: CostOptions;
}

// Stored cost in database
export interface StoredCost {
  storyId: string;
  jobId: string;
  userId: string;
  totalCredits: number;
  breakdown: CostBreakdown;
  modelUsed: string;
  createdAt: string;
  currency: string;
}

// Re-export pricing data for use in other modules
export { pricingData };
