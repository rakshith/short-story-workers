-- Create story_jobs table for tracking async story generation jobs

CREATE TABLE IF NOT EXISTS public.story_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  job_id text NOT NULL,
  user_id uuid NULL,
  status text NOT NULL,
  progress integer NULL DEFAULT 0,
  total_scenes integer NOT NULL,
  images_generated integer NULL DEFAULT 0,
  audio_generated integer NULL DEFAULT 0,
  error text NULL,
  story_id uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  team_id uuid NULL,
  queue_status text NULL,
  CONSTRAINT story_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT story_jobs_job_id_key UNIQUE (job_id),
  CONSTRAINT story_jobs_progress_check CHECK (
    (
      (progress >= 0)
      AND (progress <= 100)
    )
  ),
  CONSTRAINT story_jobs_status_check CHECK (
    (
      status = ANY (
        ARRAY[
          'pending'::text,
          'processing'::text,
          'completed'::text,
          'failed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_story_jobs_job_id ON public.story_jobs USING btree (job_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_story_jobs_user_id ON public.story_jobs USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_story_jobs_status ON public.story_jobs USING btree (status) TABLESPACE pg_default;

-- Enable RLS (Row Level Security)
ALTER TABLE public.story_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage all jobs
DROP POLICY IF EXISTS "Service role can manage all jobs" ON public.story_jobs;
CREATE POLICY "Service role can manage all jobs"
  ON public.story_jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create policy to allow users to view their own jobs
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.story_jobs;
CREATE POLICY "Users can view their own jobs"
  ON public.story_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_story_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_story_jobs_updated_at ON public.story_jobs;
CREATE TRIGGER update_story_jobs_updated_at
  BEFORE UPDATE ON public.story_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_story_jobs_updated_at();
