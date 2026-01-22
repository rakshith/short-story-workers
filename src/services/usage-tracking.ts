// Usage Tracking Service

import { Env } from '../types/env';

// Cloudflare pricing
const CLOUDFLARE_CPU_COST = 0.00000003; // $0.03 per million CPU-ms

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
