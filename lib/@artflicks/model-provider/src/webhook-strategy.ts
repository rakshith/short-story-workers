/**
 * Webhook Strategy
 * 
 * Provider-agnostic webhook parsing using the Strategy pattern.
 * Each provider has different webhook payload formats.
 * This abstraction allows adding new providers without changing webhook handling logic.
 * 
 * To add a new provider:
 * 1. Implement IWebhookStrategy
 * 2. Register in WebhookStrategyFactory
 */

import { ProviderType, PROVIDER_NAMES } from './types';

/**
 * Normalized webhook status
 */
export type WebhookStatus = 'succeeded' | 'failed' | 'pending';

/**
 * Strategy interface for parsing provider-specific webhooks
 * 
 * Each provider (Replicate, FAL, etc.) sends webhooks in different formats.
 * This interface abstracts those differences so the webhook handler
 * can work with any provider uniformly.
 */
export interface IWebhookStrategy {
  /** The provider this strategy handles */
  readonly provider: ProviderType;
  
  /**
   * Extract the unique request/prediction ID from the webhook body
   * Used for idempotency checks
   */
  extractRequestId(body: unknown): string | undefined;
  
  /**
   * Determine the status of the generation from the webhook body
   * Normalizes provider-specific status values to our standard enum
   */
  getStatus(body: unknown): WebhookStatus;
  
  /**
   * Extract media URLs (images, videos, audio) from the webhook body
   * Handles provider-specific response formats
   */
  extractUrls(body: unknown, mediaType: 'video' | 'image' | 'audio'): string[];
  
  /**
   * Extract error message from the webhook body if generation failed
   */
  getError(body: unknown): string | undefined;
  
  /**
   * Extract prediction/generation time in seconds
   * Used for usage tracking
   */
  getPredictTime(body: unknown): number | undefined;
  
  /**
   * Check if this is an intermediate status update (not terminal)
   * Some providers send multiple webhook calls during processing
   */
  isIntermediateStatus(body: unknown): boolean;
}

/**
 * Replicate webhook strategy
 * 
 * Replicate webhook format:
 * - ID: body.id
 * - Status: body.status ('succeeded', 'failed', 'processing', 'starting', 'canceled')
 * - Output: body.output (string, array, or object with url/href)
 * - Error: body.error (string)
 * - Timing: body.metrics.predict_time
 */
export class ReplicateWebhookStrategy implements IWebhookStrategy {
  readonly provider = PROVIDER_NAMES.REPLICATE;
  
  extractRequestId(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const b = body as Record<string, unknown>;
    return typeof b.id === 'string' ? b.id : undefined;
  }
  
  getStatus(body: unknown): WebhookStatus {
    if (!body || typeof body !== 'object') return 'pending';
    const b = body as Record<string, unknown>;
    const status = typeof b.status === 'string' ? b.status.toLowerCase() : '';
    
    if (status === 'succeeded') return 'succeeded';
    if (['failed', 'canceled', 'cancelled'].includes(status)) return 'failed';
    return 'pending';
  }
  
  extractUrls(body: unknown, mediaType: 'video' | 'image' | 'audio'): string[] {
    if (!body || typeof body !== 'object') return [];
    const b = body as Record<string, unknown>;
    return this.extractOutputUrls(b.output);
  }
  
  getError(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const b = body as Record<string, unknown>;
    return typeof b.error === 'string' ? b.error : undefined;
  }
  
  getPredictTime(body: unknown): number | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const b = body as Record<string, unknown>;
    const metrics = b.metrics as Record<string, unknown> | undefined;
    return typeof metrics?.predict_time === 'number' ? metrics.predict_time : undefined;
  }
  
  isIntermediateStatus(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false;
    const b = body as Record<string, unknown>;
    const status = typeof b.status === 'string' ? b.status.toLowerCase() : '';
    return ['starting', 'processing', 'in_progress'].includes(status);
  }
  
  private extractOutputUrls(output: unknown): string[] {
    if (!output) return [];
    
    if (Array.isArray(output)) {
      return output.map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          if (typeof obj.url === 'string') return obj.url;
          if (typeof obj.href === 'string') return obj.href;
          if (typeof obj.url === 'function') return String((obj.url as Function)());
        }
        return String(item);
      }).filter(Boolean);
    }
    
    if (typeof output === 'string') return [output];
    
    if (output && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      if (typeof obj.url === 'string') return [obj.url];
      if (typeof obj.href === 'string') return [obj.href];
      if (obj.video && typeof obj.video === 'object') {
        const video = obj.video as Record<string, unknown>;
        if (typeof video.url === 'string') return [video.url];
      }
    }
    
    return [];
  }
}

/**
 * FAL.ai webhook strategy
 * 
 * FAL webhook format:
 * - ID: body.request_id or body.requestId
 * - Status: body.status/body.state ('COMPLETED', 'OK', 'completed', 'success', 'succeeded', 'done', 'failed', 'error', 'cancelled')
 * - Output: body.result.data.video.url, body.data.video.url, body.payload.video.url, body.video.url
 * - Error: body.error, body.detail, body.result.detail, body.payload.error
 * - Timing: body.metrics.inference_time
 */
export class FalWebhookStrategy implements IWebhookStrategy {
  readonly provider = PROVIDER_NAMES.FALAI;
  
  extractRequestId(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const b = body as Record<string, unknown>;
    if (typeof b.request_id === 'string') return b.request_id;
    if (typeof b.requestId === 'string') return b.requestId;
    return undefined;
  }
  
