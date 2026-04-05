// Main Cloudflare Worker entry point - Uses Queues + Durable Objects for async processing

import { Env, QueueMessage, WebhookQueueMessage } from './types/env';
import { handleQueue, handleWebhookQueue, handleDlqQueue } from './queue-consumer';
import { handleStatus } from './routes/status';
import { handleCancelStory } from './routes/cancel-story';
import { handleCreateStory } from './routes/create-story';
import { handleGenerateAndCreateStory } from './routes/generate-story';
import { handleScriptToVideo } from './routes/script-to-video';
import { handleReplicateWebhook, handleReplicateWebhookRecover } from './services/webhook-handler';
import { jsonResponse, corsResponse, notFoundResponse } from './utils/response';

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
    switch (true) {
      // GET /status - Check job progress
      case method === 'GET' && pathname === '/status':
        return handleStatus(request, env);

      // GET /sse - Server-Sent Events for story updates (routes to DO)
      case method === 'GET' && pathname === '/sse':
        return this.handleSSE(request, env);

      // POST /broadcast - Broadcast to SSE clients via DO
      case method === 'POST' && pathname === '/broadcast':
        return this.handleBroadcast(request, env);

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

      // POST /script-to-video - Generate from user script with hints [Visual] Narration
      case method === 'POST' && pathname === '/script-to-video':
        return handleScriptToVideo(request, env);

      // POST /create-story - Create story from existing script
      case method === 'POST' && pathname === '/create-story':
        return handleCreateStory(request, env);

      // POST /create-story-sync - Deprecated synchronous endpoint
      case method === 'POST' && pathname === '/create-story-sync':
        return jsonResponse({ error: 'Synchronous endpoint deprecated. Use /create-story instead.' }, 410);

      // Root path - Show available endpoints
      case pathname === '/':
        return jsonResponse({
          error: 'Invalid endpoint',
          message: `The root path '/' is not a valid endpoint. Please use one of the available endpoints:`,
          availableEndpoints: {
            'POST /create-story': 'Create a new story (queued for async processing)',
            'POST /generate-and-create-story': 'Generate script and create story',
            'POST /script-to-video': 'Generate from user script with [Visual] Narration hints',
            'POST /cancel-generation': 'Cancel a currently running generation job',
            'GET /status?jobId=<jobId>': 'Check the status of a story generation job',
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
   * Handle SSE connections - route to StoryCoordinator DO
   */
  async handleSSE(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const storyId = url.searchParams.get('storyId');

    if (!storyId) {
      return new Response('Missing storyId parameter', { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Get the DO stub for this story
    const id = env.STORY_COORDINATOR.idFromName(storyId);
    const coordinator = env.STORY_COORDINATOR.get(id);

    // Forward the request to the DO
    return coordinator.fetch(request);
  },

  /**
   * Handle broadcast - forward to StoryCoordinator DO
   */
  async handleBroadcast(request: Request, env: Env): Promise<Response> {
    try {
      const body = await request.json() as { storyId: string; data: any };
      const { storyId, data } = body;

      if (!storyId) {
        return new Response(JSON.stringify({ error: 'Missing storyId' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get the DO stub for this story
      const id = env.STORY_COORDINATOR.idFromName(storyId);
      const coordinator = env.STORY_COORDINATOR.get(id);

      // Forward to DO
      return coordinator.fetch(new Request('http://do/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, data }),
      }));
    } catch (error) {
      console.error('[Index] Error in handleBroadcast:', error);
      return new Response(JSON.stringify({ error: 'Failed to broadcast' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * Queue consumer - Story jobs or webhook processing (routed by batch.queue)
   */
  async queue(batch: MessageBatch<QueueMessage | WebhookQueueMessage>, env: Env): Promise<void> {
    if (batch.queue.includes('webhook-processing')) {
      return handleWebhookQueue(batch as MessageBatch<WebhookQueueMessage>, env);
    }
    if (batch.queue.includes('story-dlq')) {
      return handleDlqQueue(batch as MessageBatch<QueueMessage>, env);
    }
    return handleQueue(batch as MessageBatch<QueueMessage>, env);
  },
};
