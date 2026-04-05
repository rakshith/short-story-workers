import { Env, QueueMessage } from "../types/env";
import { StoryTimeline, VideoConfig, ProjectStatus } from "../types";
import { updateJobStatus } from "./queue-processor";
import { initCoordinator } from "../utils/coordinator";
import { sendQueueBatch } from "../utils/queue-batch";
import { templateSkipsImageStep } from "../config/template-video-config";
import {
  trackAIUsageInternal,
  trackAndDeductCredits,
} from "./usage-tracking";
import { estimateVideoGeneration } from "@artflicks/credit-tracker";
import type { CostResponse } from "@artflicks/credit-tracker";

export interface StoryOrchestratorInput {
  jobId: string;
  userId: string;
  storyData: StoryTimeline;
  videoConfig: VideoConfig;
  baseUrl: string;
  userTier: string;
  priority: number;
  seriesId?: string;
  teamId?: string;
  title?: string;
  usageData?: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  durationSeconds?: number;
  env: Env;
}

export interface StoryOrchestratorResult {
  success: boolean;
  storyId?: string;
  error?: string;
  cost?: CostResponse;
  creditsDeducted?: boolean;
  creditError?: string;
}

export interface VideoResumeInput {
  storyId: string;
  userId: string;
  videoConfig: VideoConfig;
  baseUrl: string;
  userTier: string;
  priority: number;
  teamId?: string;
  title?: string;
  env: Env;
}

/**
 * Orchestrates story creation: DB record, cost tracking, coordinator init, job queuing
 * This is the shared core logic used by all story creation endpoints
 */
export async function orchestrateStoryCreation(
  input: StoryOrchestratorInput
): Promise<StoryOrchestratorResult> {
  const {
    jobId,
    userId,
    storyData,
    videoConfig,
    baseUrl,
    userTier,
    priority,
    seriesId,
    teamId,
    title,
    usageData,
    durationSeconds,
    env,
  } = input;

  try {
    // Create story in database
    const createResult = await createStoryRecord({
      jobId,
      userId,
      storyData,
      videoConfig,
      seriesId,
      teamId,
      env,
    });

    if ("error" in createResult) {
      // Track AI usage even if story creation failed
      if (usageData) {
        await trackAIUsageInternal(env, {
          userId,
          teamId,
          provider: "openai",
          model: videoConfig?.model || "gpt-5.2",
          feature: "script-generation",
          type: "text",
          inputTokens: usageData.promptTokens,
          outputTokens: usageData.outputTokens,
          totalTokens: usageData.totalTokens,
          durationSeconds: durationSeconds || 0,
          correlationId: jobId,
          source: "api",
        });
      }
      return { success: false, error: createResult.error };
    }

    const storyId = createResult.id;

    // Track AI usage with storyId now available
    if (usageData) {
      await trackAIUsageInternal(env, {
        userId,
        teamId,
        provider: "openai",
        model: videoConfig?.model || "gpt-5.2",
        feature: "script-generation",
        type: "text",
        inputTokens: usageData.promptTokens,
        outputTokens: usageData.outputTokens,
        totalTokens: usageData.totalTokens,
        durationSeconds: durationSeconds || 0,
        correlationId: storyId,
        source: "api",
      });
    }

    // Initialize coordinator and queue jobs
    try {
      await initializeCoordinator(storyId, userId, storyData, videoConfig, env);
      await queueGenerationJobs({
        jobId,
        userId,
        storyId,
        storyData,
        videoConfig,
        baseUrl,
        userTier,
        priority,
        seriesId,
        teamId,
        title,
        env,
      });
    } catch (error) {
      console.error("[Story Orchestrator] Error in coordinator/queue:", error);

      // Broadcast failure to SSE clients
      await broadcastFailure(storyId, jobId, error, env);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to queue generation jobs",
      };
    }

    return {
      success: true,
      storyId,
      cost: createResult.cost,
      creditsDeducted: createResult.creditsDeducted,
      creditError: createResult.creditError,
    };
  } catch (error) {
    console.error("[Story Orchestrator] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error in orchestration",
    };
  }
}

/**
 * Orchestrates video generation resume for existing stories
 * Called when user passes storyId to continue from image generation to video generation
 */
