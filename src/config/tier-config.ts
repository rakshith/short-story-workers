// Tier-based configuration for cost-effective story generation
// Focus: Concurrency control, batch processing, and priority for cost optimization

export type UserTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface TierConfig {
  maxConcurrentJobs: number;           // Max concurrent jobs to control compute costs
  maxBatchSize: number;                // Batch size for efficient queue processing
  priority: number;                    // Priority level (higher = processed first)
}

export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  tier1: {
    maxConcurrentJobs: 2,                // Low concurrency = lower compute costs
    maxBatchSize: 3,                     // Small batches
    priority: 1,                         // Lowest priority
  },
  tier2: {
    maxConcurrentJobs: 5,                // Moderate concurrency
    maxBatchSize: 5,                     // Medium batches
    priority: 2,                         // Medium priority
  },
  tier3: {
    maxConcurrentJobs: 10,               // High concurrency
    maxBatchSize: 10,                    // Large batches
    priority: 3,                         // High priority
  },
  tier4: {
    maxConcurrentJobs: 20,               // Maximum concurrency
    maxBatchSize: 15,                    // Largest batches for efficiency
    priority: 4,                         // Highest priority
  },
};

/**
 * Get tier configuration for a user tier
 */
export function getTierConfig(tier: UserTier): TierConfig {
  return TIER_CONFIGS[tier];
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
    return 'tier1'; // Default to tier1
  }
  return tier;
}

/**
 * Get batch size for queue processing based on tier
 */
export function getBatchSizeForTier(tier: UserTier): number {
  const config = getTierConfig(tier);
  return config.maxBatchSize;
}

/**
 * Get concurrency limit for tier
 */
export function getConcurrencyForTier(tier: UserTier): number {
  const config = getTierConfig(tier);
  return config.maxConcurrentJobs;
}

/**
 * Get priority for tier (used for queue processing order)
 */
export function getPriorityForTier(tier: UserTier): number {
  const config = getTierConfig(tier);
  return config.priority;
}

