// Environment types for Cloudflare Workers

import { R2Bucket, Queue, DurableObjectNamespace } from '@cloudflare/workers-types';
import { StoryTimeline, VideoConfig } from '.';
import { TemplatePipelineConfig } from '../config/template-config';

// Forward declare QueueMessage to avoid circular dependency
// Using any for storyData to avoid circular imports - it will be properly typed at usage sites
export interface QueueMessage {
  jobId: string;
  userId: string;
  seriesId?: string;
  storyId: string;
  title: string;
  storyData?: StoryTimeline; // Optional - workers fetch from DO if not provided
  videoConfig: VideoConfig;
  sceneIndex: number;
  type: 'image' | 'video' | 'audio' | 'finalize';
  baseUrl?: string;
  teamId?: string;
  userTier?: string;
  priority?: number;
  generatedImageUrl?: string; // For video generation - use generated image as reference
  /** Real clip duration derived from ElevenLabs audioDuration; overrides scene.duration when present */
  sceneDuration?: number;
  /** Template-specific configuration for pipeline (audio, models, etc.) */
  templateConfig?: TemplatePipelineConfig;
}

/** Webhook queue: durable processing so Replicate always gets 200 without waitUntil eviction */
export interface WebhookQueueMessage {
  prediction: unknown;
  metadata: {
    storyId: string;
    sceneIndex: number;
    type: 'image' | 'video';
    userId: string;
    seriesId: string;
    jobId: string;
    model: string;
    sceneReviewRequired?: boolean;
  };
  origin?: string;
}

export interface Env {
  // R2 Buckets
  IMAGES_BUCKET: R2Bucket;
  AUDIO_BUCKET: R2Bucket;
  VIDEO_BUCKET: R2Bucket;

  // Queues
  STORY_QUEUE: Queue<QueueMessage>;
  STORY_DLQ?: Queue<QueueMessage>;
  WEBHOOK_QUEUE?: Queue<WebhookQueueMessage>;

  // Durable Objects
  STORY_COORDINATOR: DurableObjectNamespace;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // API Keys
  REPLICATE_API_TOKEN: string;
  OPENAI_API_KEY: string;
  CF_AIG_TOKEN: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_DEFAULT_VOICE_ID?: string;
  ELEVENLABS_MODEL_ID?: string;
  AI_METER_INGEST_KEY: string;

  // Cloudflare
  CLOUDFLARE_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
  CF_AI_GATEWAY_URL: string;
  ENVIRONMENT: string;
  APP_URL?: string;
}

