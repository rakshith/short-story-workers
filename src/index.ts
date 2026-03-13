// Main Cloudflare Worker entry point - Uses Queues + Durable Objects for async processing

import { Env, QueueMessage, WebhookQueueMessage } from './types/env';
import { handleQueue, handleWebhookQueue } from './queue-consumer';
import { handleStatus } from './routes/status';
import { handleCancelStory } from './routes/cancel-story';
import { handleCreateStory } from './routes/create-story';
import { handleGenerateAndCreateStory } from './routes/generate-story';
import { handleReplicateWebhook, handleReplicateWebhookRecover } from './services/webhook-handler';
import { jsonResponse, corsResponse, notFoundResponse } from './utils/response';

// Generation Engine imports
import { createCreateJobAPI, createJobStatusAPI, createApproveStepAPI } from './generation-engine/api';

// Export Durable Object class
export { StoryCoordinator } from './durable-objects/story-coordinator';

export default {
  /**
   * HTTP request handler - Routes requests to appropriate handlers
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { method, pathname } = { method: request.method, pathname: url.pathname };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse();
    }

    // Route requests to handlers
    const isApproveRoute = method === 'POST' && /^\/api\/jobs\/[^/]+\/approve$/.test(pathname);
    const isCancelRoute = method === 'POST' && /^\/api\/jobs\/[^/]+\/cancel$/.test(pathname);
    const isJobStatusRoute = method === 'GET' && /^\/api\/jobs\/[^/]+$/.test(pathname) && !pathname.includes('/approve') && !pathname.includes('/cancel');
    
    switch (true) {
      // GET /status - Check job progress
      case method === 'GET' && pathname === '/status':
        return handleStatus(request, env);

      // POST /cancel-generation - Cancel a running generation
      case method === 'POST' && pathname === '/cancel-generation':
        return handleCancelStory(request, env);

      // POST /webhooks/replicate - Replicate callback webhook (fire-and-forget when ctx provided)
      case method === 'POST' && pathname === '/webhooks/replicate':
        return handleReplicateWebhook(request, env, ctx);

      // POST /webhooks/replicate/recover - Recover missed webhook by prediction ID (fetch from Replicate, then process)
      case method === 'POST' && pathname === '/webhooks/replicate/recover':
        return handleReplicateWebhookRecover(request, env);

      // POST /generate-and-create-story - AI script generation + story creation
      case method === 'POST' && pathname === '/generate-and-create-story':
        return handleGenerateAndCreateStory(request, env);

      // POST /create-story - Create story from existing script
      case method === 'POST' && pathname === '/create-story':
        return handleCreateStory(request, env);

      // POST /create-story-sync - Deprecated synchronous endpoint
      case method === 'POST' && pathname === '/create-story-sync':
        return jsonResponse({ error: 'Synchronous endpoint deprecated. Use /create-story instead.' }, 410);

      // === Generation Engine API Routes ===
      
      // POST /api/jobs - Create new generation job
      case method === 'POST' && pathname === '/api/jobs':
        return handleCreateJob(request, env);

      // GET /api/jobs/:id - Get job status
      case isJobStatusRoute:
        return handleGetJobStatus(request, env);

      // POST /api/jobs/:id/approve - Approve step (scene review)
      case isApproveRoute:
        return handleApproveStep(request, env);

      // POST /api/jobs/:id/cancel - Cancel job
      case isCancelRoute:
        return handleCancelJob(request, env);

      // Root path - Show available endpoints
      case pathname === '/':
        return jsonResponse({
          error: 'Invalid endpoint',
          message: `The root path '/' is not a valid endpoint. Please use one of the available endpoints:`,
          availableEndpoints: {
            // Legacy endpoints
            'POST /create-story': 'Create a new story (queued for async processing)',
            'POST /generate-and-create-story': 'Generate script and create story',
            'POST /cancel-generation': 'Cancel a currently running generation job',
            'GET /status?jobId=<jobId>': 'Check the status of a story generation job',
            // Generation Engine API
            'POST /api/jobs': 'Create a new generation job (DAG-based)',
            'GET /api/jobs/:id': 'Get job status',
            'POST /api/jobs/:id/approve': 'Approve a step (e.g., scene review)',
            'POST /api/jobs/:id/cancel': 'Cancel a job',
          },
          method,
          path: pathname,
        }, 404);

      // 404 - Not found
      default:
        return notFoundResponse(method, pathname);
    }
  },

  /**
   * Queue consumer - Story jobs or webhook processing (routed by batch.queue)
   */
  async queue(batch: MessageBatch<QueueMessage | WebhookQueueMessage>, env: Env): Promise<void> {
    if (batch.queue.includes('webhook-processing')) {
      return handleWebhookQueue(batch as MessageBatch<WebhookQueueMessage>, env);
    }

    const useDAG = env.USE_DAG_ENGINE === 'true';
    
    if (useDAG) {
      console.log('[Queue] Using DAG Engine for processing');
      const { handleQueueDAG } = await import('./generation-engine/queue/executionWorker');
      return handleQueueDAG(batch as MessageBatch<QueueMessage>, env);
    }

    console.log('[Queue] Using Legacy Queue Consumer');
    return handleQueue(batch as MessageBatch<QueueMessage>, env);
  },
};

