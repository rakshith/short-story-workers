# Cloudflare Dashboard - Cost Verification Guide

## How to Check Real Worker Metrics

### 1. Access Analytics
1. Log in to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → Select your worker (`create-story-worker-staging` or `create-story-worker-production`)
3. Click on the **Metrics** or **Analytics** tab

### 2. Key Metrics to Monitor

Look for these metrics over the past 24 hours or week:

#### Worker Invocations
- **Location**: Main analytics dashboard
- **What to look for**: Total number of requests/invocations
- **Expected improvement**: Should be **~90% lower** than before for the same number of stories

#### Queue Operations
- **Location**: Navigate to **Queues** section → Select `story-processing-staging` or `story-processing-production`
- **What to look for**: 
  - Total messages sent
  - Total messages received
- **Expected improvement**: Should be **~50-60% lower**

#### Durable Object Requests
- **Location**: Workers & Pages → Durable Objects → `StoryCoordinator`
- **What to look for**: Total requests
- **Expected improvement**: Should be **~50-60% lower**

### 3. Cost Breakdown
Navigate to **Billing** → **Usage** to see:
- Workers requests (within free tier of 100k/day)
- Durable Object requests
- Queue operations
- CPU time

### 4. Quick Comparison Test

**Before Optimization** (for 10 stories with 10 scenes each):
- Worker invocations: ~250
- Queue operations: ~500
- Durable Object requests: ~500

**After Optimization** (expected):
- Worker invocations: ~20
- Queue operations: ~220
- Durable Object requests: ~220

### 5. Alternative: Using Wrangler CLI

You can also pull metrics using the Wrangler CLI:

\`\`\`bash
# View worker analytics
wrangler analytics --env staging

# View specific metrics
wrangler tail --env staging
\`\`\`

### 6. What to Report Back

Once you check the dashboard, let me know:
1. How many stories were processed in the last 24 hours?
2. What were the total worker invocations?
3. What were the total queue operations?

I can then compare this to our theoretical calculations and confirm the actual savings!
