// Usage and Cost Tracking Service
// Records detailed cost metrics for story generation

import { Env } from '../types/env';

// Provider pricing (in USD)
export const PRICING = {
  replicate: {
    // Image generation models
    'black-forest-labs/flux-schnell': 0.003, // basic
    'black-forest-labs/flux-1.1-pro': 0.04, // pro
    'black-forest-labs/flux-kontext-pro': 0.04, // pro
    'black-forest-labs/flux-dev': 0.025, // ulta
    'ideogram-ai/ideogram-v3-turbo': 0.03, // ultra
    'black-forest-labs/flux-1.1-pro-ultra': 0.06, // max
    'google/nano-banana': 0.039, // max
    'openai/gpt-image-1.5': 0.136, // max regardless of multiple properties

    // Video generation models
    'wan-video/wan-2.5-t2v-fast': 0.102, // basic normal - 0.068
    'wan-video/wan-2.6-t2v': 0.15, // pro 0.10
    'fal-ai/veo3.1/fast/first-last-frame-to-video': 0.15, // ultra 0.10
    'kwaivgi/kling-v2.5-turbo-pro': 0.07, // max
  },
  openai: {
    // TTS pricing per 1000 characters
    'tts-1': 0.015 / 1000,
    'tts-1-hd': 0.030 / 1000,
  },
  elevenlabs: {
    // Pricing per 1000 characters
    'eleven_turbo_v2.5': 0.00018 / 1000,
    'eleven_turbo_v2': 0.00030 / 1000,
    'eleven_v3': 0.00045 / 1000,
    'eleven_multilingual_v2': 0.00060 / 1000,
  },
  cloudflare: {
    // Worker pricing
    worker_invocation: 0.00000015, // $0.15 per million
    worker_cpu_ms: 0.00000003, // $0.03 per million CPU-ms
    
    // Queue pricing
    queue_message: 0.0000004, // $0.40 per million
    
    // R2 pricing
    r2_write: 0.0000045, // $4.50 per million
    r2_read: 0.00000036, // $0.36 per million
  },
};

export interface UsageRecord {
  jobId: string;
  userId: string;
  storyId?: string;
  provider: 'replicate' | 'openai' | 'elevenlabs' | 'cloudflare';
  resourceType: 'image' | 'audio' | 'video' | 'worker_invocation' | 'queue_message' | 'db_query' | 'storage_write';
  operation?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  sceneIndex?: number;
  modelUsed?: string;
  metadata?: Record<string, any>;
}

/**
 * Track usage and cost for a story generation operation
 * Idempotent: Won't create duplicate records for same job+scene+provider+resource
 */
export async function trackUsage(record: UsageRecord, env: Env): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from('story_usage_tracking')
      .insert({
        job_id: record.jobId,
        user_id: record.userId,
        story_id: record.storyId,
        provider: record.provider,
        resource_type: record.resourceType,
        operation: record.operation,
        quantity: record.quantity,
        unit_cost_usd: record.unitCost,
        total_cost_usd: record.totalCost,
        scene_index: record.sceneIndex,
        model_used: record.modelUsed,
        metadata: record.metadata,
      });

    // Ignore unique constraint violations (idempotency - already tracked)
    if (error && error.code !== '23505') { // 23505 = unique_violation
      console.error('[Usage Tracking] Failed to record usage:', error);
    } else if (error?.code === '23505') {
      console.log('[Usage Tracking] Already tracked (idempotency):', {
        jobId: record.jobId,
        scene: record.sceneIndex,
        provider: record.provider,
        type: record.resourceType,
      });
    }
  } catch (error) {
    console.error('[Usage Tracking] Error:', error);
  }
}

/**
 * Track Replicate image generation cost
 */
export async function trackImageGeneration(
  jobId: string,
  userId: string,
  storyId: string,
  sceneIndex: number,
  model: string,
  env: Env
): Promise<void> {
  // Try to match the model to a pricing key, default to flux-schnell (cheapest)
  const modelLower = model.toLowerCase();
  let unitCost = PRICING.replicate['black-forest-labs/flux-schnell']; // Default
  
  // Match against actual pricing keys
  if (modelLower.includes('flux-schnell')) {
    unitCost = PRICING.replicate['black-forest-labs/flux-schnell'];
  } else if (modelLower.includes('flux-1.1-pro') || modelLower.includes('flux-kontext-pro')) {
    unitCost = PRICING.replicate['black-forest-labs/flux-1.1-pro'];
  } else if (modelLower.includes('flux-dev')) {
    unitCost = PRICING.replicate['black-forest-labs/flux-dev'];
  } else if (modelLower.includes('ideogram')) {
    unitCost = PRICING.replicate['ideogram-ai/ideogram-v3-turbo'];
  } else if (modelLower.includes('flux-pro') || modelLower.includes('flux-ultra')) {
    unitCost = PRICING.replicate['black-forest-labs/flux-1.1-pro-ultra'];
  } else if (modelLower.includes('nano-banana')) {
    unitCost = PRICING.replicate['google/nano-banana'];
  } else if (modelLower.includes('gpt-image')) {
    unitCost = PRICING.replicate['openai/gpt-image-1.5'];
  }

  await trackUsage({
    jobId,
    userId,
    storyId,
    provider: 'replicate',
    resourceType: 'image',
    operation: 'image-generation',
    quantity: 1,
    unitCost,
    totalCost: unitCost,
    sceneIndex,
    modelUsed: model,
  }, env);
}

