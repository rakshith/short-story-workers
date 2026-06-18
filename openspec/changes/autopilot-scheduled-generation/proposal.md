## Why
<!-- Explain the motivation. What problem does this solve? Why now? -->
Users want automated story generation without manual intervention. Currently every story requires explicit user action via HTTP endpoints. Autopilot enables scheduled, automatic story generation based on user preferences and trending content, improving engagement and reducing friction.

## Safety Concerns
The current codebase has critical gaps that must be addressed before autopilot can safely operate:

1. **Credit check is fail-open** - `trackAndDeductCredits` failure only logs a warning; story creation proceeds anyway (src/services/story-orchestrator.ts:448-449)
2. **No volume/daily quotas** - Only concurrent job limits exist via concurrency-manager.ts
3. **No autopilot queue separation** - Autopilot jobs share queue with user-initiated jobs, risking saturation
4. **No circuit breaker** - API failures (Replicate/ElevenLabs/OpenAI) could cascade
5. **Title uniqueness** - DB unique constraint `unique_user_story_title` will reject duplicate titles
6. **No opt-in/opt-out** - No mechanism for users to enable/disable autopilot

## What Changes
<!-- Bullet list of changes. Mark breaking changes with **BREAKING**.**
- Add Cloudflare Cron Triggers for scheduled execution
- Add `autopilot_schedules` table for per-user configuration
- Add `autopilot_history` table for tracking generated stories
- Add `autopilot_daily_usage` table for volume quotas
- Add `trending_topics` table for content caching
- Create `autopilot-scheduler.ts` service for cron execution
- Create `trending-content.ts` service for hybrid content sourcing
- Create `autopilot-orchestrator.ts` for story generation orchestration
- Create `circuit-breaker.ts` utility for API failure protection
- Add API endpoints: `/autopilot/configure`, `/autopilot/status`, `/autopilot/enable`, `/autopilot/disable`
- Modify credit check to block on failure for autopilot jobs
- Add daily quota enforcement
- Add autopilot-specific logging with `[Autopilot]` prefix

## Capabilities
### New Capabilities
- `autopilot-scheduled-generation`: Users can enable autopilot to receive automatic story generation based on their preferences and trending content
- `trending-content-sourcing`: Hybrid system combining internal popularity metrics with external trending topics
- `volume-quotas`: Per-user daily story generation limits to prevent runaway costs
- `circuit-breaker`: Automatic protection against third-party API failures

### Modified Capabilities
- Credit checking: Now blocks story creation on failure for autopilot jobs (currently fail-open)
- Queue processing: Autopilot jobs marked with priority/origin metadata for separation

## Impact
<!-- Affected code, APIs, dependencies, systems -->
- `wrangler.toml`: Add `[triggers]` section with cron schedule
- `src/index.ts`: Add `scheduled` handler
- `src/services/story-orchestrator.ts`: Modify credit check to block on failure for autopilot
- `src/types/env.ts`: Add autopilot-related environment variables
- Database: Add 4 new tables (autopilot_schedules, autopilot_history, autopilot_daily_usage, trending_topics)
- New files:
  - `src/services/autopilot-scheduler.ts`
  - `src/services/trending-content.ts`
  - `src/services/autopilot-orchestrator.ts`
  - `src/utils/circuit-breaker.ts`
  - `src/routes/autopilot-configure.ts`
  - `src/routes/autopilot-status.ts`
  - `src/routes/autopilot-enable.ts`
  - `src/routes/autopilot-disable.ts`
- `src/index.ts`: Add route handling for autopilot endpoints