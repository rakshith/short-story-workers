# Cloudflare Workers - Create Story Service

A standalone Cloudflare Workers project for creating short stories with AI-generated images and audio. This service replicates the functionality of the `create-story` API route and can be deployed independently to Cloudflare Workers.

## Features

- ✅ AI image generation using Replicate
- ✅ Voice-over generation using ElevenLabs and OpenAI TTS
- ✅ Automatic caption generation with word-level timing
- ✅ Cloudflare R2 storage integration
- ✅ Supabase database integration
- ✅ Parallel image generation for faster processing
- ✅ Sequential audio generation to avoid rate limits

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Cloudflare R2 buckets for images and audio
- Supabase project with `stories` table
- API keys for:
  - Replicate (for image generation)
  - ElevenLabs (for voice-over)
  - OpenAI (optional, for TTS fallback)
  - Supabase (service role key)

## Project Structure

```
cloudflare-workers-create-story/
├── src/
│   ├── index.ts                 # Main worker entry point
│   ├── types/
│   │   ├── index.ts             # TypeScript types
│   │   └── env.ts               # Environment variable types
│   ├── services/
│   │   ├── image-generation.ts   # Image generation service
│   │   ├── audio-generation.ts  # Audio generation service
│   │   └── supabase.ts          # Supabase database service
│   └── utils/
│       ├── video-calculations.ts # Video duration calculations
│       ├── storage.ts            # Storage path utilities
│       └── model-utils.ts         # Model selection utilities
├── package.json
├── wrangler.toml                 # Cloudflare Workers configuration
├── tsconfig.json
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
cd cloudflare-workers-create-story
npm install
```

### 2. Create Database Table

Run the SQL script to create the `story_jobs` table in your Supabase database:

```bash
# In Supabase SQL Editor, run:
cat database/story_jobs.sql
```

Or manually create the table using the SQL in `database/story_jobs.sql`.

### 3. Configure Cloudflare R2 Buckets

1. Create two R2 buckets in your Cloudflare dashboard:
   - `images` - for storing generated images
   - `audio` - for storing generated audio files

2. Configure public access for these buckets (optional, if you need public URLs)

### 4. Create Cloudflare Queue

1. Go to Cloudflare Dashboard → Workers & Pages → Queues
2. Create a new queue named `story-processing`
3. The queue will be automatically bound to your worker via `wrangler.toml`

### 5. Set Environment Variables

Set the following secrets using Wrangler CLI:

```bash
# Supabase
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Replicate
wrangler secret put REPLICATE_API_TOKEN

# OpenAI (optional, for TTS fallback)
wrangler secret put OPENAI_API_KEY

# ElevenLabs
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put ELEVENLABS_DEFAULT_VOICE_ID
wrangler secret put ELEVENLABS_MODEL_ID  # Optional, defaults to 'eleven_multilingual_v2'

# Cloudflare Account ID (optional)
wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

Or set them via the Cloudflare Dashboard:
1. Go to Workers & Pages → Your Worker → Settings → Variables and Secrets
2. Add each secret variable

### 6. Update R2 Public URLs

In the following files, update the R2 public URL domain:
- `src/services/image-generation.ts` - Replace `https://your-r2-domain.com` with your actual R2 public URL
- `src/services/audio-generation.ts` - Replace `https://your-r2-domain.com` with your actual R2 public URL

If you're using Cloudflare R2 with a custom domain, use that domain. Otherwise, you can use the R2 public URL format:
```
https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/
```

## Development

### Local Development

```bash
npm run dev
```

This will start a local development server. You can test the worker locally before deploying.

### Testing Locally

You can test the worker using curl or any HTTP client:

```bash
curl -X POST http://localhost:8787/create-story \
  -H "Content-Type: application/json" \
  -d '{
    "script": {
      "title": "Test Story",
      "totalDuration": 10,
      "scenes": [
        {
          "sceneNumber": 1,
          "duration": 5,
          "details": "A beautiful sunset",
          "narration": "The sun sets over the horizon",
          "imagePrompt": "beautiful sunset over ocean",
          "cameraAngle": "wide",
          "mood": "peaceful"
        }
      ]
    },
    "videoConfig": {
      "videoType": "faceless-video",
      "preset": {
        "id": "default",
        "name": "Default",
        "stylePrompt": "cinematic, high quality"
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
```

## Deployment

### Deploy to Cloudflare Workers

```bash
# Deploy to production
npm run deploy

# Or deploy to staging
npm run deploy:staging
```

### First-Time Deployment

1. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Update `wrangler.toml` with your worker name if needed

3. Deploy:
   ```bash
   npm run deploy
   ```

## API Usage

### Create Story (Async)

```
POST https://your-worker-name.your-subdomain.workers.dev/create-story
```

This endpoint queues the story generation and returns immediately with a job ID.

### Check Status

```
GET https://your-worker-name.your-subdomain.workers.dev/status?jobId=<job-id>
```

Returns the current status and progress of the job.

### Request Body

