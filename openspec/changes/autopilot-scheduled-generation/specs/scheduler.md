## Autopilot Scheduler

### Execution Flow

```
Cron Trigger (every hour)
  ↓
runAutopilotCycle()
  ↓
Query autopilot_schedules WHERE enabled = true
  ↓
For each user (batched by 10):
  ├─ Check current hour/day against preferred_hours/preferred_days
  │   └─ Skip if not matching
  ├─ Check credit balance
  │   └─ BLOCK if insufficient (critical: must not be fail-open)
  ├─ Check daily quota via autopilot_daily_usage
  │   └─ BLOCK if quota exceeded
  ├─ Check circuit breaker state
  │   └─ BLOCK if open (API failures detected)
  ├─ Insert pending record in autopilot_history
  ├─ Fetch trending content
  │   └─ Use trending-content service
  ├─ Generate script via OpenAI
  ├─ Generate unique title (avoid DB constraints)
  └─ Call orchestrateStoryCreation with autopilot flag
```

### Key Behaviors

1. **Batch Processing**: Process users in batches of 10 to avoid queue saturation
2. **Idempotency**: Each scheduled generation has unique ID; retries safe
3. **Graceful Failure**: One user's failure doesn't affect others
4. **Logging**: All actions logged with `[Autopilot]` prefix

### Concurrency Control

```typescript
const MAX_AUTOPILOT_CONCURRENT = 5;  // Max autopilot jobs per cron run
const BATCH_SIZE = 10;               // Users per batch
const DELAY_BETWEEN_BATCHES = 1000;  // 1 second between batches
```

### Error Handling

| Error Type | Action |
|-----------|--------|
| Credit insufficient | Skip user, log warning, mark as 'skipped_insufficient_credits' |
| Quota exceeded | Skip user, log info, mark as 'skipped_quota_exceeded' |
| Circuit breaker open | Skip user, log warning, mark as 'skipped_circuit_breaker' |
| Content fetch failed | Retry once, then skip with 'failed_content_fetch' |
| Script generation failed | Skip with 'failed_script_generation' |
| Story creation failed | Skip with 'failed_story_creation' |