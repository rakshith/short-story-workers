/**
 * Model cost functions
 * Get credit costs for specific AI models
 */

import { pricingData, ModelCategory } from './types';

// Re-export for convenience
export { pricingData };

/**
 * Get all model costs for a category
 */
export function getModelsByCategory(category: ModelCategory): Record<string, number> {
  return pricingData.models[category] || {};
}

/**
 * Get cost for a specific model
 * Note: For image and video models, use tier-based pricing instead.
 * This function now returns 0 for image/video models as tiers are the source of truth.
 * @param modelId - The model ID (e.g., 'kwaivgi/kling-v3-video')
 * @returns The credit cost, or 0 if model not found (use tiers for image/video)
 */
export function getModelCost(modelId: string): number {
  // For image and video models, return 0 - tiers are the source of truth
  const allModels: Record<string, number> = {
    ...pricingData.models.chat,
    ...pricingData.models.inpaint,
    ...pricingData.models.upscaler,
  };
  
  return allModels[modelId] ?? 0;
}

/**
 * Get the category for a model
 */
export function getModelCategory(modelId: string): ModelCategory | null {
  const categories: ModelCategory[] = ['image', 'video', 'chat', 'inpaint', 'upscaler'];
  
  for (const category of categories) {
    const categoryModels: Record<string, number> = pricingData.models[category];
    if (categoryModels[modelId] !== undefined) {
      return category;
    }
  }
  
  return null;
}

/**
 * Get pricing version
 */
export function getPricingVersion(): string {
  return pricingData.version;
}
