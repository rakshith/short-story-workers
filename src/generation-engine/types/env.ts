// Environment types for Generation Engine

export interface GenerationEngineEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  REPLICATE_API_TOKEN: string;
  OPENAI_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_DEFAULT_VOICE_ID: string;
  ELEVENLABS_MODEL_ID: string;
  AI_METER_INGEST_KEY: string;
  IMAGES_BUCKET: R2Bucket;
  VIDEO_BUCKET: R2Bucket;
  AUDIO_BUCKET: R2Bucket;
  STORY_QUEUE: Queue;
  WEBHOOK_QUEUE?: Queue;
  STORY_COORDINATOR: DurableObjectNamespace;
  JOB_DURABLE_OBJECT?: DurableObjectNamespace;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: R2PutOptions): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2Object {
  key: string;
  value: ArrayBuffer;
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2HttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  cacheControl?: string;
}

export interface R2ListOptions {
  prefix?: string;
  delimiter?: string;
  limit?: number;
  cursor?: string;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

export interface Queue {
  send(message: unknown): Promise<void>;
  batchSend(messages: unknown[]): Promise<void>;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectStub {
  fetch(request: Request | string, options?: RequestInit): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<void>): void;
}