  getStatus(body: unknown): WebhookStatus {
    if (!body || typeof body !== 'object') return 'pending';
    const b = body as Record<string, unknown>;
    
    const checkStatus = (s: unknown): WebhookStatus | null => {
      if (typeof s !== 'string') return null;
      const lower = s.toLowerCase();
      if (['completed', 'ok', 'success', 'succeeded', 'done'].includes(lower)) return 'succeeded';
      if (['failed', 'error', 'cancelled', 'canceled'].includes(lower)) return 'failed';
      return null;
    };
    
    let status = checkStatus(b.status) || checkStatus(b.state);
    if (status) return status;
    
    const result = b.result as Record<string, unknown> | undefined;
    status = checkStatus(result?.status) || checkStatus(result?.state);
    if (status) return status;
    
    const payload = b.payload as Record<string, unknown> | undefined;
    status = checkStatus(payload?.status) || checkStatus(payload?.state);
    if (status) return status;
    
    if (this.extractUrlsFromBody(b, 'video').length > 0 ||
        this.extractUrlsFromBody(b, 'image').length > 0) {
      return 'succeeded';
    }
    
    if (b.error || b.detail) return 'failed';
    
    return 'pending';
  }
  
  extractUrls(body: unknown, mediaType: 'video' | 'image' | 'audio'): string[] {
    if (!body || typeof body !== 'object') return [];
    const b = body as Record<string, unknown>;
    
    if (mediaType === 'video') {
      return this.extractUrlsFromBody(b, 'video');
    }
    if (mediaType === 'image') {
      return this.extractUrlsFromBody(b, 'image');
    }
    if (mediaType === 'audio') {
      return this.extractUrlsFromBody(b, 'audio');
    }
    
    return [];
  }
  
  getError(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const b = body as Record<string, unknown>;
    
    if (typeof b.error === 'string') return b.error;
    
    if (b.detail) {
      if (Array.isArray(b.detail) && b.detail.length > 0) {
        const first = b.detail[0] as Record<string, unknown>;
        return (first.msg || first.message || JSON.stringify(first)) as string;
      }
      if (typeof b.detail === 'string') {
        const errorType = b.error_type ? `${b.error_type}: ` : '';
        return `${errorType}${b.detail}`;
      }
    }
    
    const result = b.result as Record<string, unknown> | undefined;
    if (result?.detail) {
      if (Array.isArray(result.detail) && result.detail.length > 0) {
        const first = result.detail[0] as Record<string, unknown>;
        return (first.msg || first.message || JSON.stringify(first)) as string;
      }
      if (typeof result.detail === 'string') return result.detail;
    }
    
    const payload = b.payload as Record<string, unknown> | undefined;
    if (typeof payload?.error === 'string') return payload.error;
    
    return undefined;
  }
  
  getPredictTime(body: unknown): number | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const b = body as Record<string, unknown>;
    const metrics = b.metrics as Record<string, unknown> | undefined;
    return typeof metrics?.inference_time === 'number' ? metrics.inference_time : undefined;
  }
  
  isIntermediateStatus(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false;
    const b = body as Record<string, unknown>;
    const status = (typeof b.status === 'string' ? b.status : typeof b.state === 'string' ? b.state : '').toLowerCase();
    return ['in_progress', 'in queue', 'processing', 'queued', 'pending'].includes(status);
  }
  
  private extractUrlsFromBody(body: Record<string, unknown>, mediaType: 'video' | 'image' | 'audio'): string[] {
    const urlKey = mediaType === 'video' ? 'video' : mediaType === 'image' ? 'image' : 'audio';
    const urlsKey = mediaType === 'video' ? 'videos' : mediaType === 'image' ? 'images' : 'audios';
    
    const urls: string[] = [];
    
    const extractFromObj = (obj: Record<string, unknown>) => {
      if (typeof obj[urlKey] === 'string') {
        urls.push(obj[urlKey] as string);
      } else if (obj[urlKey] && typeof obj[urlKey] === 'object') {
        const media = obj[urlKey] as Record<string, unknown>;
        if (typeof media.url === 'string') urls.push(media.url as string);
      }
      if (Array.isArray(obj[urlsKey])) {
        for (const item of obj[urlsKey]) {
          if (typeof item === 'string') {
            urls.push(item);
          } else if (item && typeof item === 'object') {
            const m = item as Record<string, unknown>;
            if (typeof m.url === 'string') urls.push(m.url as string);
          }
        }
      }
    };
    
    extractFromObj(body);
    
    const result = body.result as Record<string, unknown> | undefined;
    if (result?.data && typeof result.data === 'object') {
      extractFromObj(result.data as Record<string, unknown>);
    }
    
    if (body.data && typeof body.data === 'object') {
      extractFromObj(body.data as Record<string, unknown>);
    }
    
    const payload = body.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload === 'object') {
      extractFromObj(payload);
    }
    
    return [...new Set(urls)];
  }
}

/**
 * Factory for getting the appropriate webhook strategy for a provider
 */
export class WebhookStrategyFactory {
  private static strategies: Map<ProviderType, IWebhookStrategy> = new Map<ProviderType, IWebhookStrategy>([
    [PROVIDER_NAMES.REPLICATE, new ReplicateWebhookStrategy()],
    [PROVIDER_NAMES.FALAI, new FalWebhookStrategy()],
  ]);
  
  /**
   * Get the webhook strategy for a provider
   */
  static getStrategy(provider: ProviderType): IWebhookStrategy {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new Error(`No webhook strategy registered for provider: ${provider}`);
    }
    return strategy;
  }
  
  /**
   * Register a new webhook strategy for a provider
   * Use this to add support for new providers
   */
  static registerStrategy(provider: ProviderType, strategy: IWebhookStrategy): void {
    this.strategies.set(provider, strategy);
  }
  
  /**
   * Check if a strategy is registered for a provider
   */
  static hasStrategy(provider: ProviderType): boolean {
    return this.strategies.has(provider);
  }
}
