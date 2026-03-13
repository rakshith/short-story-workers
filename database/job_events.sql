-- Create job_events table for tracking execution flow events

CREATE TABLE IF NOT EXISTS public.job_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  story_id uuid NULL,
  user_id uuid NULL,
  event_type text NOT NULL,
  node_id text NULL,
  capability text NULL,
  data jsonb NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON public.job_events USING btree (job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_timestamp ON public.job_events USING btree (timestamp);
CREATE INDEX IF NOT EXISTS idx_job_events_event_type ON public.job_events USING btree (event_type);

ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage all job_events" ON public.job_events;
CREATE POLICY "Service role can manage all job_events"
  ON public.job_events
  FOR ALL
  USING (auth.role() = 'service_role');
