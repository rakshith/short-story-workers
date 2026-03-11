# AGENTS.md - Agent Guidelines for this Repository

This file provides guidance for AI agents working in this codebase. It should be read first when starting work in this repository.

## Project Overview

This is a Cloudflare Workers project for creating short stories with AI-generated images and audio. It uses:
- **Cloudflare Workers** - Serverless runtime
- **Queues** - Async job processing
- **Durable Objects** - State coordination per story
- **R2 Buckets** - Media storage (images, audio, videos)
- **Supabase** - Database
- **Replicate** - Image/video generation
- **OpenAI** - Script generation
- **ElevenLabs** - Voice generation
- **OpenSpec** - Spec-driven development

## Build Commands

```bash
# Development
npm run dev                    # Local development server
npm run dev:staging           # Local with staging env
npm run dev:remote            # Remote Cloudflare dev

# Type checking
npm run type-check            # TypeScript validation (always run before deploying)

# Deployment
npm run deploy                # Deploy to default env
npm run deploy:stg            # Deploy to staging
npm run deploy:prod           # Deploy to production

# Logging
npm run log                   # View local worker logs
npm run log:capture           # Capture logs to logs/worker.log
npm run log:capture:stg       # Capture staging logs
npm run log:capture:prod      # Capture production logs
npm run monitor:stg           # Pretty-print staging logs
npm run monitor:prod          # Pretty-print production logs

# Linting
npm run unused                # Check for unused code (knip)
```

**Always run `npm run type-check` before deploying.**

## Testing

This project uses **manual spec-based testing** rather than automated test frameworks:

```bash
# Run a spec test (manual)
node lib/@artflicks/video-compiler/src/__tests__/scene.adapter.spec.ts

# Tests are spec files in lib/@artflicks/video-compiler/src/__tests__/
# Run with: node <path-to-spec-file>
```

## Spec Driven Development

This project uses **OpenSpec** for tracking feature specifications. All new features should be developed using this workflow:

### OpenSpec Commands (via .cursor/skills/)

```bash
# Using Cursor:Cmd+Shift+P → "openspec" commands
# Or manually via openspec CLI if installed
```

### OpenSpec Workflow

1. **Create a new spec change**: Define the feature/spec in `openspec/changes/<change-name>/`
2. **Verify implementation**: Run spec verification to ensure implementation matches
3. **Implement feature**: Code following the spec
4. **Test**: Run the spec test to verify

### OpenSpec Files

- `openspec/config.yaml` - OpenSpec configuration
- `openspec/changes/` - Feature specifications (create new dirs here)
- `.cursor/skills/openspec-*/` - Cursor skills for OpenSpec operations

**Reference**: Always check `openspec/changes/` for existing specs before implementing new features.

## Code Style Guidelines

### General Principles

- **No comments** unless absolutely necessary for understanding
- **Keep it simple** - prefer readability over cleverness
- **Fail fast** - validate inputs early, return clear errors
- **Log with context** - use `[SectionName]` prefix format

### TypeScript

- **Strict mode enabled** in tsconfig.json
- Use explicit types for function parameters and return types
- Use `unknown` for caught errors, then narrow with type guards
- Prefer interfaces over types for object shapes
- Use Zod for runtime validation (already a dependency)

### Naming Conventions

```typescript
// Files: kebab-case
// example: story-coordinator.ts, queue-processor.ts

// Types/Interfaces: PascalCase
interface StoryTimeline { }
type MediaType = 'image' | 'video';
enum ProjectStatus { }

// Functions/Variables: camelCase
const handleCreateStory = async () => { };
const activeJobsCount = 0;

// Constants: SCREAMING_SNAKE_CASE
const MAX_CONCURRENCY = 10;

// Booleans: prefix with is, has, should, can
const isProcessing = true;
const hasError = false;
```

### Imports

```typescript
// Order: external → internal → types → utils
import { Request } from '@cloudflare/workers-types';
import { Env, QueueMessage } from './types/env';
import { handleQueue } from './queue-consumer';
import { jsonResponse } from './utils/response';

// Use path aliases if available
import { compile } from '@artflicks/video-compiler';
```

### Response Handling

**Always use the response utilities** from `src/utils/response.ts`:

```typescript
import { jsonResponse, corsResponse, notFoundResponse } from './utils/response';

// Success
return jsonResponse({ success: true, jobId }, 200);

// Error
return jsonResponse({ error: 'Missing required fields' }, 400);

// Not found
return notFoundResponse(method, pathname);

// CORS preflight
return corsResponse();
```

