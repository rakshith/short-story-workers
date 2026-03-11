## Why
<!-- Explain the motivation. What problem does this solve? Why now? -->
Currently when `mediaType` is `video`, images and videos are generated in a single workflow. Users cannot review the generated images before video generation starts. This causes issues when users want to make changes to scenes before committing to video generation (which is more expensive and time-consuming).

## What Changes
<!-- Bullet list of changes. Mark breaking changes with **BREAKING**. -->
- Add `sceneReviewRequired` field to VideoConfig
- Add `awaiting_review` status to job status tracking
- Add database columns for scene review tracking
- Modify queue consumer to stop after image generation when review is required
- Modify `/generate-and-create-story` to detect existing stories with images and trigger video generation

## Capabilities
### New Capabilities
- `two-step-video-generation`: Two-step workflow where images are generated first, user reviews, then videos are generated from the reviewed images

### Modified Capabilities
- `/generate-and-create-story`: Now supports resuming video generation for stories with existing images

## Impact
<!-- Affected code, APIs, dependencies, systems -->
- `src/types/index.ts`: Add `sceneReviewRequired` to VideoConfig
- `src/types/env.ts`: Add `awaiting_review` to job status
- `src/queue-consumer.ts`: Conditional video generation based on review requirement
- `src/routes/generate-story.ts`: Detect existing story with images, trigger video generation
- Database: Add columns to `stories` and `story_jobs` tables
