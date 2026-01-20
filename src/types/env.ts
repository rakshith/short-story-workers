// Environment types for Cloudflare Workers

import { R2Bucket, Queue, DurableObjectNamespace } from '@cloudflare/workers-types';
import { StoryTimeline, VideoConfig } from '.';

// Forward declare QueueMessage to avoid circular dependency
// Using any for storyData to avoid circular imports - it will be properly typed at usage sites
export interface QueueMessage {
  jobId: string;
  userId: string;
  seriesId: string;
  storyId: string;
  title: string;
  storyData: StoryTimeline; // StoryTimeline - typed at usage sites
  videoConfig: VideoConfig;
  sceneIndex: number;
  type: 'image' | 'video' | 'audio' | 'finalize';
  baseUrl?: string;
  teamId?: string;
  userTier?: string; // User tier for priority and concurrency control
  priority?: number; // Calculated priority from tier
}

export interface Env {
  // R2 Buckets
  IMAGES_BUCKET: R2Bucket;
  AUDIO_BUCKET: R2Bucket;
  VIDEO_BUCKET: R2Bucket;

  // Queue
  STORY_QUEUE: Queue<QueueMessage>;

  // Durable Objects
  STORY_COORDINATOR: DurableObjectNamespace;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // API Keys
  REPLICATE_API_TOKEN: string;
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_DEFAULT_VOICE_ID?: string;
  ELEVENLABS_MODEL_ID?: string;
  AI_METER_INGEST_KEY: string;

  // Cloudflare
  CLOUDFLARE_ACCOUNT_ID?: string;
}

