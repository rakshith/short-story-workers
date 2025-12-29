# Tier-Based System - Quick Summary

## What Was Implemented

A cost-effective tier-based system for story generation that controls compute costs through:

1. **Concurrency Limits** - Prevents users from running too many jobs simultaneously
2. **Priority Processing** - Higher-tier users get processed first
3. **Intelligent Batching** - Optimized batch sizes per tier

## Tier Configurations

| Tier   | Max Concurrent Jobs | Batch Size | Priority | Description |
|--------|---------------------|------------|----------|-------------|
| tier1  | 2                   | 3          | 1        | Basic users |
| tier2  | 5                   | 5          | 2        | Standard    |
| tier3  | 10                  | 10         | 3        | Professional|
| tier4  | 20                  | 15         | 4        | Enterprise  |

## How to Use

### In API Request

Add `userTier` to your create-story request:

```json
POST /create-story
{
  "script": {...},
  "videoConfig": {...},
  "userId": "user123",
  "seriesId": "series456",
  "userTier": "tier3"  // ← Add this
}
```

### What Happens

1. **Job Queued**: Job is queued with tier info and calculated priority
2. **Queue Processing**: Jobs are sorted by priority (tier4 first, tier1 last)
3. **Concurrency Check**: Before processing, system checks if user has reached their tier limit
4. **Processing**: If allowed, job processes. If limit reached, job retries later
5. **Cost Savings**: Lower-tier users can't monopolize resources

## Example Flow

```
User A (tier4, priority 4) creates story → Queued
User B (tier1, priority 1) creates story → Queued
User C (tier3, priority 3) creates story → Queued

Queue processes in order:
1. User A (tier4) - processed first ✓
2. User C (tier3) - processed second ✓
3. User B (tier1) - processed last ✓

If User A already has 20 active jobs (tier4 limit):
→ Job is retried later, not dropped
```

## Cost Benefits

✅ **Prevents resource exhaustion** - Tier limits ensure no single user can consume all resources
✅ **Better experience for premium users** - Priority processing means faster results
✅ **Predictable costs** - Concurrency limits make costs predictable
✅ **Automatic throttling** - No manual intervention needed during high load
✅ **Fair resource distribution** - All users get service, higher tiers get priority

## Files Modified

- `src/config/tier-config.ts` - Tier configuration and helpers
- `src/services/concurrency-manager.ts` - Concurrency enforcement
- `src/queue-consumer.ts` - Queue processing with tier support
- `src/routes/create-story.ts` - Accept tier in API
- `src/types/env.ts` - Add tier to queue messages
- `src/types/index.ts` - Add tier to types
- `wrangler.toml` - Updated queue settings with comments

## Configuration

To adjust tier limits, edit `src/config/tier-config.ts`:

```typescript
export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  tier1: {
    maxConcurrentJobs: 2,   // Change as needed
    maxBatchSize: 3,        // Change as needed
    priority: 1,            // Change as needed
  },
  // ...
};
```

## Default Behavior

If no `userTier` is provided in the request, the system defaults to **tier1** (most restrictive, lowest priority).

## Monitoring

Check logs for tier-based processing:
```
[Queue Consumer] Processing image for job abc123 (Tier: tier3, Priority: 3)
Active Concurrency: 7/10
```

When concurrency limit reached:
```
[Concurrency Manager] Concurrency limit reached for user user123
Tier: tier2, Active: 5/5 - Job will retry
```

