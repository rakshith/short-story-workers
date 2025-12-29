// Concurrency manager for tier-based job processing
// Ensures cost-effective resource usage by limiting concurrent jobs per tier

import { Env } from '../types/env';
import { parseTier, getConcurrencyForTier } from '../config/tier-config';

/**
 * Check if user can process more jobs based on their tier concurrency limit
 * Uses Supabase to track active jobs per user
 */
export async function canProcessJob(
  userId: string,
  userTier: string | undefined,
  env: Env
): Promise<{ allowed: boolean; reason?: string; activeConcurrency?: number; maxConcurrency?: number }> {
  try {
    const tier = parseTier(userTier);
    const maxConcurrency = getConcurrencyForTier(tier);

    // Get active jobs for this user from database
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: activeJobs, error } = await supabase
      .from('story_jobs')
      .select('job_id')
      .eq('user_id', userId)
      .eq('status', 'processing');

    if (error) {
      console.error('[Concurrency Manager] Error checking active jobs:', error);
      // On error, allow processing (fail-open to avoid blocking legitimate requests)
      return { allowed: true };
    }

    const activeConcurrency = activeJobs?.length || 0;

    if (activeConcurrency >= maxConcurrency) {
      return {
        allowed: false,
        reason: `User ${userId} has ${activeConcurrency} active jobs. Tier ${tier} allows maximum ${maxConcurrency} concurrent jobs.`,
        activeConcurrency,
        maxConcurrency,
      };
    }

    return {
      allowed: true,
      activeConcurrency,
      maxConcurrency,
    };
  } catch (error) {
    console.error('[Concurrency Manager] Unexpected error:', error);
    // On error, allow processing (fail-open)
    return { allowed: true };
  }
}

/**
 * Sort queue messages by priority (higher priority first)
 * Used to process high-tier users before low-tier users
 * Works with Cloudflare Workers Message type where priority is in message.body
 */
export function sortMessagesByPriority<T extends { body: { priority?: number } }>(messages: readonly T[]): T[] {
  // Create a copy since the input array is readonly
  return [...messages].sort((a, b) => {
    const priorityA = a.body.priority || 0;
    const priorityB = b.body.priority || 0;
    return priorityB - priorityA; // Higher priority first
  });
}

