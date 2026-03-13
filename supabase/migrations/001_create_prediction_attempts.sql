-- Migration: Create prediction_attempts table for cost tracking and duplicate prevention
-- This table tracks all Replicate prediction attempts to prevent duplicate charges

-- Create the prediction_attempts table
CREATE TABLE IF NOT EXISTS prediction_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    scene_index INTEGER NOT NULL,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN ('image', 'video', 'audio')),
    prediction_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    output_url TEXT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_prediction_attempts_story_scene 
    ON prediction_attempts(story_id, scene_index, prediction_type);

CREATE INDEX IF NOT EXISTS idx_prediction_attempts_job_id 
    ON prediction_attempts(job_id);

CREATE INDEX IF NOT EXISTS idx_prediction_attempts_status 
    ON prediction_attempts(status);

CREATE INDEX IF NOT EXISTS idx_prediction_attempts_created_at 
    ON prediction_attempts(created_at);

-- Create a composite unique index to prevent duplicate predictions for the same scene
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_attempts_unique_pending
    ON prediction_attempts(story_id, scene_index, prediction_type)
    WHERE status = 'pending';

-- Enable Row Level Security (RLS)
ALTER TABLE prediction_attempts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
CREATE POLICY "Service role has full access to prediction_attempts"
    ON prediction_attempts
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE prediction_attempts IS 'Tracks all AI generation prediction attempts to prevent duplicate costs and enable cost analysis';
COMMENT ON COLUMN prediction_attempts.idempotency_key IS 'Unique key used to prevent duplicate predictions on both client and Replicate sides';
COMMENT ON COLUMN prediction_attempts.prediction_id IS 'Replicate prediction ID';

-- Create a function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_prediction_attempts_updated_at ON prediction_attempts;
CREATE TRIGGER update_prediction_attempts_updated_at
    BEFORE UPDATE ON prediction_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add to realtime publication for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE prediction_attempts;
