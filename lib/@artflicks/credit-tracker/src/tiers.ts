/**
 * Tier cost functions
 * Get credit costs for model tiers (basic, pro, ultra, max, etc.)
 */

import { pricingData, TemplateType } from './types';
import { 
  getTierModel as getTierModelFromProvider,
  getAvatarTierModel as getAvatarTierModelFromProvider,
  type TemplateType as ProviderTemplateType
} from '@artflicks/model-provider';

/**
 * Get tier cost (video generation cost per scene for a tier)
 * Uses videoTiers from pricing.json
 */
export function getTierCost(tier: string): number {
  const tiers: Record<string, number> = pricingData.videoTiers;
  return tiers[tier] ?? 0;
}

/**
 * Get image tier cost (image generation cost per scene for a tier)
 * Uses imageTiers from pricing.json
 */
export function getImageTierCost(tier: string): number {
  const imageTiers: Record<string, number> = pricingData.imageTiers;
  return imageTiers[tier] ?? 0;
}

/**
 * Get video tier cost (video generation cost per scene for a tier)
 * Uses videoTiers from pricing.json
 */
export function getVideoTierCost(tier: string): number {
  const videoTiers: Record<string, number> = pricingData.videoTiers;
  return videoTiers[tier] ?? 0;
}

/**
 * Get the model ID for a tier
 * Delegates to model-provider tier-pricing for canonical model names
 */
export function getTierModel(tier: string, templateType?: TemplateType): string {
  return getTierModelFromProvider(tier, templateType as ProviderTemplateType);
}

/**
 * Get all available tiers
 */
export function getAllTiers(): string[] {
  return Object.keys(pricingData.videoTiers);
}

/**
 * Get avatar tier cost (credits per second for a model)
 * Uses avatarTiers from pricing.json
 */
export function getAvatarTierCost(model: string): number {
  const avatarTiers: Record<string, number> = pricingData.avatarTiers;
  return avatarTiers[model] ?? avatarTiers.standard;
}

/**
 * Get the model ID for an avatar tier
 * Delegates to model-provider tier-pricing for canonical model names
 */
export function getAvatarTierModel(tier: string): string {
  return getAvatarTierModelFromProvider(tier);
}