### Error Handling

```typescript
// Always include error context in logs
console.error('[Create Story] Failed to process:', error);

// Return structured errors
return jsonResponse({
  error: 'Failed to queue story generation',
  details: error instanceof Error ? error.message : 'Unknown error',
}, 500);

// Validate early
if (!body.script || !body.videoConfig) {
  return jsonResponse({ error: 'Missing required fields' }, 400);
}
```

### Logging Format

Use `[SectionName]` prefix for all console logs:

```typescript
console.log('[Create Story] Queuing job', jobId);
console.error('[Queue Consumer] Failed to process message:', error);
console.log('[Webhook Handler] Received callback for', predictionId);
```

### Database Operations

- Use Supabase client from `@supabase/supabase-js`
- Always handle potential errors from Supabase queries
- Log database operations for debugging

```typescript
const { data, error } = await supabase
  .from('story_jobs')
  .select('job_id')
  .eq('user_id', userId);

if (error) {
  console.error('[Database] Failed to fetch jobs:', error);
  // Handle error appropriately
}
```

### Queue Processing

- Queue messages are typed in `src/types/env.ts`
- Process messages in batches when possible
- Handle failures gracefully - messages may retry

### Durable Objects

- Use `idFromName()` for story-specific DO instances
- Always initialize DO state before queuing dependent jobs
- DO coordinator tracks story progress across generations

## Project Structure

```
src/
├── index.ts                 # Worker entry point (fetch + queue handlers)
├── queue-consumer.ts       # Queue message processing
├── durable-objects/
│   └── story-coordinator.ts # Story state coordination
├── routes/
│   ├── create-story.ts      # POST /create-story
│   ├── generate-story.ts    # POST /generate-and-create-story
│   ├── status.ts            # GET /status
│   └── cancel-story.ts      # POST /cancel-generation
├── services/
│   ├── queue-processor.ts   # Queue job processing
│   ├── image-generation.ts  # Replicate image calls
│   ├── video-generation.ts  # Replicate video calls
│   ├── audio-generation.ts  # ElevenLabs calls
│   ├── script-generation.ts # OpenAI calls
│   ├── webhook-handler.ts   # Replicate webhooks
│   ├── supabase.ts          # Database operations
│   └── ...
├── types/
│   ├── index.ts             # Core types (Scene, StoryTimeline, etc.)
│   ├── env.ts               # Environment types
│   └── zod-types.ts         # Zod schemas
├── config/
│   ├── tier-config.ts       # Tier-based settings
│   └── ...
└── utils/
    ├── response.ts          # Response helpers
    ├── storage.ts           # UUID generation
    └── ...
lib/
└── @artflicks/
    └── video-compiler/      # Video compilation library
        └── src/
            ├── compile.ts   # Timeline compilation
            ├── types.ts     # Compiler types
            └── __tests__/   # Spec-based tests
openspec/
├── config.yaml              # OpenSpec configuration
└── changes/                 # Feature specifications
```

## Environment Variables

Required secrets (set via `wrangler secret put` or dashboard):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REPLICATE_API_TOKEN`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_DEFAULT_VOICE_ID`
- `ELEVENLABS_MODEL_ID`
- `AI_METER_INGEST_KEY`

Tier concurrency settings (set in wrangler.toml or vars):
- `TIER1_CONCURRENCY`, `TIER1_BATCH_SIZE`, `TIER1_PRIORITY`
- `TIER2_*`, `TIER3_*`, `TIER4_*`

## Common Tasks

### Adding a New Endpoint

1. Create handler in `src/routes/`
2. Add route in `src/index.ts` switch statement
3. Add spec in `openspec/changes/` if it's a new feature
4. Run `npm run type-check` before deploying

### Adding a New Service

1. Create file in `src/services/`
2. Import types from `src/types/`
3. Use `jsonResponse()` for responses
4. Use `[ServiceName]` logging prefix

### Modifying Types

1. Update types in `src/types/index.ts` or `src/types/env.ts`
2. Run `npm run type-check` to validate
3. Update Zod schemas in `src/types/zod-types.ts` if needed

## Before Deploying

Always run:

```bash
npm run type-check
```

If it passes, you're good to deploy. If there are errors, fix them before deploying.
