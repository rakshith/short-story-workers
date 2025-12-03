// Model utility functions

// Simplified model mapping - you can expand this with your full model configuration
const MODEL_TIERS: Record<string, string> = {
  'basic': 'black-forest-labs/flux-schnell',
  'lite': 'black-forest-labs/flux-schnell',
  'pro': 'black-forest-labs/flux-dev',
  'influencer': 'black-forest-labs/flux-dev',
  'ultra': 'black-forest-labs/flux-dev',
};

export function getModelForTier(modelTier: string): string {
  // If it's already a model ID (contains '/'), return as-is
  if (modelTier.includes('/')) {
    return modelTier;
  }
  
  // Otherwise, look up in tiers
  return MODEL_TIERS[modelTier] || MODEL_TIERS['lite'] || 'black-forest-labs/flux-schnell';
}

