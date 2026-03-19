// Usage Tracking Service

import { Env } from '../types/env';
import type { CostResponse } from '@artflicks/credit-tracker';

// Cloudflare pricing
const CLOUDFLARE_CPU_COST = 0.00000003; // $0.03 per million CPU-ms

/**
 * Detect environment type from worker URL subdomain
 * staging: create-story-worker-staging.*.workers.dev
 * prod: create-story-worker-production.*.workers.dev
 */
function detectEnvType(env: Env): 'prod' | 'test' {
  const appUrl = env.APP_URL || '';
  
  // Check subdomain patterns
  if (appUrl.includes('-staging.')) {
    return 'test'; // Staging uses test credit pool
  }
  if (appUrl.includes('-production.')) {
    return 'prod'; // Production uses prod credit pool
  }
  
  // Default to test for safety (won't accidentally deduct from prod)
  console.warn('[Usage Tracking] Could not detect environment from APP_URL, defaulting to test');
  return 'test';
}

/**
 * Deduct credits from user's account
 * Called by Cloudflare after cost calculation
 */
export async function deductCredits(
  userId: string,
  credits: number,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Auto-detect environment from URL subdomain
    const envType = detectEnvType(env);

    const { data, error } = await supabase.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_env_type: envType
    });

    if (error) {
      console.error('[Usage Tracking] Failed to deduct credits:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.error('[Usage Tracking] Insufficient credits or deduction failed');
      return { success: false, error: 'Insufficient credits' };
    }

    console.log(`[Usage Tracking] Successfully deducted ${credits} credits for user ${userId} (env: ${envType})`);
    return { success: true };
  } catch (error) {
    console.error('[Usage Tracking] Error deducting credits:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Track credits cost to story_costs table
 * Uses the centralized pricing cost breakdown
 */
export async function trackCreditsCost(
  jobId: string,
  userId: string,
  storyId: string,
  costResponse: CostResponse,
  env: Env
): Promise<{ success: boolean; error?: string }> {
  if (!costResponse.valid || costResponse.credits <= 0) {
    console.log('[Usage Tracking] No valid credits cost to track');
    return { success: false, error: 'Invalid cost' };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Update story_costs with credits info
    const { error } = await supabase
      .from('story_costs')
      .update({
        credits_cost: costResponse.credits,
        credits_breakdown: costResponse.breakdown as any,
        credits_calculated_at: new Date().toISOString()
      })
      .eq('job_id', jobId);

    if (error) {
      console.error('[Usage Tracking] Failed to track credits cost:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Usage Tracking] Tracked ${costResponse.credits} credits for job ${jobId}`);
    return { success: true };
  } catch (error) {
    console.error('[Usage Tracking] Error tracking credits cost:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Track and deduct credits in one operation
 * Called after cost calculation
 */
export async function trackAndDeductCredits(
  jobId: string,
  userId: string,
  storyId: string,
  costResponse: CostResponse,
  env: Env
): Promise<{ deducted: boolean; error?: string }> {
  // First track the cost in story_costs
  const trackResult = await trackCreditsCost(jobId, userId, storyId, costResponse, env);
  
  if (!trackResult.success) {
    return { deducted: false, error: trackResult.error };
  }

  // Then deduct credits from user
  const deductResult = await deductCredits(userId, costResponse.credits, env);
  
  if (!deductResult.success) {
    // Note: The cost was already tracked, but deduction failed
    // This could indicate insufficient credits
    return { deducted: false, error: deductResult.error };
  }

  return { deducted: true };
}

/**
 * Track Cloudflare Worker CPU time to story_costs table
 */
export async function trackWorkerCpuTime(
  jobId: string,
  userId: string,
  storyId: string,
  cpuTimeMs: number,
  sceneIndex: number,
  messageType: 'image' | 'video' | 'audio',
  env: Env
): Promise<void> {
  const totalCost = cpuTimeMs * CLOUDFLARE_CPU_COST;
  const opKey = `scene${sceneIndex}_cloudflare_cpu_${messageType}`;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    await supabase.rpc('track_story_cost', {
      p_job_id: jobId,
      p_user_id: userId,
      p_story_id: storyId,
      p_provider: 'cloudflare',
      p_cost: totalCost,
      p_op_key: opKey,
      p_last_op: `cpu-${messageType}`
    });
  } catch (error) {
    console.error('[Usage Tracking] Failed to track CPU time:', error);
  }
}

/**
 * Internal usage tracking for AI Metering Service
 * Sends metrics to /api/internal/ai-usage
 */
export async function trackAIUsageInternal(
  env: Env,
  params: {
    userId: string;
    teamId?: string;
    provider: string;
    model: string;
    feature: string;
    type: 'text' | 'image' | 'video' | 'audio';
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    characterCount?: number;
    durationSeconds?: number;
    correlationId?: string;
    source?: string;
    // Image specific
    width?: number;
    height?: number;
    count?: number;
    quality?: string;
    // Video specific
    hasAudio?: boolean;
    resolution?: string;
  }
): Promise<void> {
  if (!env.AI_METER_INGEST_KEY || !env.APP_URL) return;

  try {
    const url = `${env.APP_URL}/api/internal/ai-usage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AI_METER_INGEST_KEY}`
      },
      body: JSON.stringify({
        type: params.type,
        userId: params.userId,
        teamId: params.teamId,
        data: {
          provider: params.provider,
          model: params.model,
          feature: params.feature,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          totalTokens: params.totalTokens,
          characterCount: params.characterCount,
          durationSeconds: params.durationSeconds,
          width: params.width,
          height: params.height,
          count: params.count,
          quality: params.quality,
          hasAudio: params.hasAudio,
          resolution: params.resolution,
          correlationId: params.correlationId,
          source: params.source || 'api'
        }
      })
    });
    // Consume response to prevent stalled HTTP warning
    await response.text();
  } catch (error) {
    console.error('[Usage Tracking] Failed to track internal usage:', error);
  }
}
