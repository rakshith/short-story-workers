import { Env, QueueMessage } from "../types/env";
import { StoryTimeline, VideoConfig, ProjectStatus } from "../types";
import { updateJobStatus } from "./queue-processor";
import { initCoordinator } from "../utils/coordinator";
import { sendQueueBatch } from "../utils/queue-batch";
import { TemplatePipelineConfig, getTemplateConfig } from "../config/template-config";
import { resolveWorkflow, getVideoTrigger, getNode, type ResolvedWorkflow } from "../utils/workflow-resolver";
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
  templateConfig?: TemplatePipelineConfig;
  /** Pre-calculated cost from workflow (e.g., AI UGC Ads). If provided, skips internal cost calculation. */
  preCalculatedCost?: {
    credits: number;
    breakdown: Record<string, unknown>;
  };
  /** Resolved workflow config (nodes + defaults). If provided, passed to DO. If not, orchestrator resolves it. */
  resolvedWorkflow?: ResolvedWorkflow;
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
    templateConfig,
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
      preCalculatedCost: input.preCalculatedCost,
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

    // When template has generateAudio: false, disable voice over so DO doesn't wait for audio
    const skipAudioFromTemplate = templateConfig?.generateAudio === false;
    const videoConfigForDo = skipAudioFromTemplate
      ? { ...videoConfig, enableVoiceOver: false }
      : videoConfig;

    // Resolve workflow config from decision tree (if not already provided by workflow)
    const resolvedWorkflow = input.resolvedWorkflow ?? resolveWorkflow({
      videoType: videoConfig?.videoType || '',
      templateId: videoConfig?.templateId,
      sceneReviewRequired: videoConfig?.sceneReviewRequired,
      productType: (videoConfig as any)?.productType,
      mediaType: videoConfig?.mediaType,
    }) ?? undefined;

    // Initialize coordinator and queue jobs
    try {
      await initializeCoordinator(storyId, userId, storyData, videoConfigForDo, env, resolvedWorkflow);
      await queueGenerationJobs({
        jobId,
        userId,
        storyId,
        storyData,
        videoConfig: videoConfigForDo,
        baseUrl,
        userTier,
        priority,
        seriesId,
        teamId,
        title,
        env,
        templateConfig,
        resolvedWorkflow,
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

    // Resolve workflow config for resume — all scenes produce video on resume
    const effectiveVideoConfig = videoConfig || (story.video_config as VideoConfig);
    const resolvedWorkflow = resolveWorkflow({
      videoType: effectiveVideoConfig?.videoType || '',
      templateId: effectiveVideoConfig?.templateId,
      sceneReviewRequired: false, // Resume always uses auto trigger
      productType: (effectiveVideoConfig as any)?.productType,
      mediaType: effectiveVideoConfig?.mediaType,
    });

    await initCoordinator(coordinator, {
      storyId,
      userId,
      scenes: storyData.scenes,
      totalScenes: storyData.scenes.length,
      videoConfig: effectiveVideoConfig,
      skipAudioCheck: true,
      sceneReviewRequired: false,
      resolvedWorkflow,
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
        templateConfig: getTemplateConfig((videoConfig || (story.video_config as VideoConfig))?.templateId),
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
  /** Pre-calculated cost from workflow (e.g., AI UGC Ads). If provided, skips internal cost calculation. */
  preCalculatedCost?: {
    credits: number;
    breakdown: Record<string, unknown>;
  };
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

    const fallbackDuration =
      typeof storyData?.totalDuration === "number" && Number.isFinite(storyData.totalDuration)
        ? storyData.totalDuration
        : storyData?.scenes?.reduce((sum, scene) => {
            const sceneDuration = typeof scene?.duration === "number" && Number.isFinite(scene.duration)
              ? scene.duration
              : 0;
            return sum + sceneDuration;
          }, 0) || 0;

    // Persist videoConfig with mediaType and duration set
    const videoConfigToPersist = {
      ...videoConfig,
      mediaType: videoConfig?.mediaType ?? "image",
      duration:
        typeof videoConfig?.duration === "number" && Number.isFinite(videoConfig.duration)
          ? videoConfig.duration
          : fallbackDuration,
    } as VideoConfig;

    // Calculate cost BEFORE story creation — uses actual scene count for accurate pricing
    // If preCalculatedCost is provided (e.g., from AI UGC Ads workflow), use it instead
    const costResponse = input.preCalculatedCost
      ? {
          credits: input.preCalculatedCost.credits,
          breakdown: input.preCalculatedCost.breakdown,
          currency: "credits" as const,
          valid: true,
        }
      : calculateGenerationCost(videoConfig, videoConfig.script, storyData.scenes?.length);
    console.log(`[Story Orchestrator] Calculated cost:`, costResponse);

    const createdStory = await storyService.createStory({
      userId,
      seriesId,
      title: storyData.title,
      videoType: videoConfig?.videoType || "faceless-video",
      story: storyData,
      status: ProjectStatus.PROCESSING,
      videoConfig: videoConfigToPersist,
      storyCost: costResponse.valid ? costResponse.credits : undefined,
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
  script?: string,
  sceneCount?: number
): CostResponse {
  try {
    const mediaType = videoConfig?.mediaType;
    let modelTier = videoConfig?.mediaTier || "basic";
    const duration = videoConfig.duration || 15;

    const isImage = videoConfig?.mediaType !== 'ai-videos';
    const mediaTypeForCalc: "ai-images" | "ai-videos" = isImage
      ? "ai-images"
      : "ai-videos";

    // Calculate script character count for voice pricing
    const scriptCharCount = script?.length || 0;

    const result = estimateVideoGeneration({
      modelTier,
      duration,
      mediaType: mediaTypeForCalc as any,
      enableImmersiveAudio: videoConfig?.enableImmersiveAudio,
      scriptCharCount,
      sceneCount,
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
  env: Env,
  resolvedWorkflow?: ResolvedWorkflow
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
    resolvedWorkflow,
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
  templateConfig?: TemplatePipelineConfig;
  resolvedWorkflow?: ResolvedWorkflow;
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
    templateConfig,
    resolvedWorkflow,
  } = input;

  // Read node enabled flags from resolved workflow config
  const audioNode = resolvedWorkflow ? getNode(resolvedWorkflow, 'audio') : undefined;
  const imageNode = resolvedWorkflow ? getNode(resolvedWorkflow, 'image') : undefined;
  const videoNode = resolvedWorkflow ? getNode(resolvedWorkflow, 'video') : undefined;
  const videoTrigger = resolvedWorkflow ? getVideoTrigger(resolvedWorkflow) : null;

  const shouldQueueAudio = audioNode?.enabled ?? (templateConfig?.generateAudio !== false);
  const shouldQueueImages = imageNode?.enabled ?? (templateConfig?.generateVisuals !== false);
  const shouldQueueVideos = videoNode?.enabled ?? true;
  const enableVoiceOver = videoConfig?.enableVoiceOver !== false;

  // Determine queue type for visual jobs:
  // - video node enabled + image node disabled → queue "video" directly (skipsImageStep)
  // - video node enabled + image node enabled + trigger "auto" → queue "image" first, videos queued after
  // - video node enabled + trigger "manual" → queue "image" only (videos on resume)
  // - only image node enabled → queue "image"
  // - only video node enabled → queue "video"
  let queueType: QueueMessage["type"] = "image";
  if (shouldQueueVideos && !shouldQueueImages) {
    queueType = "video";
  }

  // Queue visual generation jobs
  if (shouldQueueImages || shouldQueueVideos) {
    const visualMessages: QueueMessage[] = storyData.scenes.map((scene, index) => ({
      jobId,
      userId,
      seriesId,
      storyId,
      title: storyData.title || title || "",
      videoConfig,
      sceneIndex: index,
      type: queueType,
      baseUrl,
      teamId,
      userTier,
      priority,
      templateConfig,
    }));

    await sendQueueBatch(env.STORY_QUEUE, visualMessages);
    console.log(
      `[Story Orchestrator] Queued ${storyData.scenes.length} ${queueType} generation jobs (Priority: ${priority})`
    );
  } else {
    console.log("[Story Orchestrator] Visual generation skipped (pipeline config: visuals disabled)");
  }

  if (shouldQueueImages && shouldQueueVideos && videoTrigger === 'auto') {
    console.log(`[Story Orchestrator] Videos will be queued after image completion (trigger: auto)`);
  } else if (shouldQueueImages && shouldQueueVideos && videoTrigger === 'manual') {
    console.log(`[Story Orchestrator] Videos will be queued after user triggers with storyId (trigger: manual)`);
  } else if (shouldQueueVideos && !shouldQueueImages) {
    console.log(`[Story Orchestrator] Template uses direct text-to-video`);
  } else if (videoTrigger === 'post-action') {
    console.log(`[Story Orchestrator] Videos generated via post-actions (trigger: post-action)`);
  }

  // Queue audio generation jobs
  if (shouldQueueAudio && enableVoiceOver) {
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
      templateConfig,
    }));

    await sendQueueBatch(env.STORY_QUEUE, audioMessages);
    console.log(
      `[Story Orchestrator] Queued ${storyData.scenes.length} audio generation jobs (Priority: ${priority})`
    );
  } else if (!shouldQueueAudio) {
    console.log(`[Story Orchestrator] Audio generation skipped (pipeline config: audio disabled)`);
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
