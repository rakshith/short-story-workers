/**
 * Main estimation functions
 * Calculate total credits for video/image/avatar generation
 */

import { 
  VideoGenerationEstimateParams,
  VideoGenerationEstimate,
  GenerationEstimateParams,
  GenerationEstimate,
  CostBreakdown,
  GenerationMediaType
} from './types';
import { 
  getModelCost 
} from './models';
import { 
  getTierCost,
  getVideoTierCost,
  getImageTierCost,
  getAvatarTierCost,
  getAvatarTierModel
} from './tiers';
import { 
  SCRIPT_GENERATION_COST,
  VOICE_GENERATION_COST,
  BACKGROUND_MUSIC_COST,
  IMMERSIVE_AUDIO_COST,
  BASE_DURATION_PER_CREDIT,
  VOICE_GENERATION_COST_PER_CHAR,
  SPEECH_TO_TEXT_COST,
  ESTIMATED_WPS,
  ESTIMATED_CHARS_PER_WORD,
} from './operations';
import { 
  videoScenesFromDuration, 
  imageScenesFromDuration 
} from './scenes';

/**
 * Get cost per scene for a model tier
 * Uses imageTiers for ai-images and videoTiers for ai-videos
 * Now uses tier-based pricing only (no individual model costs)
 */
function getCostPerScene(modelTier: string, mediaType: GenerationMediaType): number {
  // Use the correct tier based on media type
  const tierCost = mediaType === 'ai-images' 
    ? getImageTierCost(modelTier) 
    : getVideoTierCost(modelTier);
  
  // Fallback to basic tier if tier cost is 0 or invalid
  return tierCost || (mediaType === 'ai-images' ? 2 : 30);
}

/**
 * Calculate script generation cost based on duration
 */
function calculateScriptCost(durationSeconds: number): number {
  return SCRIPT_GENERATION_COST * Math.ceil(durationSeconds / BASE_DURATION_PER_CREDIT);
}

/**
 * Estimate total credits for video generation
 * Backward-compatible wrapper around estimateGeneration()
 */
