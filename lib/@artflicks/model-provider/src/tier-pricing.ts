/**
 * Tier Pricing Utilities
 * Maps tiers to models and provides provider-specific model IDs
 * Single source of truth for tier-to-model mappings
 */

import tierModelsJson from './tier-models.json';
import { translateModelId, GenerationType, MODEL_ID_MAP } from './model-map';
import { ProviderType } from './types';

interface TierModelsData {
  videoTierModels: Record<string, string>;
  scriptVideoTierModels: Record<string, string>;
  characterVideoTierModels: Record<string, string>;
  avatarTierModels: Record<string, string>;
  imageTierModels: Record<string, string>;
}

export const tierModels: TierModelsData = tierModelsJson as TierModelsData;

export type TemplateType = 'character-video' | 'faceless-video' | 'image' | 'talking-avatar';

/**
 * Get canonical model name for a tier
 * Returns the canonical name (e.g., 'kling-v2.6') not provider-specific ID
 */
export function getTierModel(tier: string, templateType?: TemplateType): string {
  if (templateType === 'character-video') {
    return tierModels.characterVideoTierModels[tier] || tierModels.videoTierModels[tier];
  }
  if (templateType === 'faceless-video' || templateType === 'image') {
    return tierModels.scriptVideoTierModels[tier] || tierModels.videoTierModels[tier];
  }
  return tierModels.videoTierModels[tier];
}

/**
 * Get provider-specific model ID for a tier
 * Translates canonical name to provider-specific ID using model-map
 */
export function getTierModelForProvider(
  tier: string,
  provider: ProviderType,
  templateType?: TemplateType,
  generationType?: GenerationType
): string {
  const canonicalName = getTierModel(tier, templateType);
  if (!canonicalName) return tier; // Fallback to tier if no mapping
  
  return translateModelId(canonicalName, provider, generationType);
}

/**
 * Get avatar tier model (canonical name)
 */
export function getAvatarTierModel(tier: string): string {
  return tierModels.avatarTierModels[tier] || tierModels.avatarTierModels.standard;
}

/**
 * Get avatar tier model for specific provider
 */
export function getAvatarTierModelForProvider(
  tier: string,
  provider: ProviderType,
  generationType?: GenerationType
): string {
  const canonicalName = getAvatarTierModel(tier);
  return translateModelId(canonicalName, provider, generationType);
}

/**
 * Get image tier model (canonical name)
 */
export function getImageTierModel(tier: string): string {
  return tierModels.imageTierModels[tier];
}

/**
 * Get image tier model for specific provider
 */
export function getImageTierModelForProvider(
  tier: string,
  provider: ProviderType,
  generationType?: GenerationType
): string {
  const canonicalName = getImageTierModel(tier);
  if (!canonicalName) return tier;
  return translateModelId(canonicalName, provider, generationType);
}

/**
 * Validate all tier models exist in MODEL_ID_MAP
 * Returns validation result with any errors found
 */
export function validateTierModels(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate video tier models
  for (const [tier, model] of Object.entries(tierModels.videoTierModels)) {
    if (!MODEL_ID_MAP[model]) {
      errors.push(`videoTierModels.${tier}: "${model}" not found in MODEL_ID_MAP`);
    }
  }
  
  // Validate script video tier models
  for (const [tier, model] of Object.entries(tierModels.scriptVideoTierModels)) {
    if (!MODEL_ID_MAP[model]) {
      errors.push(`scriptVideoTierModels.${tier}: "${model}" not found in MODEL_ID_MAP`);
    }
  }
  
  // Validate character video tier models
  for (const [tier, model] of Object.entries(tierModels.characterVideoTierModels)) {
    if (!MODEL_ID_MAP[model]) {
      errors.push(`characterVideoTierModels.${tier}: "${model}" not found in MODEL_ID_MAP`);
    }
  }
  
  // Validate avatar tier models
  for (const [tier, model] of Object.entries(tierModels.avatarTierModels)) {
    if (!MODEL_ID_MAP[model]) {
      errors.push(`avatarTierModels.${tier}: "${model}" not found in MODEL_ID_MAP`);
    }
  }
  
  // Validate image tier models
  for (const [tier, model] of Object.entries(tierModels.imageTierModels)) {
    if (!MODEL_ID_MAP[model]) {
      errors.push(`imageTierModels.${tier}: "${model}" not found in MODEL_ID_MAP`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