export async function orchestrateVideoResume(
  input: VideoResumeInput
): Promise<StoryOrchestratorResult> {
  const {
    storyId,
    userId,
    videoConfig,
    baseUrl,
    userTier,
    priority,
    teamId,
    title,
    env,
  } = input;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Fetch existing story
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id, story, video_config, status, video_generation_triggered")
      .eq("id", storyId)
      .single();

    if (storyError || !story) {
      return { success: false, error: "Story not found" };
    }

    // Check if video generation already triggered
    if (story.video_generation_triggered) {
      return {
        success: false,
        error: "Video generation has already been triggered for this story",
      };
    }

    // Check if story has scenes
    const storyData = story.story as StoryTimeline;
    if (!storyData?.scenes) {
      return { success: false, error: "Story has no scenes" };
    }

    const scenesWithImages = storyData.scenes
      .map((scene: any, index: number) => ({ scene, index }))
      .filter(({ scene }: { scene: any; index: number }) => scene.generatedImageUrl);

    const scenesNeedingVideo = scenesWithImages.filter(
      ({ scene }: { scene: any }) => !scene.generatedVideoUrl
    );

    if (scenesWithImages.length === 0) {
      return {
        success: false,
        error:
          "No scenes have generated images yet. Cannot trigger video generation.",
      };
    }

    if (scenesNeedingVideo.length === 0) {
      return {
        success: true,
        storyId,
        error: undefined,
      };
    }

    // Check if story is in a valid status
    const validStatuses = ["processing", "completed", "awaiting_review", "draft"];
    if (!validStatuses.includes(story.status)) {
      return {
        success: false,
        error: `Story is in invalid status: ${story.status}. Cannot trigger video generation.`,
      };
    }

    // Update story to mark video generation as triggered
    await supabase
      .from("stories")
      .update({
        video_generation_triggered: true,
        status: "processing",
      })
      .eq("id", storyId);

    // Get or create job for this story
    const { data: existingJob } = await supabase
      .from("story_jobs")
      .select("job_id")
      .eq("story_id", storyId)
      .in("status", ["processing", "awaiting_review"])
      .single();

    const jobId =
      existingJob?.job_id || (await import("../utils/storage")).generateUUID();

    // Create/update job
    await supabase.from("story_jobs").upsert(
      {
        job_id: jobId,
        user_id: userId,
        story_id: storyId,
        status: "processing",
        progress: 50,
        total_scenes: storyData.scenes.length,
        images_generated: storyData.scenes.length,
        audio_generated: 0,
        updated_at: new Date().toISOString(),
        teamId,
      },
      { onConflict: "job_id" }
    );

    // Initialize DO with story data - skip audio check for Step 2
    const coordinatorId = env.STORY_COORDINATOR.idFromName(storyId);
    const coordinator = env.STORY_COORDINATOR.get(coordinatorId);

    await initCoordinator(coordinator, {
      storyId,
      userId,
      scenes: storyData.scenes,
      totalScenes: storyData.scenes.length,
      videoConfig: videoConfig || (story.video_config as VideoConfig),
      skipAudioCheck: true,
      sceneReviewRequired: false,
    });

    // Queue video generation jobs only for scenes needing video
    const videoMessages: QueueMessage[] = scenesNeedingVideo.map(
      ({ index, scene }: { index: number; scene: any }) => ({
        jobId,
        userId,
        seriesId: videoConfig?.seriesId,
        storyId,
        title: storyData.title || title || "",
        videoConfig: videoConfig || (story.video_config as VideoConfig),
        sceneIndex: index,
        type: "video" as const,
        baseUrl,
        teamId,
        userTier,
        priority,
        generatedImageUrl: scene.generatedImageUrl,
      })
    );

    await sendQueueBatch(env.STORY_QUEUE, videoMessages);

    console.log(
      `[Story Orchestrator] Queued ${scenesNeedingVideo.length} video generation jobs for story ${storyId}`
    );

    return {
      success: true,
      storyId,
    };
  } catch (error) {
    console.error("[Story Orchestrator] Resume error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to resume video generation",
    };
  }
}

interface CreateStoryRecordInput {
  jobId: string;
  userId: string;
  storyData: StoryTimeline;
  videoConfig: VideoConfig;
  seriesId?: string;
  teamId?: string;
  env: Env;
}

interface CreateStoryRecordSuccess {
  id: string;
  cost: CostResponse;
  creditsDeducted: boolean;
  creditError?: string;
}

interface CreateStoryRecordError {
  error: string;
  statusCode: number;
}

