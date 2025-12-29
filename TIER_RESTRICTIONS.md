# Tier-Based Restrictions for Cost-Effective Story Generation

This document explains the tier-based system implemented for story generation to optimize compute costs through concurrency control and intelligent batching.

## Overview

The system implements four tiers (tier1 through tier4) with different concurrency and batch processing limits. Higher tiers get more concurrent processing power and priority, ensuring better performance for premium users while keeping costs under control for lower tiers.

## Tier Configuration

### Tier 1 (Basic)
- **Max Concurrent Jobs**: 2
- **Batch Size**: 3
- **Priority**: 1 (Lowest)
- **Use Case**: Free or basic users

### Tier 2 (Standard)
- **Max Concurrent Jobs**: 5
- **Batch Size**: 5
- **Priority**: 2
- **Use Case**: Standard paid users

### Tier 3 (Professional)
- **Max Concurrent Jobs**: 10
- **Batch Size**: 10
- **Priority**: 3
- **Use Case**: Professional users with higher needs

### Tier 4 (Enterprise)
- **Max Concurrent Jobs**: 20
- **Batch Size**: 15
- **Priority**: 4 (Highest)
- **Use Case**: Enterprise users with maximum performance requirements

## How It Works

### 1. Concurrency Control
- Each user tier has a maximum number of concurrent jobs they can run
- When a job is queued, the system checks how many active jobs the user currently has
- If the limit is reached, the job is retried later (not dropped)
- This prevents resource exhaustion and keeps costs predictable

### 2. Priority Processing
- Jobs are sorted by priority before processing
- Tier 4 users get processed before Tier 1 users
- This ensures premium users have the best experience
- Lower-tier users still get processed, just with slightly more delay during high load

### 3. Intelligent Batching
- Queue consumers process messages in batches for efficiency
- Batch sizes are optimized per tier to balance throughput and latency
- Higher tiers get larger batches for faster processing

## Implementation Details

### Key Files

1. **`src/config/tier-config.ts`**
   - Defines tier configurations (concurrency, batch size, priority)
   - Helper functions to get tier settings

2. **`src/services/concurrency-manager.ts`**
   - Enforces concurrency limits per user
   - Sorts messages by priority for optimal processing
   - Queries database for active job counts

3. **`src/queue-consumer.ts`**
   - Main queue processing logic
   - Checks concurrency before processing each job
   - Retries jobs when concurrency limit reached

4. **`src/routes/create-story.ts`**
   - Accepts user tier in request
   - Calculates priority from tier
   - Passes tier info to queue messages

### Usage in API Requests

When creating a story, include the `userTier` field:

```json
{
  "script": "...",
  "videoConfig": {
    "userTier": "tier3",
    // ... other config
  },
  "userId": "user123",
  "seriesId": "series456",
  "userTier": "tier3"
}
```

If `userTier` is not provided, it defaults to `tier1`.

## Cost Savings

### How This Reduces Costs

1. **Prevents Resource Hogging**
   - Lower-tier users can't consume unlimited resources
   - Predictable resource usage per user type

2. **Batch Processing Efficiency**
   - Processing multiple jobs together reduces overhead
   - Better utilization of Cloudflare Workers resources

3. **Priority-Based Processing**
   - Premium users get fast service (higher retention)
   - Free users still get service but with acceptable delays
   - No need to over-provision for peak loads

4. **Automatic Load Balancing**
   - Jobs are retried when limits reached
   - Natural throttling during high load
   - No manual intervention needed

## Monitoring

The system logs detailed information about:
- Active concurrency per user
- Priority assignments
- Jobs retried due to concurrency limits
- Tier information for each job

Example log output:
```
Processing image for job abc123 (Tier: tier3, Priority: 3)
Active Concurrency: 7/10
```

## Adjusting Tier Limits

To modify tier configurations, edit `src/config/tier-config.ts`:

```typescript
export const TIER_CONFIGS: Record<UserTier, TierConfig> = {
  tier1: {
    maxConcurrentJobs: 2,  // Adjust this
    maxBatchSize: 3,       // Adjust this
    priority: 1,           // Adjust this
  },
  // ... other tiers
};
```

After changes, redeploy the worker:
```bash
npm run deploy:staging  # or deploy:production
```

## Database Requirements

The system uses the `story_jobs` table to track active jobs. Ensure this table exists with:
- `user_id` column
- `status` column (with 'processing' status)
- Appropriate indexes for fast lookups

## Future Enhancements

Possible improvements:
- Dynamic tier adjustment based on usage patterns
- Time-based throttling (e.g., requests per minute)
- Cost tracking per tier for billing
- Real-time dashboard showing concurrency by tier

