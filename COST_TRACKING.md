# Cost Tracking System

Complete cost tracking implementation for story generation. Every API call, worker invocation, and storage operation is tracked with detailed cost breakdown.

## Overview

The system tracks costs across multiple providers:
- **Replicate**: Image and video generation
- **OpenAI**: Text-to-speech audio generation
- **ElevenLabs**: High-quality text-to-speech
- **Cloudflare**: Worker invocations, queue messages, R2 storage

## Database Schema

### Table: `story_usage_tracking`

Stores detailed cost records for each operation:

```sql
CREATE TABLE story_usage_tracking (
  id UUID PRIMARY KEY,
  job_id TEXT,
  user_id UUID,
  story_id UUID,
  provider VARCHAR(50),       -- 'replicate', 'openai', 'elevenlabs', 'cloudflare'
  resource_type VARCHAR(50),  -- 'image', 'audio', 'video', 'worker_invocation', etc.
  operation VARCHAR(100),     -- Specific operation details
  quantity INTEGER,           -- Number of resources used
  unit_cost_usd DECIMAL,      -- Cost per unit
  total_cost_usd DECIMAL,     -- Total cost for this record
  scene_index INTEGER,        -- Which scene (if applicable)
  model_used VARCHAR(100),    -- Model/voice used
  metadata JSONB,             -- Additional context
  recorded_at TIMESTAMP
);
```

### View: `story_cost_summary`

Aggregated cost summary per job:

```sql
SELECT 
  job_id,
  total_cost_usd,
  replicate_cost_usd,
  openai_cost_usd,
  elevenlabs_cost_usd,
  cloudflare_cost_usd
FROM story_cost_summary
WHERE job_id = ?;
```

## Cost Tracking Points

### 1. Image Generation (Replicate)
**When**: Image generation API called
**Tracked in**: `queue-processor.ts` → `processSceneImage()`
```typescript
await trackImageGeneration(jobId, userId, storyId, sceneIndex, model, env);
```

**Cost**: $0.003 - $0.055 per image (depends on model)

### 2. Video Generation (Replicate)
**When**: Video generation API called
**Tracked in**: `queue-processor.ts` → `processSceneVideo()`
```typescript
await trackVideoGeneration(jobId, userId, storyId, sceneIndex, model, env);
```

**Cost**: $0.05 - $0.08 per video

### 3. Audio Generation (OpenAI/ElevenLabs)
**When**: Text-to-speech API called
**Tracked in**: `queue-processor.ts` → `processSceneAudio()`
```typescript
await trackAudioGeneration(jobId, userId, storyId, sceneIndex, provider, voice, textLength, env);
```

**Cost**: 
- OpenAI: $0.015 per 1000 characters
- ElevenLabs: $0.00018 - $0.00030 per 1000 characters

### 4. Queue Messages (Cloudflare)
**When**: Jobs queued for processing
**Tracked in**: `create-story.ts` → `queueGenerationJobs()`
```typescript
await trackQueueMessage(jobId, userId, storyId, totalMessages, env);
```

**Cost**: $0.0000004 per message

### 5. Worker Invocations (Cloudflare)
**When**: Queue consumer processes a message
**Tracked in**: `queue-consumer.ts` → `handleQueue()`
```typescript
await trackWorkerInvocation(jobId, userId, storyId, env);
```

**Cost**: $0.00000015 per invocation

### 6. Storage Writes (Cloudflare R2)
**When**: Files uploaded to R2
**Tracked in**: 
- `webhook-handler.ts` → Images/videos uploaded
- `queue-processor.ts` → Audio files uploaded

```typescript
await trackStorageWrite(jobId, userId, storyId, sceneIndex, fileType, env);
```

**Cost**: $0.0000045 per write operation

## Pricing Configuration

All pricing is centralized in `src/services/usage-tracking.ts`:

```typescript
export const PRICING = {
  replicate: {
    'flux-schnell': 0.003,
    'flux-dev': 0.025,
    'flux-pro': 0.055,
    'video-generation': 0.05,
  },
  openai: {
    'tts-1': 0.015 / 1000,
  },
  elevenlabs: {
    'turbo-v2': 0.00018 / 1000,
  },
  cloudflare: {
    worker_invocation: 0.00000015,
    queue_message: 0.0000004,
    r2_write: 0.0000045,
  },
};
```

