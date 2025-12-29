-- Story Usage Tracking Table
-- Tracks detailed cost and usage metrics for each story generation job

CREATE TABLE IF NOT EXISTS public.story_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  user_id uuid NOT NULL,
  story_id uuid,
  
  -- Categorization
  provider varchar(50) NOT NULL, -- 'replicate', 'openai', 'elevenlabs', 'cloudflare'
  resource_type varchar(50) NOT NULL, -- 'image', 'audio', 'video', 'worker_invocation', 'queue_message', 'db_query'
  operation varchar(100), -- e.g., 'flux-schnell-image', 'tts-generation', etc.
  
  -- Metrics
  quantity integer DEFAULT 1, -- Number of resources used
  unit_cost_usd decimal(10, 6), -- Cost per unit in USD
  total_cost_usd decimal(10, 4), -- Total cost for this record
  
  -- Context
  scene_index integer, -- Which scene this cost belongs to
  model_used varchar(100), -- Model/voice used
  metadata jsonb, -- Additional context (size, duration, etc.)
  
  -- Timestamps
  recorded_at timestamp with time zone DEFAULT now(),
  
  -- Indexes for fast queries
  CONSTRAINT fk_story_usage_job FOREIGN KEY (job_id) REFERENCES public.story_jobs(job_id) ON DELETE CASCADE,
  
  -- Idempotency: Prevent duplicate cost tracking for same operation
  -- Uniqueness on: job + scene + provider + resource ensures no duplicate charges
  CONSTRAINT unique_usage_tracking UNIQUE (job_id, scene_index, provider, resource_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_story_usage_job_id ON public.story_usage_tracking(job_id);
CREATE INDEX IF NOT EXISTS idx_story_usage_user_id ON public.story_usage_tracking(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_usage_provider ON public.story_usage_tracking(provider, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_usage_resource_type ON public.story_usage_tracking(resource_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_usage_story_id ON public.story_usage_tracking(story_id);

-- View for easy cost summary per job
CREATE OR REPLACE VIEW public.story_cost_summary AS
SELECT 
  job_id,
  user_id,
  story_id,
  COUNT(*) as total_operations,
  SUM(quantity) as total_resources_used,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(CASE WHEN provider = 'replicate' THEN total_cost_usd ELSE 0 END) as replicate_cost_usd,
  SUM(CASE WHEN provider = 'openai' THEN total_cost_usd ELSE 0 END) as openai_cost_usd,
  SUM(CASE WHEN provider = 'elevenlabs' THEN total_cost_usd ELSE 0 END) as elevenlabs_cost_usd,
  SUM(CASE WHEN provider = 'cloudflare' THEN total_cost_usd ELSE 0 END) as cloudflare_cost_usd,
  MIN(recorded_at) as first_cost_recorded,
  MAX(recorded_at) as last_cost_recorded
FROM public.story_usage_tracking
GROUP BY job_id, user_id, story_id;

-- Webhook idempotency tracking (prevents duplicate webhook processing)
CREATE TABLE IF NOT EXISTS public.webhook_processed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id varchar(255) NOT NULL,
  story_id uuid NOT NULL,
  scene_index integer NOT NULL,
  webhook_type varchar(20) NOT NULL, -- 'image', 'video'
  processed_at timestamp with time zone DEFAULT now(),
  
  -- Idempotency: One webhook per prediction
  CONSTRAINT unique_webhook UNIQUE (prediction_id, story_id, scene_index)
);

CREATE INDEX IF NOT EXISTS idx_webhook_prediction ON public.webhook_processed(prediction_id);
CREATE INDEX IF NOT EXISTS idx_webhook_story ON public.webhook_processed(story_id, scene_index);
