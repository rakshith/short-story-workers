/**
 * Tier cost functions
 * Get credit costs for model tiers (basic, pro, ultra, max, etc.)
 */

import { pricingData, TemplateType } from './types';

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
 */
export function getTierModel(tier: string, templateType?: TemplateType): string {
  const tierModels: Record<string, string> = pricingData.videoTierModels;
  const characterVideoTierModels: Record<string, string> = pricingData.characterVideoTierModels;
  const scriptVideoTierModels: Record<string, string> = pricingData.scriptVideoTierModels;
  
  if (templateType === 'character-video') {
    return characterVideoTierModels[tier] || tierModels[tier];
  }
  if (templateType === 'faceless-video' || templateType === 'image') {
    return scriptVideoTierModels[tier] || tierModels[tier];
  }
  
  return tierModels[tier];
}

/**
 * Get all available tiers
 */
export function getAllTiers(): string[] {
  return Object.keys(pricingData.videoTiers);
}