export function estimateVideoGeneration(
  params: VideoGenerationEstimateParams,
): VideoGenerationEstimate {
  const { duration, modelTier, mediaType, enableImmersiveAudio, scriptCharCount, sceneCount } = params;

  // Estimate char count from duration when not provided (frontend doesn't have script yet)
  const estimatedCharCount = scriptCharCount ?? Math.ceil(duration * ESTIMATED_WPS * ESTIMATED_CHARS_PER_WORD);

  const operations: { type: string; charCount?: number }[] = [
    { type: 'voice', charCount: estimatedCharCount },
    { type: 'music' },
    { type: 'script' },
  ];
  if (enableImmersiveAudio) operations.push({ type: 'immersive-audio' });

  const result = estimateGeneration({
    model: modelTier,
    duration,
    mediaType,
    operations,
    sceneCount,
  });

  return {
    totalCredits: result.totalCredits,
    breakdown: result.breakdown,
    numberOfScenes: result.numberOfScenes ?? 0,
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

/**
 * Unified generation estimator — single entry point for all workflows.
 * Routes to the correct pricing table based on mediaType:
 *   - 'ai-images' → imageTiers (per-scene)
 *   - 'ai-videos' → videoTiers (per-scene)
 *   - 'avatar'    → avatarTiers (per-second)
 *
 * Operations (TTS, voice, music, etc.) are added on top from pricing.json.
 */
export function estimateGeneration(params: GenerationEstimateParams): GenerationEstimate {
  const { model, duration, mediaType, operations, sceneCount } = params;

  let totalCredits = 0;
  let numberOfScenes: number | undefined;
  const breakdown: CostBreakdown = {};

  if (mediaType === 'avatar') {
    // Duration-based pricing: credits = costPerSecond × duration
    const costPerSecond = getAvatarTierCost(model);
    const videoCredits = Math.ceil(costPerSecond * duration);
    totalCredits += videoCredits;
    breakdown.videoGeneration = {
      type: 'videoGeneration',
      model: getAvatarTierModel(model),
      perScene: videoCredits,
      scenes: 1,
      total: videoCredits,
    };
  } else {
    // Scene-based pricing: credits = costPerScene × scenes
    // Use actual sceneCount when provided, otherwise derive from duration
    const scenes = (sceneCount !== undefined && sceneCount > 0)
      ? sceneCount
      : (mediaType === 'ai-videos'
        ? videoScenesFromDuration(duration)
        : imageScenesFromDuration(duration));
    numberOfScenes = scenes;

    const costPerScene = mediaType === 'ai-images'
      ? getImageTierCost(model)
      : getVideoTierCost(model);

    if (mediaType === 'ai-images') {
      const imageCredits = costPerScene * scenes;
      totalCredits += imageCredits;
      breakdown.imageGeneration = {
        type: 'imageGeneration',
        model,
        perImage: costPerScene,
        images: scenes,
        total: imageCredits,
      };
    } else {
      const videoCredits = costPerScene * scenes;
      totalCredits += videoCredits;
      breakdown.videoGeneration = {
        type: 'videoGeneration',
        model,
        perScene: costPerScene,
        scenes,
        total: videoCredits,
      };
    }
  }

  // Process operations
  if (operations) {
    for (const op of operations) {
      switch (op.type) {
        case 'tts': {
          const charCount = op.charCount ?? 0;
          const ttsCredits = Math.ceil(charCount / 1000);
          if (ttsCredits > 0) {
            totalCredits += ttsCredits;
            breakdown.voiceGeneration = {
              type: 'voiceGeneration',
              perScene: ttsCredits,
              scenes: 1,
              total: ttsCredits,
            };
          }
          break;
        }
        case 'voice': {
          // If charCount is provided, use per-character pricing
          if (op.charCount !== undefined && op.charCount > 0) {
            const perCharCost = op.perCharCost ?? VOICE_GENERATION_COST_PER_CHAR;
            const voiceCredits = Math.ceil(op.charCount * perCharCost);
            totalCredits += voiceCredits;
            breakdown.voiceGeneration = {
              type: 'voiceGeneration',
              perScene: voiceCredits,
              scenes: 1,
              total: voiceCredits,
            };
          } else {
            // Fallback to flat per-scene pricing
            const scenes = numberOfScenes ?? 1;
            const voiceCredits = VOICE_GENERATION_COST * scenes;
            totalCredits += voiceCredits;
            breakdown.voiceGeneration = {
              type: 'voiceGeneration',
              perScene: VOICE_GENERATION_COST,
              scenes,
              total: voiceCredits,
            };
          }
          break;
        }
        case 'music': {
          totalCredits += BACKGROUND_MUSIC_COST;
          breakdown.backgroundMusic = {
            type: 'backgroundMusic',
            total: BACKGROUND_MUSIC_COST,
          };
          break;
        }
        case 'script': {
          const scriptCredits = SCRIPT_GENERATION_COST * Math.ceil(duration / BASE_DURATION_PER_CREDIT);
          totalCredits += scriptCredits;
          breakdown.scriptGeneration = {
            type: 'scriptGeneration',
            total: scriptCredits,
          };
          break;
        }
        case 'immersive-audio': {
          const scenes = numberOfScenes ?? 1;
          const immersiveCredits = IMMERSIVE_AUDIO_COST * scenes;
          totalCredits += immersiveCredits;
          breakdown.immersiveAudio = {
            type: 'immersiveAudio',
            perScene: IMMERSIVE_AUDIO_COST,
            scenes,
            total: immersiveCredits,
          };
          break;
        }
        case 'stt': {
          const charCount = op.charCount ?? 0;
          const sttCredits = Math.ceil(charCount / 1000) || SPEECH_TO_TEXT_COST;
          totalCredits += sttCredits;
          breakdown.speechToText = {
            type: 'speechToText',
            perScene: sttCredits,
            scenes: 1,
            total: sttCredits,
          };
          break;
        }
      }
    }
  }

  return { totalCredits, breakdown, numberOfScenes };
}
