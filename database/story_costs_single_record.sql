-- Single record per story cost tracking
-- Consolidates all costs for a story generation job into one row

CREATE TABLE IF NOT EXISTS public.story_costs (
  job_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  story_id uuid,
  
  -- Aggregated Costs
  total_cost_usd decimal(10, 4) DEFAULT 0,
  replicate_cost_usd decimal(10, 4) DEFAULT 0,
  openai_cost_usd decimal(10, 4) DEFAULT 0,
  elevenlabs_cost_usd decimal(10, 4) DEFAULT 0,
  cloudflare_cost_usd decimal(10, 4) DEFAULT 0,
  
  -- Idempotency tracking (internal)
  -- Stores keys like "scene0_replicate_image" to prevent double-charging
  charged_operations jsonb DEFAULT '[]',
  
  -- Metadata
  last_operation text,
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT fk_story_costs_job FOREIGN KEY (job_id) REFERENCES public.story_jobs(job_id) ON DELETE CASCADE
);

-- Index for user spending queries
CREATE INDEX IF NOT EXISTS idx_story_costs_user_id ON public.story_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_story_costs_story_id ON public.story_costs(story_id);

-- Atomic increment function for story costs with idempotency
CREATE OR REPLACE FUNCTION public.track_story_cost(
  p_job_id text,
  p_user_id uuid,
  p_story_id uuid,
  p_provider text,
  p_cost decimal,
  p_op_key text, -- unique key for this specific charge (e.g. "scene0_image")
  p_last_op text
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.story_costs (
    job_id, user_id, story_id, total_cost_usd, 
    replicate_cost_usd, openai_cost_usd, elevenlabs_cost_usd, cloudflare_cost_usd,
    charged_operations, last_operation, updated_at
  )
  VALUES (
    p_job_id, p_user_id, p_story_id, p_cost,
    CASE WHEN p_provider = 'replicate' THEN p_cost ELSE 0 END,
    CASE WHEN p_provider = 'openai' THEN p_cost ELSE 0 END,
    CASE WHEN p_provider = 'elevenlabs' THEN p_cost ELSE 0 END,
    CASE WHEN p_provider = 'cloudflare' THEN p_cost ELSE 0 END,
    jsonb_build_array(p_op_key),
    p_last_op,
    NOW()
  )
  ON CONFLICT (job_id) DO UPDATE SET
    -- Only update if the operation hasn't been charged yet
    total_cost_usd = CASE 
      WHEN NOT (story_costs.charged_operations @> jsonb_build_array(p_op_key))
      THEN story_costs.total_cost_usd + p_cost
      ELSE story_costs.total_cost_usd
    END,
    replicate_cost_usd = CASE 
      WHEN p_provider = 'replicate' AND NOT (story_costs.charged_operations @> jsonb_build_array(p_op_key))
      THEN story_costs.replicate_cost_usd + p_cost
      ELSE story_costs.replicate_cost_usd
    END,
    openai_cost_usd = CASE 
      WHEN p_provider = 'openai' AND NOT (story_costs.charged_operations @> jsonb_build_array(p_op_key))
      THEN story_costs.openai_cost_usd + p_cost
      ELSE story_costs.openai_cost_usd
    END,
    elevenlabs_cost_usd = CASE 
      WHEN p_provider = 'elevenlabs' AND NOT (story_costs.charged_operations @> jsonb_build_array(p_op_key))
      THEN story_costs.elevenlabs_cost_usd + p_cost
      ELSE story_costs.elevenlabs_cost_usd
    END,
    cloudflare_cost_usd = CASE 
      WHEN p_provider = 'cloudflare' AND NOT (story_costs.charged_operations @> jsonb_build_array(p_op_key))
      THEN story_costs.cloudflare_cost_usd + p_cost
      ELSE story_costs.cloudflare_cost_usd
    END,
    charged_operations = CASE 
      WHEN NOT (story_costs.charged_operations @> jsonb_build_array(p_op_key))
      THEN story_costs.charged_operations || jsonb_build_array(p_op_key)
      ELSE story_costs.charged_operations
    END,
    last_operation = p_last_op,
    updated_at = NOW(),
    -- Keep existing IDs if they were null
    story_id = COALESCE(story_costs.story_id, p_story_id);
END;
$$ LANGUAGE plpgsql;

