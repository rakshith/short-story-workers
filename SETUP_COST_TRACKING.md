# Setup Guide: Cost Tracking

Quick guide to enable cost tracking for your story generation system.

## Step 1: Run Database Migration

Execute the SQL migration to create the tracking table:

```bash
# Connect to your Supabase database
psql <your-supabase-connection-string>

# Or use Supabase SQL Editor in dashboard
```

Run the migration file:
```sql
-- Copy and paste contents from: database/story_usage_tracking.sql
```

## Step 2: Verify Table Creation

Check if the table and view were created:

```sql
-- Check table exists
SELECT * FROM story_usage_tracking LIMIT 1;

-- Check view exists
SELECT * FROM story_cost_summary LIMIT 1;
```

## Step 3: Deploy Updated Worker

Deploy the worker with cost tracking:

```bash
# For staging
npm run deploy:staging

# For production
npm run deploy:production
```

## Step 4: Test Cost Tracking

Create a test story and check if costs are being tracked:

```bash
# 1. Create a story
curl -X POST https://your-worker.workers.dev/create-story \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "seriesId": "test-series",
    "userTier": "tier2",
    "script": {...},
    "videoConfig": {...}
  }'

# Response: { "jobId": "abc123", ... }

# 2. Check status with cost info
curl https://your-worker.workers.dev/status?jobId=abc123

# Should return:
# {
#   "status": "processing",
#   "cost": {
#     "total": 0.045,
#     "breakdown": { ... }
#   }
# }
```

## Step 5: Query Cost Data

### Check if tracking is working:

```sql
-- Recent cost records
SELECT * FROM story_usage_tracking 
ORDER BY recorded_at DESC 
LIMIT 10;
```

Expected output:
```
id          | job_id | provider   | resource_type | total_cost_usd | recorded_at
------------|--------|------------|---------------|----------------|-------------
uuid...     | abc123 | replicate  | image         | 0.003          | 2024-...
uuid...     | abc123 | openai     | audio         | 0.015          | 2024-...
uuid...     | abc123 | cloudflare | queue_message | 0.000004       | 2024-...
```

### Check cost summary:

```sql
-- Cost summary for a job
SELECT * FROM story_cost_summary 
WHERE job_id = 'abc123';
```

Expected output:
```
job_id | total_cost_usd | replicate_cost | openai_cost | cloudflare_cost
-------|----------------|----------------|-------------|----------------
abc123 | 0.053          | 0.015          | 0.038       | 0.000
```

## Step 6: Monitor Costs

### Daily cost monitoring:

```sql
-- Today's total costs
SELECT SUM(total_cost_usd) as today_total
FROM story_usage_tracking
WHERE DATE(recorded_at) = CURRENT_DATE;
```

### Per-user monitoring:

```sql
-- Top 10 spenders today
SELECT user_id, SUM(total_cost_usd) as spent
FROM story_usage_tracking
WHERE DATE(recorded_at) = CURRENT_DATE
GROUP BY user_id
ORDER BY spent DESC
LIMIT 10;
```

## Troubleshooting

### Issue: No cost records appearing

**Check 1**: Verify function is being called
```typescript
// Add console.log in usage-tracking.ts
console.log('[Usage Tracking] Recording:', record);
```

**Check 2**: Verify Supabase permissions
```sql
-- Check if service role can insert
INSERT INTO story_usage_tracking (job_id, user_id, provider, resource_type, quantity, unit_cost_usd, total_cost_usd)
VALUES (gen_random_uuid(), gen_random_uuid(), 'test', 'test', 1, 0.001, 0.001);
```

**Check 3**: Check worker logs
```bash
wrangler tail --env production
```

### Issue: Cost summary view returns empty

**Cause**: No matching records in story_usage_tracking

**Fix**: Generate a test story first, then query the view

### Issue: Foreign key constraint error

**Problem**: `story_jobs` table doesn't exist or job_id doesn't match

**Fix**: Ensure story_jobs entry is created before tracking costs

## Pricing Updates

To update pricing (e.g., Replicate changes their prices):

1. Edit `src/services/usage-tracking.ts`
2. Update the `PRICING` constant:

```typescript
export const PRICING = {
  replicate: {
    'flux-schnell': 0.003, // ← Update this
    // ...
  },
  // ...
};
```

3. Redeploy worker:
```bash
npm run deploy:production
```

**Note**: Pricing changes only affect NEW cost records. Historical records keep original pricing.

## Integration with Frontend

### Show cost in real-time:

```javascript
// Poll status endpoint
const response = await fetch(`/status?jobId=${jobId}`);
const data = await response.json();

// Display cost
console.log(`Total cost: $${data.cost.total}`);
console.log(`Replicate: $${data.cost.breakdown.replicate}`);
console.log(`OpenAI: $${data.cost.breakdown.openai}`);
```

### Show user's monthly spending:

```sql
-- Create an endpoint or query:
SELECT SUM(total_cost_usd) 
FROM story_usage_tracking
WHERE user_id = ? 
  AND recorded_at >= DATE_TRUNC('month', CURRENT_DATE);
```

## Success Indicators

✅ Cost records appear in `story_usage_tracking` table  
✅ Status endpoint returns cost information  
✅ Cost summary view shows aggregated data  
✅ All operations tracked (images, audio, workers, queue, storage)  
✅ Costs match expected pricing  
✅ No linter errors  
✅ Worker deploys successfully  

## Next Steps

1. **Set up alerts**: Monitor for unusually high costs
2. **Create dashboard**: Visualize cost trends
3. **Implement budgets**: Add per-user spending limits
4. **Generate invoices**: Use cost data for billing
5. **Optimize costs**: Analyze expensive operations

## Support

If you encounter issues:
1. Check worker logs: `wrangler tail`
2. Check database logs in Supabase dashboard
3. Verify all migrations ran successfully
4. Ensure service role key has correct permissions

