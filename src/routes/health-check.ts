// Health Check Endpoint - Monitors all critical dependencies

import { Env } from '../types/env';
import { jsonResponse } from '../utils/response';

interface HealthCheckResult {
  service: string;
  status: 'ok' | 'error' | 'warning';
  latencyMs: number;
  message?: string;
}

export async function handleHealthCheck(env: Env): Promise<Response> {
  const startTime = Date.now();
  
  // Run all health checks in parallel
  const checkResults = await Promise.allSettled([
    checkSupabase(env),
    checkR2Buckets(env),
    checkQueues(env),
    checkReplicateAPI(env),
    checkElevenLabsAPI(env),
    checkDurableObjects(env),
    checkKVCache(env),
  ]);
  
  const results: HealthCheckResult[] = checkResults.map((result, index) => {
    const services = ['supabase', 'r2', 'queues', 'replicate', 'elevenlabs', 'durable_objects', 'kv_cache'];
    
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        service: services[index],
        status: 'error',
        latencyMs: 0,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    }
  });
  
  const failedChecks = results.filter(r => r.status === 'error');
  const warningChecks = results.filter(r => r.status === 'warning');
  
  const overallStatus = failedChecks.length > 0 ? 'unhealthy' : warningChecks.length > 0 ? 'degraded' : 'healthy';
  const statusCode = failedChecks.length > 0 ? 503 : warningChecks.length > 0 ? 200 : 200;
  
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    version: '1.0.0',
    checks: results.reduce((acc, check) => {
      acc[check.service] = {
        status: check.status,
        latencyMs: check.latencyMs,
        message: check.message,
      };
      return acc;
    }, {} as Record<string, unknown>),
  };
  
  return jsonResponse(response, statusCode);
}

async function checkSupabase(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Simple health check query
    const { error } = await supabase.from('stories').select('id').limit(1);
    
    if (error) {
      throw new Error(error.message);
    }
    
    return {
      service: 'supabase',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'supabase',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkR2Buckets(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Check if R2 bindings are accessible by attempting a HEAD request
    const buckets = [
      { name: 'images', binding: env.IMAGES_BUCKET },
      { name: 'audio', binding: env.AUDIO_BUCKET },
      { name: 'videos', binding: env.VIDEO_BUCKET },
    ];
    
    for (const bucket of buckets) {
      if (!bucket.binding) {
        throw new Error(`R2 bucket binding '${bucket.name}' not found`);
      }
      // Try to list objects (limit 1) to verify access
      const objects = await bucket.binding.list({ limit: 1 });
    }
    
    return {
      service: 'r2',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'r2',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkQueues(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Check if queue bindings exist
    if (!env.STORY_QUEUE) {
      throw new Error('STORY_QUEUE binding not found');
    }
    if (!env.WEBHOOK_QUEUE) {
      throw new Error('WEBHOOK_QUEUE binding not found');
    }
    
    return {
      service: 'queues',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'queues',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkReplicateAPI(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    if (!env.REPLICATE_API_TOKEN) {
      return {
        service: 'replicate',
        status: 'warning',
        latencyMs: 0,
        message: 'REPLICATE_API_TOKEN not configured',
      };
    }
    
    // Lightweight check - just verify API is reachable
    const response = await fetch('https://api.replicate.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return {
      service: 'replicate',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'replicate',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkElevenLabsAPI(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    if (!env.ELEVENLABS_API_KEY) {
      return {
        service: 'elevenlabs',
        status: 'warning',
        latencyMs: 0,
        message: 'ELEVENLABS_API_KEY not configured',
      };
    }
    
    // Lightweight check - just verify API is reachable
    const response = await fetch('https://api.elevenlabs.io/v1/models', {
      method: 'GET',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return {
      service: 'elevenlabs',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'elevenlabs',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkDurableObjects(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    if (!env.STORY_COORDINATOR) {
      throw new Error('STORY_COORDINATOR binding not found');
    }
    
    // Try to get a DO stub (we won't actually call it, just verify binding works)
    const id = env.STORY_COORDINATOR.idFromName('health-check-test');
    const stub = env.STORY_COORDINATOR.get(id);
    
    if (!stub) {
      throw new Error('Failed to create Durable Object stub');
    }
    
    return {
      service: 'durable_objects',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'durable_objects',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkKVCache(env: Env): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    // Check if KV cache is configured
    const isEnabled = env.ENABLE_KV_CACHE === 'true';
    const hasBinding = !!env.JOB_STATUS_CACHE;
    
    if (!isEnabled) {
      return {
        service: 'kv_cache',
        status: 'ok',
        latencyMs: Date.now() - start,
        message: 'KV cache disabled (ENABLE_KV_CACHE not set to true)',
      };
    }
    
    if (!hasBinding) {
      return {
        service: 'kv_cache',
        status: 'warning',
        latencyMs: Date.now() - start,
        message: 'KV cache enabled but JOB_STATUS_CACHE binding not found',
      };
    }
    
    // Try a test write/read to verify KV is working
    const testKey = 'health-check-test';
    const testValue = { timestamp: Date.now(), status: 'ok' };
    
    await env.JOB_STATUS_CACHE!.put(testKey, JSON.stringify(testValue), { expirationTtl: 60 });
    const readValue = await env.JOB_STATUS_CACHE!.get(testKey, 'json');
    await env.JOB_STATUS_CACHE!.delete(testKey);
    
    if (!readValue) {
      throw new Error('KV read returned null after write');
    }
    
    return {
      service: 'kv_cache',
      status: 'ok',
      latencyMs: Date.now() - start,
      message: 'KV cache enabled and operational',
    };
  } catch (error) {
    return {
      service: 'kv_cache',
      status: 'error',
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