**To update pricing**: Edit the `PRICING` constant and redeploy.

## API Response with Costs

### Status Endpoint

**GET** `/status?jobId=abc123`

```json
{
  "jobId": "abc123",
  "status": "processing",
  "progress": 60,
  "totalScenes": 5,
  "imagesGenerated": 3,
  "audioGenerated": 3,
  "cost": {
    "total": 0.152,
    "breakdown": {
      "replicate": 0.125,
      "openai": 0.025,
      "elevenlabs": 0.000,
      "cloudflare": 0.002
    },
    "currency": "USD"
  }
}
```

## Example Cost Calculation

**Story with 5 scenes (Tier2 user):**

| Operation | Quantity | Unit Cost | Total |
|-----------|----------|-----------|-------|
| Images (flux-schnell) | 5 | $0.003 | $0.015 |
| Audio (OpenAI, 500 chars each) | 5 × 500 | $0.000015 | $0.038 |
| Queue messages | 10 | $0.0000004 | $0.000004 |
| Worker invocations | 10 | $0.00000015 | $0.0000015 |
| Storage writes | 10 | $0.0000045 | $0.000045 |
| **Total** | | | **$0.053** |

## Useful Queries

### Total spending per user (last 30 days)
```sql
SELECT user_id, SUM(total_cost_usd) as total_spent 
FROM story_usage_tracking 
WHERE recorded_at >= NOW() - INTERVAL '30 days' 
GROUP BY user_id 
ORDER BY total_spent DESC;
```

### Cost breakdown by provider
```sql
SELECT provider, resource_type, 
       SUM(total_cost_usd) as cost, 
       COUNT(*) as operations
FROM story_usage_tracking
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY provider, resource_type
ORDER BY cost DESC;
```

### Most expensive jobs
```sql
SELECT job_id, SUM(total_cost_usd) as total_cost
FROM story_usage_tracking
GROUP BY job_id
ORDER BY total_cost DESC
LIMIT 10;
```

### Average cost per tier
```sql
SELECT sj.user_tier, AVG(scs.total_cost_usd) as avg_cost
FROM story_jobs sj
JOIN story_cost_summary scs ON sj.job_id = scs.job_id
GROUP BY sj.user_tier;
```

### User spending trend
```sql
SELECT 
  DATE_TRUNC('day', recorded_at) as date,
  SUM(total_cost_usd) as daily_cost
FROM story_usage_tracking
WHERE user_id = 'user123'
  AND recorded_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', recorded_at)
ORDER BY date;
```

## Benefits

✅ **Complete Transparency**: Know exactly what each story costs  
✅ **User Billing**: Bill customers based on actual usage  
✅ **Profit Analysis**: See if tier pricing is profitable  
✅ **Cost Optimization**: Identify expensive operations  
✅ **Budget Alerts**: Monitor spending in real-time  
✅ **Historical Data**: Keep cost records even after jobs deleted  
✅ **Detailed Breakdown**: See costs per provider, resource type, scene  

## Integration with Billing

The cost data can be used for:

1. **Real-time billing**: Show users their current spending
2. **Monthly invoices**: Generate detailed bills with breakdowns
3. **Budget limits**: Alert when user approaches spending limit
4. **Tier optimization**: Suggest tier upgrades based on usage
5. **Cost predictions**: Estimate cost before story creation
6. **Refunds/Credits**: Track exact costs for dispute resolution

## Monitoring

**Check total costs daily:**
```sql
SELECT DATE(recorded_at), SUM(total_cost_usd)
FROM story_usage_tracking
WHERE recorded_at >= CURRENT_DATE
GROUP BY DATE(recorded_at);
```

**Alert on high costs:**
```sql
SELECT job_id, SUM(total_cost_usd) as cost
FROM story_usage_tracking
WHERE recorded_at >= NOW() - INTERVAL '1 hour'
GROUP BY job_id
HAVING SUM(total_cost_usd) > 1.0;  -- Alert if job costs > $1
```

## Future Enhancements

- **Cost predictions**: Estimate cost before generation starts
- **Budget limits**: Stop generation if user exceeds budget
- **Cost optimization**: Automatically choose cheaper models when possible
- **Usage analytics dashboard**: Real-time cost visualization
- **Cost-based tier recommendations**: Suggest upgrades/downgrades

