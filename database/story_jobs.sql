-- Create story_jobs table for tracking async story generation jobs

CREATE TABLE IF NOT EXISTS story_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT UNIQUE NOT NULL,
  user_id UUID,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_scenes INTEGER NOT NULL,
  images_generated INTEGER DEFAULT 0,
  audio_generated INTEGER DEFAULT 0,
  error TEXT,
  story_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_story_jobs_job_id ON story_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_story_jobs_user_id ON story_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_story_jobs_status ON story_jobs(status);

-- Enable RLS (Row Level Security)
ALTER TABLE story_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage all jobs
CREATE POLICY "Service role can manage all jobs"
  ON story_jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create policy to allow users to view their own jobs
CREATE POLICY "Users can view their own jobs"
  ON story_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_story_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_story_jobs_updated_at
  BEFORE UPDATE ON story_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_story_jobs_updated_at();

