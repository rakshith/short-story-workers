# Idempotency Implementation

Simple, pragmatic idempotency protection to prevent duplicate processing and overcharging.

## What's Protected

### ✅ 1. Cost Tracking (Critical)
**Problem**: Worker retry could track same cost twice → User overcharged  
**Solution**: Database unique constraint on `(job_id, scene_index, provider, resource_type)`

```sql
CONSTRAINT unique_usage_tracking UNIQUE (job_id, scene_index, provider, resource_type)
```

**How it works**:
- First call: Record inserted ✓
- Duplicate call: Unique violation → Silently ignored ✓
- User charged exactly once ✓

**Example**:
```typescript
// Called twice due to retry
await trackImageGeneration(jobId, userId, storyId, 0, 'flux-schnell', env);
await trackImageGeneration(jobId, userId, storyId, 0, 'flux-schnell', env);

// Result: Only ONE cost record created
// User charged $0.003, not $0.006 ✓
```

### ✅ 2. Webhook Processing (Important)
**Problem**: Replicate may send same webhook twice → Scene counted multiple times  
**Solution**: Track processed webhooks in `webhook_processed` table

```sql
CONSTRAINT unique_webhook UNIQUE (prediction_id, story_id, scene_index)
```

**How it works**:
- First webhook: Processed normally ✓
- Duplicate webhook: Returns 200 without processing ✓
- Progress tracking accurate ✓

**Example**:
```typescript
// Replicate sends webhook twice
POST /webhooks/replicate?storyId=abc&sceneIndex=0
POST /webhooks/replicate?storyId=abc&sceneIndex=0 (retry)

// First: Processes and updates scene ✓
// Second: "Already processed" response ✓
```

## Implementation Details

### Cost Tracking Idempotency

**File**: `src/services/usage-tracking.ts`

```typescript
// Handles duplicate tracking gracefully
const { error } = await supabase
  .from('story_usage_tracking')
  .insert({...});

// Ignore unique constraint violations (23505)
if (error?.code === '23505') {
  // Already tracked - idempotency working ✓
}
```

**Database constraint**:
```sql
-- Prevents duplicates at database level
CONSTRAINT unique_usage_tracking UNIQUE (
  job_id,       -- Which story generation job
  scene_index,  -- Which scene
  provider,     -- replicate/openai/elevenlabs/cloudflare
  resource_type -- image/audio/video/worker/queue/storage
)
```

### Webhook Idempotency

**File**: `src/services/webhook-handler.ts`

```typescript
// Check if already processed before doing anything
const { error } = await supabase
  .from('webhook_processed')
  .insert({
    prediction_id: prediction.id,
    story_id: storyId,
    scene_index: sceneIndex,
    webhook_type: type,
  });

if (error?.code === '23505') {
  return new Response('Already processed', { status: 200 });
}
```

**Database constraint**:
```sql
-- One webhook processing per prediction
CONSTRAINT unique_webhook UNIQUE (
  prediction_id,  -- Replicate prediction ID
  story_id,       -- Which story
  scene_index     -- Which scene
)
```

## What's NOT Protected (Intentional)

### Story Creation (Low Priority)
- Multiple POST /create-story creates multiple jobs
- **Why not protected**: User may legitimately want multiple stories
- **Mitigation**: Frontend should prevent double-clicks

### Queue Messages (Not Needed)
- Cloudflare Queues handle this automatically
- Message ID ensures no duplicate delivery
- Message only acked after successful processing

### Durable Objects (Race-Free by Design)
- Single-threaded per story
- No race conditions possible
- No idempotency needed

## Testing Idempotency

### Test Cost Tracking:

```bash
# Simulate duplicate tracking
curl -X POST https://your-worker.workers.dev/test-duplicate-cost

# Check database - should see only ONE record:
SELECT * FROM story_usage_tracking 
WHERE job_id = 'test-job' AND scene_index = 0;
```

### Test Webhook Processing:

```bash
# Send same webhook twice
curl -X POST https://your-worker.workers.dev/webhooks/replicate?... -d '{...}'
curl -X POST https://your-worker.workers.dev/webhooks/replicate?... -d '{...}'

# First: Processes normally
# Second: Returns "Already processed"

# Check database:
SELECT * FROM webhook_processed 
WHERE prediction_id = 'test-prediction';
-- Should see only ONE record
```

## Monitoring

### Check for duplicate attempts (expected):

```sql
-- Cost tracking duplicates caught
SELECT 
  DATE(recorded_at) as date,
  COUNT(*) as duplicate_attempts
FROM pg_stat_activity 
WHERE query LIKE '%unique_usage_tracking%';
```

### Check webhook processing:

```sql
-- Webhooks processed
SELECT COUNT(*), webhook_type 
FROM webhook_processed 
WHERE DATE(processed_at) = CURRENT_DATE
GROUP BY webhook_type;
```

## Benefits

✅ **No overcharging**: Users charged exactly once per operation  
✅ **Accurate costs**: Retry-safe cost tracking  
✅ **Reliable webhooks**: No duplicate scene processing  
✅ **Simple**: Database-level constraints, no complex logic  
✅ **Fast**: Single INSERT handles check + insert atomically  
✅ **No over-engineering**: No distributed locks or external cache  

## Migration

Run the updated migration:

```bash
# Apply new constraints
psql <connection-string> < database/story_usage_tracking.sql
```

Or manually:

```sql
-- Add cost tracking idempotency
ALTER TABLE story_usage_tracking 
ADD CONSTRAINT unique_usage_tracking 
UNIQUE (job_id, scene_index, provider, resource_type);

-- Create webhook tracking table
-- (see full SQL in database/story_usage_tracking.sql)
```

## Failure Scenarios Handled

| Scenario | Without Idempotency | With Idempotency |
|----------|---------------------|------------------|
| Worker crashes after trackUsage | User charged twice | User charged once ✓ |
| Replicate sends webhook twice | Scene counted twice | Scene counted once ✓ |
| Network retry after success | Cost duplicated | Cost ignored ✓ |
| Parallel webhook delivery | Race condition | First wins ✓ |

## Performance Impact

**Minimal overhead**:
- Unique constraint check: ~0.1ms (indexed)
- No additional queries needed
- Atomic operation at database level
- No distributed coordination needed

## Support

If you see errors:
- Check constraint names match
- Verify migration ran successfully
- Check Supabase logs for constraint violations (expected!)
- Duplicate attempts should be logged, not crash

