// Webhook Worker - processes Replicate webhooks

import { WebhookPayload } from '../types';

export interface WebhookWorkerOptions {
  env: any;
}

export class WebhookWorker {
  private env: any;

  constructor(options: WebhookWorkerOptions) {
    this.env = options.env;
  }

  async processWebhook(prediction: any, metadata: any, origin?: string): Promise<void> {
    const { processWebhookInBackground } = await import('../../services/webhook-handler');
    await processWebhookInBackground(prediction, metadata, this.env, origin);
  }

  async handleWebhook(request: Request): Promise<Response> {
    const { handleReplicateWebhook } = await import('../../services/webhook-handler');
    return handleReplicateWebhook(request, this.env);
  }

  async recoverWebhook(predictionId: string): Promise<void> {
    const { handleReplicateWebhookRecover } = await import('../../services/webhook-handler');
    const request = new Request('http://internal/recover', {
      method: 'POST',
      body: JSON.stringify({ predictionId }),
    });
    await handleReplicateWebhookRecover(request, this.env);
  }
}

export function createWebhookWorker(options: WebhookWorkerOptions): WebhookWorker {
  return new WebhookWorker(options);
}