// === Generation Engine API Handlers ===

async function handleCreateJob(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    
    if (!body.userId || !body.templateId || !body.prompt) {
      return jsonResponse({ 
        error: 'Missing required fields',
        required: ['userId', 'templateId', 'prompt']
      }, 400);
    }

    const api = createCreateJobAPI(env);
    const result = await api.execute({
      userId: body.userId,
      templateId: body.templateId,
      profileId: body.profileId,
      prompt: body.prompt,
      videoConfig: body.videoConfig,
    });

    if (!result.success) {
      return jsonResponse({ error: result.error }, 500);
    }

    return jsonResponse({
      success: true,
      jobId: result.jobId,
      storyId: result.storyId,
    }, 201);
  } catch (error) {
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Failed to create job' 
    }, 500);
  }
}

async function handleGetJobStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const jobId = url.pathname.split('/').pop();

    if (!jobId) {
      return jsonResponse({ error: 'Job ID required' }, 400);
    }

    const api = createJobStatusAPI(env);
    const result = await api.execute(jobId);

    if (!result.success) {
      return jsonResponse({ error: result.error }, 404);
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Failed to get job status' 
    }, 500);
  }
}

async function handleApproveStep(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 2];
    const body = await request.json() as any;

    if (!body.storyId || !body.userId) {
      return jsonResponse({ 
        error: 'Missing required fields',
        required: ['storyId', 'userId']
      }, 400);
    }

    const api = createApproveStepAPI(env);
    const result = await api.execute({
      jobId,
      storyId: body.storyId,
      userId: body.userId,
      approvedScenes: body.approvedScenes,
      step: body.step || 'scene-review',
    });

    if (!result.success) {
      return jsonResponse({ error: result.error }, 500);
    }

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Failed to approve step' 
    }, 500);
  }
}

async function handleCancelJob(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 2];

    if (!jobId) {
      return jsonResponse({ error: 'Job ID required' }, 400);
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: job, error: jobError } = await supabase
      .from('story_jobs')
      .select('story_id')
      .eq('job_id', jobId)
      .single();

    if (jobError || !job) {
      return jsonResponse({ error: 'Job not found' }, 404);
    }

    const id = env.STORY_COORDINATOR.idFromName(job.story_id);
    const coordinator = env.STORY_COORDINATOR.get(id);
    await coordinator.fetch(new Request('http://do/cancel', { method: 'POST' }));

    await supabase
      .from('story_jobs')
      .update({ status: 'cancelled' })
      .eq('job_id', jobId);

    return jsonResponse({ success: true, jobId });
  } catch (error) {
    return jsonResponse({ 
      error: error instanceof Error ? error.message : 'Failed to cancel job' 
    }, 500);
  }
}
