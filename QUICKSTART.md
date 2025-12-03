# Quick Start Guide

Get your Cloudflare Workers create-story service up and running in minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Login to Cloudflare

```bash
npx wrangler login
```

## Step 3: Create Database Table

Run the SQL script in Supabase SQL Editor:

```sql
-- Copy and paste the contents of database/story_jobs.sql
```

This creates the `story_jobs` table for tracking async job status.

## Step 4: Create Cloudflare Queue

**⚠️ Important:** Queues require a Workers Paid plan. Upgrade at: https://dash.cloudflare.com → Workers → Plans

### Option 1: Via Dashboard (Recommended)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Queues
2. Click "Create Queue"
3. Name it: `story-processing`
4. The queue will be automatically bound via `wrangler.toml`

### Option 2: Via CLI
```bash
npx wrangler queues create story-processing
```

**Note:** This command will fail if you're on the free plan. You must upgrade to Workers Paid plan first.

## Step 5: Create R2 Buckets

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create two buckets:
   - `images` (for generated images)
   - `audio` (for generated audio files)

## Step 6: Set Environment Variables

Set all required secrets:

```bash
# Supabase
echo "your-supabase-url" | npx wrangler secret put SUPABASE_URL
echo "your-anon-key" | npx wrangler secret put SUPABASE_ANON_KEY
echo "your-service-role-key" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Replicate
echo "your-replicate-token" | npx wrangler secret put REPLICATE_API_TOKEN

# ElevenLabs
echo "your-elevenlabs-key" | npx wrangler secret put ELEVENLABS_API_KEY
echo "your-voice-id" | npx wrangler secret put ELEVENLABS_DEFAULT_VOICE_ID

# OpenAI (optional)
echo "your-openai-key" | npx wrangler secret put OPENAI_API_KEY
```

## Step 7: Update R2 URLs

Edit these files and replace the placeholder URLs with your actual R2 public URLs:

- `src/services/image-generation.ts` (line ~140)
- `src/services/audio-generation.ts` (line ~280)

If you're using R2 public URLs, the format is:
```
https://pub-<account-id>.r2.dev/<key>
```

Or if you have a custom domain:
```
https://your-custom-domain.com/<key>
```

## Step 8: Deploy

```bash
npm run deploy
```

## Step 9: Test

```bash
# Create story (returns job ID immediately)
curl -X POST https://create-story-worker.matrixrak.workers.dev/create-story \
  -H "Content-Type: application/json" \
  -d '{
    "script": {
      "id": "test",
      "title": "Test",
      "totalDuration": 5,
      "scenes": [{
        "sceneNumber": 1,
        "duration": 5,
        "details": "Test scene",
        "narration": "This is a test narration",
        "imagePrompt": "beautiful landscape",
        "cameraAngle": "wide",
        "mood": "peaceful"
      }]
    },
    "videoConfig": {
      "videoType": "faceless-video",
      "preset": {
        "id": "default",
        "name": "Default",
        "stylePrompt": "cinematic"
      },
      "model": "basic",
      "music": "none",
      "voice": "alloy",
      "aspectRatio": "9:16",
      "outputFormat": "jpg"
    },
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "seriesId": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Test Story"
  }'

# Check status (replace JOB_ID with the jobId from above)
curl "https://create-story-worker.matrixrak.workers.dev/status?jobId=a2553ede-a030-454a-b29f-c7015e02401f"
```

## Troubleshooting

### "R2 bucket not found"
- Ensure buckets are created in the same Cloudflare account
- Check bucket names match `wrangler.toml`

### "Invalid API key"
- Verify all secrets are set correctly
- Check API keys are active and have proper permissions

### "Supabase error"
- Verify Supabase URL and service role key
- Ensure `stories` table exists with correct schema

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Customize model tiers in `src/utils/model-utils.ts`
- Adjust storage paths in `src/utils/storage.ts`

