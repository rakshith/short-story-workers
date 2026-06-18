## Safety Measures

### 1. Credit Check (CRITICAL)

**Current Problem:** Credit deduction failure only logs a warning; story creation proceeds.

**Solution:** Block autopilot story creation if credits insufficient.

```typescript
async function checkCreditsForAutopilot(
  userId: string,
  env: Env
): Promise<{ allowed: boolean; reason?: string }> {
  const balance = await getUserCreditBalance(userId, env);
  const estimatedCost = calculateStoryCost(env.DEFAULT_SCENE_COUNT || 4);
  
  if (balance < estimatedCost) {
    return {
      allowed: false,
      reason: `Insufficient credits: ${balance} available, ${estimatedCost} required`
    };
  }
  
  return { allowed: true };
}
```

### 2. Volume Quotas

**Daily Limits by Tier:**
- Tier 1: 1 story/day
- Tier 2: 2 stories/day
- Tier 3: 3 stories/day
- Tier 4: 5 stories/day

```typescript
async function checkDailyQuota(
  userId: string,
  env: Env
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: usage } = await env.SUPABASE
    .from('autopilot_daily_usage')
    .select('stories_generated')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();
  
  const userTier = await getUserTier(userId, env);
  const maxDaily = TIER_DAILY_LIMITS[userTier];
  const used = usage?.stories_generated || 0;
  
  return {
    allowed: used < maxDaily,
    remaining: maxDaily - used
  };
}
```

### 3. Circuit Breaker

Protects against third-party API failures.

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs = 300000  // 5 minutes
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - API failures detected');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState() {
    return { state: this.state, failures: this.failures };
  }
}
```

### 4. Queue Priority Separation

**Problem:** Autopilot jobs share queue with user-initiated jobs.

**Solution:** Use message metadata to prioritize user-initiated jobs.

```typescript
// In queue producer
await env.STORY_QUEUE.send(message, {
  contentType: 'json',
  // Cloudflare Queues don't support priority directly,
  // but we can use separate queues or metadata
});

// Message metadata
interface QueueMessage {
  type: 'user_initiated' | 'autopilot';
  // ... other fields
}
```

**Alternative:** Create separate queue for autopilot jobs with lower `max_concurrency`.

### 5. Title Uniqueness

Generate unique titles to avoid DB constraint violations.

```typescript
function generateUniqueTitle(baseTopic: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${baseTopic} - ${timestamp}${random}`;
}
```

### 6. Graceful Degradation

When system is under load, throttle autopilot first.

```typescript
async function shouldThrottleAutopilot(env: Env): Promise<boolean> {
  // Check queue depth
  const queueStats = await env.STORY_QUEUE.getQueueStats();
  if (queueStats.depth > 100) return true;
  
  // Check recent error rate
  const errorRate = await getRecentErrorRate(env);
  if (errorRate > 0.1) return true;  // >10% error rate
  
  return false;
}
```

### 7. Monitoring & Alerting

**Metrics to Track:**
- `autopilot_generation_total` (counter) - by status (success/failure/skipped)
- `autopilot_generation_duration` (histogram)
- `autopilot_credit_check_failures` (counter)
- `autopilot_circuit_breaker_state` (gauge)
- `autopilot_queue_depth` (gauge)

**Alerts:**
- Failure rate > 20% for 5 minutes
- Circuit breaker opened
- Queue depth > 500
- Credit system failures