/**
 * Track Replicate video generation cost
 */
export async function trackVideoGeneration(
  jobId: string,
  userId: string,
  storyId: string,
  sceneIndex: number,
  model: string,
  env: Env
): Promise<void> {
  // Try to match the model to a pricing key, default to wan-video (cheapest video)
  const modelLower = model.toLowerCase();
  let unitCost = PRICING.replicate['wan-video/wan-2.5-t2v-fast']; // Default
  
  // Match against actual video model pricing keys
  if (modelLower.includes('wan-2.5') || modelLower.includes('wan-video')) {
    unitCost = PRICING.replicate['wan-video/wan-2.5-t2v-fast'];
  } else if (modelLower.includes('wan-2.6')) {
    unitCost = PRICING.replicate['wan-video/wan-2.6-t2v'];
  } else if (modelLower.includes('veo') || modelLower.includes('fal-ai')) {
    unitCost = PRICING.replicate['fal-ai/veo3.1/fast/first-last-frame-to-video'];
  } else if (modelLower.includes('kling')) {
    unitCost = PRICING.replicate['kwaivgi/kling-v2.5-turbo-pro'];
  }

  await trackUsage({
    jobId,
    userId,
    storyId,
    provider: 'replicate',
    resourceType: 'video',
    operation: 'video-generation',
    quantity: 1,
    unitCost,
    totalCost: unitCost,
    sceneIndex,
    modelUsed: model,
  }, env);
}

/**
 * Track audio generation cost (OpenAI or ElevenLabs)
 */
export async function trackAudioGeneration(
  jobId: string,
  userId: string,
  storyId: string,
  sceneIndex: number,
  provider: 'openai' | 'elevenlabs',
  voice: string,
  textLength: number,
  env: Env
): Promise<void> {
  let unitCost: number;
  let operation: string;

  if (provider === 'openai') {
    unitCost = PRICING.openai['tts-1'];
    operation = 'tts-1-generation';
  } else {
    unitCost = PRICING.elevenlabs['eleven_multilingual_v2'];
    operation = 'elevenlabs-tts';
  }

  const totalCost = textLength * unitCost;

  await trackUsage({
    jobId,
    userId,
    storyId,
    provider,
    resourceType: 'audio',
    operation,
    quantity: textLength,
    unitCost,
    totalCost,
    sceneIndex,
    modelUsed: voice,
    metadata: {
      text_length: textLength,
    },
  }, env);
}

/**
 * Track Cloudflare Worker invocation
 */
export async function trackWorkerInvocation(
  jobId: string,
  userId: string,
  storyId: string,
  env: Env
): Promise<void> {
  const unitCost = PRICING.cloudflare.worker_invocation;

  await trackUsage({
    jobId,
    userId,
    storyId,
    provider: 'cloudflare',
    resourceType: 'worker_invocation',
    operation: 'queue-consumer-invocation',
    quantity: 1,
    unitCost,
    totalCost: unitCost,
  }, env);
}

/**
 * Track queue message cost
 */
export async function trackQueueMessage(
  jobId: string,
  userId: string,
  storyId: string,
  messageCount: number,
  env: Env
): Promise<void> {
  const unitCost = PRICING.cloudflare.queue_message;
  const totalCost = messageCount * unitCost;

  await trackUsage({
    jobId,
    userId,
    storyId,
    provider: 'cloudflare',
    resourceType: 'queue_message',
    operation: 'story-queue-messages',
    quantity: messageCount,
    unitCost,
    totalCost,
  }, env);
}

/**
 * Track R2 storage write
 */
export async function trackStorageWrite(
  jobId: string,
  userId: string,
  storyId: string,
  sceneIndex: number,
  fileType: 'image' | 'audio' | 'video',
  env: Env
): Promise<void> {
  const unitCost = PRICING.cloudflare.r2_write;

  await trackUsage({
    jobId,
    userId,
    storyId,
    provider: 'cloudflare',
    resourceType: 'storage_write',
    operation: `r2-${fileType}-upload`,
    quantity: 1,
    unitCost,
    totalCost: unitCost,
    sceneIndex,
  }, env);
}

/**
 * Get total cost for a job
 */
export async function getJobCost(jobId: string, env: Env): Promise<{
  totalCost: number;
  breakdown: Record<string, number>;
}> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('story_cost_summary')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error || !data) {
      return { totalCost: 0, breakdown: {} };
    }

    return {
      totalCost: parseFloat(data.total_cost_usd || '0'),
      breakdown: {
        replicate: parseFloat(data.replicate_cost_usd || '0'),
        openai: parseFloat(data.openai_cost_usd || '0'),
        elevenlabs: parseFloat(data.elevenlabs_cost_usd || '0'),
        cloudflare: parseFloat(data.cloudflare_cost_usd || '0'),
      },
    };
  } catch (error) {
    console.error('[Usage Tracking] Error getting job cost:', error);
    return { totalCost: 0, breakdown: {} };
  }
}

/**
 * Get user's total spending
 */
export async function getUserSpending(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  env?: Env
): Promise<number> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env!.SUPABASE_URL, env!.SUPABASE_SERVICE_ROLE_KEY);

    let query = supabase
      .from('story_usage_tracking')
      .select('total_cost_usd')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('recorded_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('recorded_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return 0;
    }

    return data.reduce((sum, record) => sum + parseFloat(record.total_cost_usd || '0'), 0);
  } catch (error) {
    console.error('[Usage Tracking] Error getting user spending:', error);
    return 0;
  }
}

