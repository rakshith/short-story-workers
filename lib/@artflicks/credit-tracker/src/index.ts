/**
 * @artflicks/credit-tracker
 * 
 * Credit cost calculations for ArtFlicks
 * Single source of truth for all credit costs
 * Works in Next.js and Cloudflare Workers
 */

// Types
export type {
  ModelCategory,
  GenerationMediaType,
  TemplateType,
  ModelPricingSchema,
  VideoGenerationCost,
  ImageGenerationCost,
  ScriptGenerationCost,
  VoiceGenerationCost,
  BackgroundMusicCost,
  ImmersiveAudioCost,
  YouTubeExtractCost,
  CostComponent,
  CostBreakdown,
  CostResponse,
  VideoGenerationEstimateParams,
  VideoGenerationEstimate,
  GenerationOperation,
  GenerationEstimateParams,
  GenerationEstimate,
  CostOptions,
  GenerationCostRequest,
  StoredCost,
} from './types';

// Re-export pricing data
export { pricingData } from './types';

// Model functions
export {
  getPricingVersion,
  getModelsByCategory,
  getModelCost,
  getModelCategory,
} from './models';

// Tier functions
export {
  getTierCost,
  getImageTierCost,
  getVideoTierCost,
  getTierModel,
  getAllTiers,
  getAvatarTierCost,
  getAvatarTierModel,
} from './tiers';

// Operation constants
export {
  SCRIPT_GENERATION_COST,
  VOICE_GENERATION_COST,
  VOICE_GENERATION_COST_PER_CHAR,
  SPEECH_TO_TEXT_COST,
  BACKGROUND_MUSIC_COST,
  IMMERSIVE_AUDIO_COST,
  STORY_EXPORT_COST,
  YOUTUBE_EXTRACT_COST,
  VOICE_CLONE_BASE_COST,
  VOICE_CLONE_COST_PER_SECOND,
  DEFAULT_TIER,
  BASE_DURATION_PER_CREDIT,
  getOperationCost,
} from './operations';

// Scene calculation functions
export {
  imageScenesFromDuration,
  videoScenesFromDuration,
  getSceneCount,
} from './scenes';

// Main estimation functions
export {
  estimateVideoGeneration,
  estimateGeneration,
  creditCostForModel,
  canAfford,
} from './estimate';

// Convenience: all exports from estimate
export { estimateVideoGeneration as estimate } from './estimate';
