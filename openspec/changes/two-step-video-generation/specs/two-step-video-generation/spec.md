# Two-Step Video Generation with Scene Review

## Overview
This spec defines a two-step video generation workflow where:
1. **Step 1**: Images (and optionally audio/captions) are generated first
2. **User Review**: User reviews the generated images in UI
3. **Step 2**: Videos are generated from the reviewed images

## Trigger Conditions

### Two-Step Mode (Review Required)
When `mediaType: "video"` AND `sceneReviewRequired: true`:
- Images are generated for all scenes
- Audio is generated in parallel with images (if `enableCaptions: true`)
- After all images complete → status becomes `awaiting_review`
- Story is synced to DB with `generatedImageUrl`
- **Videos are NOT generated** - user must trigger manually

### Auto Mode (No Review)
When `mediaType: "video"` AND `sceneReviewRequired: false` OR not set:
- Current behavior: Images generated → Videos generated automatically
- This is the existing workflow

## Database Schema Changes

### stories table
```sql
-- Add column to track if review is required
ALTER TABLE stories ADD COLUMN scene_review_required boolean DEFAULT false;

-- Add column to track if video generation has been triggered
ALTER TABLE stories ADD COLUMN video_generation_triggered boolean DEFAULT false;
```

### story_jobs table
```sql
-- Add awaitingexisting_review status ( enum should support this)
-- No schema change needed - 'awaiting_review' as new status value
```

## Type Changes

### src/types/index.ts - VideoConfig
```typescript
interface VideoConfig {
  // ... existing fields ...
  sceneReviewRequired?: boolean;  // NEW: If true, pause after image generation for user review
  videoGenerationTriggered?: boolean;  // NEW: Track if videos have been triggered
}
```

### src/types/index.ts - ProjectStatus
```typescript
export const ProjectStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  AWAITING_REVIEW: 'awaiting_review',  // NEW: Waiting for user to review images
} as const;
```

## API Changes

### POST /generate-and-create-story

#### New Behavior: Resume Video Generation
When a request includes an existing `storyId` (story already exists with images):
1. Fetch story from database
2. Check if `generatedImageUrl` exists for scenes
3. Check if `video_generation_triggered` is false
4. If above conditions met → trigger video generation for all scenes
5. Update status from `awaiting_review` to `processing`
6. Set `video_generation_triggered = true`

#### Request Payload (Resume Case)
```typescript
{
  storyId: string;  // Existing story ID to resume
  userId: string;
  // Other fields optional - will use existing story data
}
```

## Queue Processing Logic

### src/queue-consumer.ts - Modified Flow

```
For each queue message:
├── If type === 'image':
│   ├── Generate image (async via Replicate)
│   ├── On webhook completion:
│   │   ├── Update DO with generatedImageUrl
│   │   └── Check if all images complete
│   │       └── If sceneReviewRequired === true:
│   │           ├── Set status = 'awaiting_review'
│   │           ├── Sync story to DB
│   │           └── DO NOT queue video messages
│   │       └── If sceneReviewRequired === false:
│   │           └── Queue video messages (existing behavior)
│   └── If NOT mediaType 'video':
│       └── Finalize story (existing behavior)
│
├── If type === 'video':
│   ├── Use generatedImageUrl from scene as input
│   ├── Generate video
│   ├── On webhook completion:
│   │   └── Update DO with generatedVideoUrl
│   └── When all videos complete:
│       └── Finalize story (existing behavior)
│
└── If type === 'audio':
    └── Generate audio (existing behavior, runs in parallel)
```

### Key Logic: Check Before Queueing Videos

In `src/queue-consumer.ts`, after image generation completes:

```typescript
// After image webhook processing
const story = await getStoryFromDB(storyId);
const shouldReview = story.scene_review_required === true;
const hasAllImages = allScenesHaveGeneratedImageUrl(scenes);

if (hasAllImages) {
  if (shouldReview) {
    // Stop here - user will review and trigger videos manually
    await updateJobStatus(jobId, { status: 'awaiting_review' });
    await syncStoryToSupabase(storyId, coordinator, env);
    // DO NOT queue video messages
  } else {
    // Auto-continue with video generation (existing behavior)
    await queueVideoMessages(jobId, scenes, env);
  }
}
```

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  POST /generate-and-create-story                                │
│  { mediaType: "video", sceneReviewRequired: true }             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Generate Images + Audio (in parallel)                │
│  - Each scene: triggerReplicateGeneration (image)              │
│  - If enableCaptions: true → generateSceneAudio                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Webhook: Image generation complete                              │
│  - Update DO with generatedImageUrl                            │
│  - Check: Are all images complete?                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  sceneReviewRequired === true?                                 │
│                                                                  │
│  YES:                           NO:                             │
│  ┌─────────────────────┐        ┌─────────────────────────┐    │
│  │ Status: awaiting_   │        │ Auto queue video msgs   │    │
│  │ review              │        │ (existing behavior)     │    │
│  │ Sync story to DB   │        │                         │    │
│  │ DO NOT queue video │        │                         │    │
│  └─────────────────────┘        └─────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (YES case)
┌─────────────────────────────────────────────────────────────────┐
│  User reviews images in UI                                      │
│  User clicks "Generate Videos"                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /generate-and-create-story                               │
│  { storyId: "existing-id" }                                    │
│                                                                  │
│  - Fetch existing story                                         │
│  - Check: generatedImageUrl exists?                           │
│  - Check: video_generation_triggered === false?               │
│  - If yes → Trigger video generation                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Generate Videos (using generatedImageUrl)            │
│  - Each scene: triggerVideoGeneration (using image as input)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  All videos complete → Finalize story                          │
│  - Status: completed                                            │
│  - Sync to DB                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Scenarios

### Scenario: sceneReviewRequired = false (Auto Mode)
```
Given: mediaType = "video", sceneReviewRequired = false (or not set)
When: User calls /generate-and-create-story
Then: 
  - Images are generated for all scenes
  - After images complete, videos are generated automatically
  - Status progresses: pending → processing → completed
  - Final story contains: generatedImageUrl + generatedVideoUrl + audioUrl
```

### Scenario: sceneReviewRequired = true (Two-Step Mode)
```
Given: mediaType = "video", sceneReviewRequired = true
When: User calls /generate-and-create-story
Then:
  - Images are generated for all scenes
  - Audio is generated (if enableCaptions: true)
  - After images complete:
    - Status = "awaiting_review"
    - Story synced to DB with generatedImageUrl
    - Videos are NOT generated
And:
  When User calls /generate-and-create-story with storyId
  Then:
    - Videos are generated for all scenes (using generatedImageUrl)
    - After videos complete: Status = "completed"
```

### Scenario: Resume with Invalid Story
```
Given: User calls /generate-and-create-story with storyId
When:
  - Story does not exist, OR
  - generatedImageUrl is missing for some scenes, OR
  - video_generation_triggered is already true
Then:
  Return error: "Cannot trigger video generation. Story not ready for video generation."
```

### Scenario: Audio Generation (Existing Behavior)
```
Given: enableCaptions = true, mediaType = "video"
When: User calls /generate-and-create-story
Then:
  - Audio is generated in parallel with images
  - Audio generation does NOT wait for review
  - Captions are generated along with audio
```
