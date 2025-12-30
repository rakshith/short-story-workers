// Tier-based configuration for cost-effective story generation
// Focus: Concurrency control, batch processing, and priority for cost optimization

export type UserTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface TierConfig {
  maxConcurrentJobs: number;           // Max concurrent jobs to control compute costs
  maxBatchSize: number;                // Batch size for efficient queue processing
  priority: number;                    // Priority level (higher = processed first)
}

// Default values - Used if not overridden in wrangler.toml
export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  tier1: {
    maxConcurrentJobs: 2,
    maxBatchSize: 3,
    priority: 1,
  },
  tier2: {
    maxConcurrentJobs: 5,
    maxBatchSize: 5,
    priority: 2,
  },
  tier3: {
    maxConcurrentJobs: 10,
    maxBatchSize: 10,
    priority: 3,
  },
  tier4: {
    maxConcurrentJobs: 20,
    maxBatchSize: 15,
    priority: 4,
  },
};

/**
 * Get merged tier configuration (Wrangler Env > Hardcoded Defaults)
 */
export function getTierConfig(tier: UserTier, env?: any): TierConfig {
  const defaults = TIER_CONFIGS[tier];
  if (!env) return defaults;

  const prefix = tier.toUpperCase();
  return {
    maxConcurrentJobs: env[`${prefix}_CONCURRENCY`] ? parseInt(env[`${prefix}_CONCURRENCY`], 10) : defaults.maxConcurrentJobs,
    maxBatchSize: env[`${prefix}_BATCH_SIZE`] ? parseInt(env[`${prefix}_BATCH_SIZE`], 10) : defaults.maxBatchSize,
    priority: env[`${prefix}_PRIORITY`] ? parseInt(env[`${prefix}_PRIORITY`], 10) : defaults.priority,
  };
}

/**
 * Validate if a tier exists
 */
export function isValidTier(tier: string): tier is UserTier {
  return tier in TIER_CONFIGS;
}

/**
 * Get tier from string with fallback to tier1
 */
export function parseTier(tier: string | undefined): UserTier {
  if (!tier || !isValidTier(tier)) {
    return 'tier1';
  }
  return tier;
}

/**
 * Helper: Get batch size for tier
 */
export function getBatchSizeForTier(tier: UserTier, env?: any): number {
  return getTierConfig(tier, env).maxBatchSize;
}

/**
 * Helper: Get concurrency limit for tier
 */
export function getConcurrencyForTier(tier: UserTier, env?: any): number {
  return getTierConfig(tier, env).maxConcurrentJobs;
}

/**
 * Helper: Get priority for tier
 */
export function getPriorityForTier(tier: UserTier, env?: any): number {
  return getTierConfig(tier, env).priority;
}