async function createStoryRecord(
  input: CreateStoryRecordInput
): Promise<CreateStoryRecordSuccess | CreateStoryRecordError> {
  const { jobId, userId, storyData, videoConfig, seriesId, teamId, env } = input;

  try {
    const { StoryService } = await import("./supabase");
    const storyService = new StoryService(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Persist videoConfig with mediaType set
    const videoConfigToPersist = {
      ...videoConfig,
      mediaType: videoConfig?.mediaType ?? "image",
    } as VideoConfig;

    const createdStory = await storyService.createStory({
      userId,
      seriesId,
      title: storyData.title,
      videoType: videoConfig?.videoType || "faceless-video",
      story: storyData,
      status: ProjectStatus.PROCESSING,
      videoConfig: videoConfigToPersist,
      storyCost: videoConfig?.estimatedCredits,
      teamId,
    });

    console.log(
      `[Story Orchestrator] Story created in database with ID: ${createdStory.id}`
    );

    // Progress Update: Story created - 25%
    await updateJobStatus(
      jobId,
      {
        jobId,
        userId,
        status: ProjectStatus.PROCESSING,
        progress: 25,
        totalScenes: storyData.scenes.length,
        imagesGenerated: 0,
        audioGenerated: 0,
        storyId: createdStory.id,
        teamId,
      },
      env
    );

    // Calculate cost
    const costResponse = calculateGenerationCost(videoConfig, storyData);
    console.log(`[Story Orchestrator] Calculated cost:`, costResponse);

    // Track and deduct credits
    let creditsDeducted = false;
    let creditError: string | undefined;

    if (costResponse.valid && costResponse.credits > 0) {
      const deductResult = await trackAndDeductCredits(
        jobId,
        userId,
        createdStory.id,
        costResponse,
        env
      );
      creditsDeducted = deductResult.deducted;
      creditError = deductResult.error;

      if (!deductResult.deducted) {
        console.warn(`[Story Orchestrator] Credit deduction failed: ${deductResult.error}`);
      }
    }

    return {
      id: createdStory.id,
      cost: costResponse,
      creditsDeducted,
      creditError,
    };
  } catch (error) {
    console.error(`[Story Orchestrator] Failed to create story:`, error);

    const errorMessage = error instanceof Error ? error.message : "";
    const isDuplicateTitle = errorMessage.includes("unique_user_story_title");

    await updateJobStatus(
      jobId,
      {
        jobId,
        userId,
        status: "failed",
        progress: 0,
        totalScenes: storyData.scenes.length,
        imagesGenerated: 0,
        audioGenerated: 0,
        error: isDuplicateTitle
          ? `A story with the title "${storyData?.title || "Unknown"}" already exists`
          : errorMessage || "Failed to create story",
        teamId,
      },
      env
    );

    return {
      error: isDuplicateTitle
        ? `A story with the title "${storyData?.title || "Unknown"}" already exists`
        : errorMessage || "Failed to create story",
      statusCode: isDuplicateTitle ? 409 : 500,
    };
  }
}

function calculateGenerationCost(
  videoConfig: VideoConfig,
  storyData: StoryTimeline
): CostResponse {
  try {
    const mediaType = videoConfig?.mediaType;
    let modelTier = videoConfig?.mediaTier || "basic";
    const duration = storyData.totalDuration || 15;

    const mediaTypeStr = String(mediaType || "video");
    const isImage = mediaTypeStr === "ai-images" || mediaTypeStr === "image";
    const mediaTypeForCalc: "ai-images" | "ai-videos" = isImage
      ? "ai-images"
      : "ai-videos";

    const result = estimateVideoGeneration({
      duration,
      modelTier,
      mediaType: mediaTypeForCalc,
      enableImmersiveAudio: videoConfig?.enableImmersiveAudio,
    });

    return {
      credits: result.totalCredits,
      breakdown: result.breakdown,
      currency: "credits",
      valid: true,
    };
  } catch (error) {
    console.error("[Story Orchestrator] Error calculating cost:", error);
    return {
      credits: 0,
      breakdown: {},
      currency: "credits",
      valid: false,
      error:
        error instanceof Error ? error.message : "Unknown error calculating cost",
    };
  }
}

async function initializeCoordinator(
  storyId: string,
  userId: string,
  storyData: StoryTimeline,
  videoConfig: VideoConfig,
  env: Env
): Promise<void> {
  const coordinatorId = env.STORY_COORDINATOR.idFromName(storyId);
  const coordinator = env.STORY_COORDINATOR.get(coordinatorId);
  await initCoordinator(coordinator, {
    storyId,
    userId,
    scenes: storyData.scenes,
    totalScenes: storyData.scenes.length,
    videoConfig,
    sceneReviewRequired: videoConfig?.sceneReviewRequired || false,
  });
  console.log(
    `[Story Orchestrator] Durable Object initialized for story ${storyId}`
  );
}

interface QueueGenerationJobsInput {
  jobId: string;
  userId: string;
  storyId: string;
  storyData: StoryTimeline;
  videoConfig: VideoConfig;
  baseUrl: string;
  userTier: string;
  priority: number;
  seriesId?: string;
  teamId?: string;
  title?: string;
  env: Env;
}

async function queueGenerationJobs(
  input: QueueGenerationJobsInput
): Promise<void> {
  const {
    jobId,
    userId,
    storyId,
    storyData,
    videoConfig,
    baseUrl,
    userTier,
    priority,
    seriesId,
    teamId,
    title,
    env,
  } = input;

  const mediaType = videoConfig?.mediaType === "video" ? "video" : "image";
  const sceneReviewRequired = videoConfig?.sceneReviewRequired === true;
  const templateId = videoConfig?.templateId;
  const skipsImageStep = templateSkipsImageStep(templateId);
  const shouldQueueVideos =
    mediaType === "image" || (mediaType === "video" && skipsImageStep);

  // Queue visual generation jobs
  const visualMessages: QueueMessage[] = storyData.scenes.map((scene, index) => ({
    jobId,
    userId,
    seriesId,
    storyId,
    title: storyData.title || title || "",
    videoConfig,
    sceneIndex: index,
    type: shouldQueueVideos
      ? ((mediaType === "video" ? "video" : "image") as QueueMessage["type"])
      : ("image" as const),
    baseUrl,
    teamId,
    userTier,
    priority,
  }));

  await sendQueueBatch(env.STORY_QUEUE, visualMessages);
  console.log(
    `[Story Orchestrator] Queued ${storyData.scenes.length} ${shouldQueueVideos ? mediaType : "image"} generation jobs (Priority: ${priority})`
  );

  if (mediaType === "video" && !shouldQueueVideos) {
    if (!sceneReviewRequired) {
      console.log(
        `[Story Orchestrator] Videos will be queued after image completion (sceneReviewRequired=false)`
      );
    } else {
      console.log(
        `[Story Orchestrator] Videos will be queued after user triggers with storyId (sceneReviewRequired=true)`
      );
    }
  } else if (mediaType === "video" && skipsImageStep) {
    console.log(`[Story Orchestrator] Template uses direct text-to-video`);
  }

  // Queue audio generation jobs (only if enableVoiceOver is not false)
  const enableVoiceOver = videoConfig?.enableVoiceOver !== false;

  if (enableVoiceOver) {
    const audioMessages: QueueMessage[] = storyData.scenes.map((scene, index) => ({
      jobId,
      userId,
      seriesId,
      storyId,
      title: storyData.title || title || "",
      videoConfig,
      sceneIndex: index,
      type: "audio" as const,
      baseUrl,
      teamId,
      userTier,
      priority,
    }));

    await sendQueueBatch(env.STORY_QUEUE, audioMessages);
    console.log(
      `[Story Orchestrator] Queued ${storyData.scenes.length} audio generation jobs (Priority: ${priority})`
    );
  } else {
    console.log(`[Story Orchestrator] Audio generation skipped (enableVoiceOver=false)`);
  }
}

async function broadcastFailure(
  storyId: string,
  jobId: string,
  error: unknown,
  env: Env
): Promise<void> {
  try {
    const isStaging = !env.ENVIRONMENT || env.ENVIRONMENT === "staging";
    const workerUrl = isStaging
      ? "https://create-story-worker-staging.matrixrak.workers.dev"
      : "https://create-story-worker-production.matrixrak.workers.dev";

    await fetch(`${workerUrl}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        data: {
          type: "story_failed",
          storyId,
          jobId,
          error: error instanceof Error ? error.message : "Failed to create story",
        },
      }),
    });
  } catch (broadcastError) {
    console.error("[Story Orchestrator] Failed to broadcast failure:", broadcastError);
  }
}
