# Async Processing Guide

This document explains how the async processing system works for generating long videos (3+ minutes).

## Problem

Cloudflare Workers have CPU time limits:
- Free plan: 30 seconds
- Paid plan: 50 seconds

For a 3-minute video with 20 scenes:
- Image generation: 20 scenes × 15 seconds = 5 minutes
- Audio generation: 20 scenes × 3 seconds = 1 minute
- **Total: ~6 minutes** (exceeds all limits)

## Solution: Cloudflare Queues

We use Cloudflare Queues to process scenes asynchronously:

1. **Main Worker** (fast, < 1 second)
   - Accepts request
   - Queues all jobs
   - Returns job ID immediately

2. **Queue Consumer** (no time limits)
   - Processes each scene independently
   - Updates status in database
   - No CPU time restrictions

## Architecture

```
Client Request
    ↓
Main Worker (index.ts)
    ↓
Queue Jobs (STORY_QUEUE)
    ↓
Queue Consumer (queue handler)
    ↓
Process Scenes (parallel/sequential)
    ↓
Update Status (Supabase)
    ↓
Finalize Story
```

## Flow Diagram

```
1. POST /create-story
   ├─ Validate request
   ├─ Generate jobId
   ├─ Queue image jobs (parallel)
   ├─ Queue audio jobs (sequential)
   ├─ Queue finalize job
   └─ Return jobId (< 1 second)

2. Queue Consumer Processes:
   ├─ Image Job 1 → Process → Update Status
   ├─ Image Job 2 → Process → Update Status
   ├─ Image Job 3 → Process → Update Status
   ├─ ...
   ├─ Audio Job 1 → Process → Update Status
   ├─ Audio Job 2 → Process → Update Status
   └─ Finalize Job → Save Story → Complete

3. Client Polls:
   GET /status?jobId=xxx
   ├─ Status: pending → Wait
   ├─ Status: processing → Show progress
   ├─ Status: completed → Show story
   └─ Status: failed → Show error
```

## Job Status States

- **pending**: Job queued, not started
- **processing**: Currently generating images/audio
- **completed**: Story saved to database
- **failed**: Error occurred

## Progress Calculation

- **0-50%**: Image generation progress
  - `progress = (imagesGenerated / totalScenes) * 50`
  
- **50-100%**: Audio generation progress
  - `progress = 50 + (audioGenerated / totalScenes) * 50`

## Example Timeline

For a 20-scene story:

```
Time    | Action
--------|------------------
0s      | Request received
1s      | Job ID returned
1-5s    | Images queued
5-65s   | Images processing (parallel)
65-125s | Audio processing (sequential)
125s    | Story finalized
```

Client receives job ID at 1 second, story ready at ~125 seconds.

## Benefits

1. ✅ **No time limits**: Queue processing has no CPU time restrictions
2. ✅ **Scalable**: Can handle 100+ scenes
3. ✅ **Resilient**: Failed jobs can retry automatically
4. ✅ **Real-time progress**: Status updates via database
5. ✅ **Fast response**: Client gets job ID immediately

## Monitoring

Check job status in Supabase:

```sql
SELECT * FROM story_jobs 
WHERE job_id = 'your-job-id'
ORDER BY updated_at DESC;
```

Or use the status endpoint:

```bash
curl "https://your-worker.workers.dev/status?jobId=your-job-id"
```

## Error Handling

- **Image generation fails**: Job marked failed, can retry
- **Audio generation fails**: Job marked failed, can retry
- **Finalization fails**: Job marked failed, partial results saved

Failed jobs can be manually retried by re-queuing the same job.

## Scaling Considerations

For very large stories (50+ scenes):

1. **Batch Processing**: Process scenes in batches
2. **Rate Limiting**: Add delays between batches
3. **Priority Queues**: Use different queues for different priorities
4. **Durable Objects**: For state management across multiple workers

## Cost

- **Queue Operations**: Free tier includes 1M operations/month
- **Worker Invocations**: Standard pricing applies
- **Processing Time**: No additional cost for long-running jobs

## Best Practices

1. **Poll Interval**: Poll status every 2-5 seconds
2. **Timeout**: Set client timeout to 10-15 minutes
3. **Error Handling**: Always check for `failed` status
4. **Progress Display**: Show progress bar to users
5. **Retry Logic**: Implement retry for failed jobs

