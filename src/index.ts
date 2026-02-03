// Main Cloudflare Worker entry point - Uses Queues + Durable Objects for async processing

import { Env, QueueMessage } from './types/env';
import { handleQueue } from './queue-consumer';
import { handleStatus } from './routes/status';
import { handleCancelStory } from './routes/cancel-story';
import { handleCreateStory } from './routes/create-story';
import { handleGenerateAndCreateStory } from './routes/generate-story';
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

      // Root path - Show available endpoints
      case pathname === '/':
        return jsonResponse({
          error: 'Invalid endpoint',
          message: `The root path '/' is not a valid endpoint. Please use one of the available endpoints:`,
          availableEndpoints: {
            'POST /create-story': 'Create a new story (queued for async processing)',
            'POST /generate-and-create-story': 'Generate script and create story',
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
   * Queue consumer - Processes story generation jobs
   */
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    return handleQueue(batch, env);
  },
};
