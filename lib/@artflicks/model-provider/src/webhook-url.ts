/**
 * Webhook URL Construction
 * 
 * Builds provider-specific webhook URLs.
 * Each provider has different webhook endpoint paths and metadata handling.
 */

import { ProviderType, PROVIDER_NAMES } from './types';

/**
 * Webhook endpoint paths per provider
 * 
 * To add a new provider:
 * 1. Add the provider type to ProviderType
 * 2. Add the webhook endpoint path here
 */
export const WEBHOOK_ENDPOINTS: Record<ProviderType, string> = {
  [PROVIDER_NAMES.REPLICATE]: '/webhooks/replicate',
  [PROVIDER_NAMES.FALAI]: '/webhooks/fal',
  [PROVIDER_NAMES.GATEWAY]: '/webhooks/replicate',
};

/**
 * Build a webhook URL for a specific provider
 * 
 * @param provider - The target provider
 * @param baseUrl - The base URL (e.g., 'https://create-story-worker.artflicks.workers.dev')
 * @param metadata - Query parameters to include (storyId, sceneIndex, type, etc.)
 * @returns The complete webhook URL
 */
export function buildWebhookUrl(
  provider: ProviderType,
  baseUrl: string,
  metadata: Record<string, string | number | boolean | undefined>
): string {
  const endpoint = WEBHOOK_ENDPOINTS[provider] || WEBHOOK_ENDPOINTS[PROVIDER_NAMES.FALAI];
  
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}${endpoint}?${queryString}` : `${baseUrl}${endpoint}`;
}

/**
 * Get the webhook endpoint path for a provider
 */
export function getWebhookEndpoint(provider: ProviderType): string {
  return WEBHOOK_ENDPOINTS[provider] || WEBHOOK_ENDPOINTS[PROVIDER_NAMES.FALAI];
}

/**
 * Detect provider from webhook URL path
 * Useful for routing incoming webhooks to the correct handler
 */
export function detectProviderFromWebhookUrl(url: string): ProviderType | undefined {
  const pathname = new URL(url).pathname;
  
  if (pathname.includes('/webhooks/fal')) {
    return PROVIDER_NAMES.FALAI;
  }
  if (pathname.includes('/webhooks/replicate')) {
    return PROVIDER_NAMES.REPLICATE;
  }
  
  return undefined;
}

/**
 * Metadata keys commonly used in webhook URLs
 */
export const WEBHOOK_METADATA_KEYS = {
  STORY_ID: 'storyId',
  SCENE_INDEX: 'sceneIndex',
  TYPE: 'type',
  USER_ID: 'userId',
  SERIES_ID: 'seriesId',
  JOB_ID: 'jobId',
  MODEL: 'model',
  SCENE_REVIEW_REQUIRED: 'sceneReviewRequired',
} as const;

/**
 * Build standard webhook metadata for a generation request
 */
export function buildWebhookMetadata(params: {
  storyId: string;
  sceneIndex: number;
  type: 'image' | 'video' | 'avatar';
  userId: string;
  jobId: string;
  model: string;
  seriesId?: string;
  sceneReviewRequired?: boolean;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    [WEBHOOK_METADATA_KEYS.STORY_ID]: params.storyId,
    [WEBHOOK_METADATA_KEYS.SCENE_INDEX]: String(params.sceneIndex),
    [WEBHOOK_METADATA_KEYS.TYPE]: params.type,
    [WEBHOOK_METADATA_KEYS.USER_ID]: params.userId,
    [WEBHOOK_METADATA_KEYS.JOB_ID]: params.jobId,
    [WEBHOOK_METADATA_KEYS.MODEL]: params.model,
  };
  
  if (params.seriesId) {
    metadata[WEBHOOK_METADATA_KEYS.SERIES_ID] = params.seriesId;
  }
  
  if (params.sceneReviewRequired !== undefined) {
    metadata[WEBHOOK_METADATA_KEYS.SCENE_REVIEW_REQUIRED] = String(params.sceneReviewRequired);
  }
  
  return metadata;
}