```typescript
{
  script: string | StoryTimeline;  // JSON string or object
  videoConfig: {
    videoType: string;
    preset: {
      id: string;
      name: string;
      stylePrompt: string;
      seed?: number;
    };
    model: string;  // 'basic', 'lite', 'pro', etc. or model ID
    music: string;
    musicVolume?: number;
    voice: string;  // 'alloy' for OpenAI, or ElevenLabs voice ID
    aspectRatio: string;  // '16:9', '1:1', '9:16'
    outputFormat?: string;  // 'jpg', 'png', etc.
    enableCaptions?: boolean;
    watermark?: any;
    captionStylePreset?: any;
    transitionPreset?: string;
    language?: string;
    estimatedCredits?: number;
  };
  userId: string;
  seriesId: string;
  title: string;
}
```

### Create Story Response

```typescript
{
  success: true;
  jobId: string;
  status: 'pending';
  message: string;
  stats: {
    totalScenes: number;
  };
}
```

### Status Response

```typescript
{
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  totalScenes: number;
  imagesGenerated: number;
  audioGenerated: number;
  error?: string;
  storyId?: string; // Available when completed
}
```

### Usage Example

```javascript
// 1. Create story
const response = await fetch('https://your-worker.workers.dev/create-story', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    script: { /* story data */ },
    videoConfig: { /* config */ },
    userId: '550e8400-e29b-41d4-a716-446655440000',
    seriesId: '660e8400-e29b-41d4-a716-446655440001',
    title: 'My Story'
  })
});

const { jobId } = await response.json();

// 2. Poll for status
const pollStatus = async () => {
  const statusResponse = await fetch(
    `https://your-worker.workers.dev/status?jobId=${jobId}`
  );
  const status = await statusResponse.json();
  
  if (status.status === 'completed') {
    console.log('Story created!', status.storyId);
  } else if (status.status === 'failed') {
    console.error('Failed:', status.error);
  } else {
    console.log(`Progress: ${status.progress}%`);
    // Poll again after 2 seconds
    setTimeout(pollStatus, 2000);
  }
};

pollStatus();
```

## Configuration

### Model Tiers

The service supports different model tiers. Update `src/utils/model-utils.ts` to customize:

```typescript
const MODEL_TIERS: Record<string, string> = {
  'basic': 'black-forest-labs/flux-schnell',
  'lite': 'black-forest-labs/flux-schnell',
  'pro': 'black-forest-labs/flux-dev',
  // Add more tiers as needed
};
```

### R2 Storage Paths

Storage paths are generated using the format:
```
short-stories/{storyType}/series/{userId}/{seriesId}/{storyId}/{filename}
```

For audio:
```
voice-overs/{userId}/{filename}
```

## Troubleshooting

### Image Generation Fails

- Check Replicate API token is valid
- Verify model ID is correct
- Check R2 bucket permissions
- Ensure R2 bucket exists

### Audio Generation Fails

- Verify ElevenLabs API key is valid
- Check voice ID exists in your ElevenLabs account
- For OpenAI TTS, ensure API key is set
- Check R2 bucket permissions

### Database Errors

- Verify Supabase URL and service role key
- Ensure `stories` table exists with correct schema
- Check RLS policies allow service role access

### CORS Issues

The worker includes CORS headers. If you need to restrict origins, update the `Access-Control-Allow-Origin` header in `src/index.ts`.

## Limitations & Solutions

### Previous Limitations (Now Solved!)
- ✅ **Cloudflare Workers time limits**: Solved using Cloudflare Queues for async processing
- ✅ **Long video generation**: Now supports videos of any length (3+ minutes)
- ✅ **Multiple scenes**: Processes scenes in parallel via queues

### Current Architecture
- **Main Worker**: Accepts requests and queues jobs (returns immediately)
- **Queue Consumer**: Processes scenes asynchronously (no time limits)
- **Status Tracking**: Real-time progress via `/status` endpoint
- **Parallel Processing**: Images generated in parallel, audio sequentially

### How It Works for 3-Minute Videos
1. Client sends story creation request
2. Worker queues all image generation jobs (parallel)
3. Worker queues all audio generation jobs (sequential)
4. Worker queues finalization job
5. Returns job ID immediately (< 1 second)
6. Queue consumer processes jobs asynchronously
7. Client polls `/status?jobId=xxx` for progress
8. Job completes when all scenes are processed

### Processing Time Estimates
- **10 scenes**: ~5-10 minutes total processing time
- **20 scenes**: ~10-20 minutes total processing time
- **30 scenes**: ~15-30 minutes total processing time

Note: Processing happens in the background, client receives job ID immediately.

## Cost Considerations

- Replicate charges per image generation
- ElevenLabs charges per character for TTS
- R2 storage costs are minimal
- Cloudflare Workers free tier includes 100,000 requests/day

## Support

For issues or questions:
1. Check the Cloudflare Workers logs in the dashboard
2. Review the error messages in the API response
3. Verify all environment variables are set correctly

## License

MIT

