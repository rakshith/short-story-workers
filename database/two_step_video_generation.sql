-- Two-Step Video Generation with Scene Review
-- Add columns to stories table for scene review feature

-- Add scene_review_required to track if review is needed before video generation
ALTER TABLE stories ADD COLUMN IF NOT EXISTS scene_review_required boolean DEFAULT false;

-- Add video_generation_triggered to track if videos have been initiated
ALTER TABLE stories ADD COLUMN IF NOT EXISTS video_generation_triggered boolean DEFAULT false;

-- Note: awaiting_review status is a new status value for story_jobs.status
-- No column changes needed - just use the existing status column with new value

-- Add base_url to store the worker's base URL for webhooks (dynamic based on staging/prod)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS base_url text;
