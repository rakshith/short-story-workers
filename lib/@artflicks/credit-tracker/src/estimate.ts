/**
 * Main estimation functions
 * Calculate total credits for video/image generation
 */

import { 
  VideoGenerationEstimateParams,
  VideoGenerationEstimate,
  CostBreakdown,
  GenerationMediaType
} from './types';
import { 
  getModelCost 
} from './models';
import { 
  getTierCost,
  getVideoTierCost,
  getImageTierCost
} from './tiers';
import { 
  SCRIPT_GENERATION_COST,
  VOICE_GENERATION_COST,
  BACKGROUND_MUSIC_COST,
  IMMERSIVE_AUDIO_COST,
  BASE_DURATION_PER_CREDIT
} from './operations';
import { 
  videoScenesFromDuration, 
  imageScenesFromDuration 
} from './scenes';

/**
 * Get cost per scene for a model tier or model ID
 * Uses imageTiers for ai-images and videoTiers for ai-videos
 */
function getCostPerScene(modelTierOrId: string, mediaType: GenerationMediaType): number {
  // Use the correct tier based on media type
  const tierCost = mediaType === 'ai-images' 
    ? getImageTierCost(modelTierOrId) 
    : getVideoTierCost(modelTierOrId);
  
  if (tierCost > 0) {
    return tierCost;
  }
  
  // Try direct model cost lookup (works for model IDs like 'wan-video/wan-2.5-i2v')
  const modelCost = getModelCost(modelTierOrId);
  if (modelCost > 0) {
    return modelCost;
  }
  
  // Fallback to basic tier
  const basicCost = mediaType === 'ai-images' 
    ? (getImageTierCost('basic') || 2)
    : (getVideoTierCost('basic') || 30);
  return basicCost;
}

/**
 * Calculate script generation cost based on duration
 */
function calculateScriptCost(durationSeconds: number): number {
  return SCRIPT_GENERATION_COST * Math.ceil(durationSeconds / BASE_DURATION_PER_CREDIT);
}

/**
 * Estimate total credits for video generation
 * Main function used by UI and Cloudflare
 */
export function estimateVideoGeneration(
  params: VideoGenerationEstimateParams,
): VideoGenerationEstimate {
  const { duration, modelTier, mediaType, enableImmersiveAudio } = params;
  
  // Calculate number of scenes based on duration and media type
  const numberOfScenes =
    mediaType === 'ai-videos'
      ? videoScenesFromDuration(duration)
      : imageScenesFromDuration(duration);
  
  const costPerScene = getCostPerScene(modelTier, mediaType);
  
  // Calculate breakdown
  const images = mediaType === 'ai-images' ? costPerScene * numberOfScenes : 0;
  const videos = mediaType === 'ai-videos' ? costPerScene * numberOfScenes : 0;
  const audio = VOICE_GENERATION_COST * numberOfScenes;
  const music = BACKGROUND_MUSIC_COST;
  const script = calculateScriptCost(duration);
  const immersiveAudio = enableImmersiveAudio ? IMMERSIVE_AUDIO_COST * numberOfScenes : 0;
  
  const totalCredits = images + videos + audio + music + script + immersiveAudio;
  
  const breakdown: CostBreakdown = {
    videoGeneration: videos > 0 ? {
      type: 'videoGeneration',
      model: modelTier,
      perScene: costPerScene,
      scenes: numberOfScenes,
      total: videos,
    } : undefined,
    imageGeneration: images > 0 ? {
      type: 'imageGeneration',
      model: modelTier,
      perImage: costPerScene,
      images: numberOfScenes,
      total: images,
    } : undefined,
    scriptGeneration: {
      type: 'scriptGeneration',
      total: script,
    },
    voiceGeneration: {
      type: 'voiceGeneration',
      perScene: VOICE_GENERATION_COST,
      scenes: numberOfScenes,
      total: audio,
    },
    backgroundMusic: {
      type: 'backgroundMusic',
      total: music,
    },
    immersiveAudio: enableImmersiveAudio ? {
      type: 'immersiveAudio',
      perScene: IMMERSIVE_AUDIO_COST,
      scenes: numberOfScenes,
      total: immersiveAudio,
    } : undefined,
  };
  
  return {
    totalCredits,
    breakdown,
    numberOfScenes,
  };
}

/**
 * Get credit cost for a model tier
 */
export function creditCostForModel(modelTierOrId: string, mediaType: GenerationMediaType): number {
  return getCostPerScene(modelTierOrId, mediaType);
}

/**
 * Quick affordability check
 */
export function canAfford(
  availableCredits: number,
  requiredCredits: number,
): { canAfford: true } | { canAfford: false; deficit: number } {
  if (availableCredits >= requiredCredits) {
    return { canAfford: true };
  }
  return { canAfford: false, deficit: requiredCredits - availableCredits };
}
