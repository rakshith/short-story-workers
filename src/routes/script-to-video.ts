// Script-to-Video endpoint handler - Parse user script with hints, generate full story

import { Env } from "../types/env";
import { StoryTimeline, VideoConfig } from "../types";
import { generateUUID } from "../utils/storage";
import { updateJobStatus } from "../services/queue-processor";
import { jsonResponse } from "../utils/response";
import {
  parseTier,
  getPriorityForTier,
  getConcurrencyForTier,
} from "../config/tier-config";
import {
  orchestrateStoryCreation,
  orchestrateVideoResume,
} from "../services/story-orchestrator";
import { estimateDurationFromText } from "../services/script-parser";
import { generateScriptFromText } from "../services/script-generation";

interface ScriptToVideoRequest {
  prompt: string; // User's script text (can be long)
  duration?: number; // Optional - will be estimated from text if not provided
  videoConfig: VideoConfig;
  userId: string;
  seriesId?: string;
  teamId?: string;
  language?: string;
  model?: string;
  title?: string;
  userTier?: string;
  storyId?: string; // Existing story ID to resume video generation
  baseUrl?: string; // Base URL for webhooks (optional - derived from request if not provided)
}

/**
 * POST /script-to-video
 * Parses user script text and creates a story with queued generation jobs
 * OR resumes video generation for an existing story with images
 */
export async function handleScriptToVideo(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);

  try {
    const body: ScriptToVideoRequest = await request.json();

    // Check if this is a resume request (storyId provided)
    if (body.storyId) {
      const baseUrl = url.origin;
      return handleResumeVideoGeneration(body, env, baseUrl);
    }

    // Validate required fields
    if (!body.prompt || !body.videoConfig || !body.userId) {
      return jsonResponse(
        { error: "Missing required fields: prompt, videoConfig, userId" },
        400,
      );
    }

    const userTier = parseTier(body.userTier || body.videoConfig?.userTier);
    const priority = getPriorityForTier(userTier, env);
    const maxConcurrency = getConcurrencyForTier(userTier, env);

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: activeJobs, error: checkError } = await supabase
      .from("story_jobs")
      .select("job_id")
      .eq("user_id", body.userId)
      .eq("status", "processing");

    if (checkError) {
      console.error(
        "[Script To Video] Failed to check concurrency:",
        checkError,
      );
    } else {
      const activeCount = activeJobs?.length || 0;
      if (activeCount >= maxConcurrency) {
        console.log(
          `[Script To Video] Concurrency limit reached for user ${body.userId} (${activeCount}/${maxConcurrency})`,
        );
        return jsonResponse(
          {
            error: "Concurrency limit reached",
            message: `You have ${activeCount} active story generations. Your tier (${userTier}) allows maximum ${maxConcurrency} concurrent jobs. Please wait for a job to complete.`,
            activeJobs: activeCount,
            maxConcurrency,
            tier: userTier,
          },
          429,
        );
      }
    }

    const jobId = generateUUID();
    console.log(
      `[Script To Video] Job ID: ${jobId}, User: ${body.userId} (Tier: ${userTier}, Active: ${activeJobs?.length || 0}/${maxConcurrency})`,
    );

    await updateJobStatus(
      jobId,
      {
        jobId,
        userId: body.userId,
        status: "processing",
        progress: 0,
        totalScenes: 0,
        imagesGenerated: 0,
        audioGenerated: 0,
        teamId: body.teamId,
      },
      env,
    );

    // Estimate duration from text if not provided
    const estimatedDuration =
      body.duration || estimateDurationFromText(body.prompt);
    console.log(
      `[Script To Video] Duration: ${estimatedDuration}s (provided: ${body.duration ? "yes" : "no"}, estimated: ${!body.duration ? "yes" : "no"})`,
    );

    let minSceneDuration = 3;
    let maxSceneDuration = 6;

    /// This particular can a add pacing(screenplay-speed) in the image or in the video type for final video
    if (body.videoConfig?.mediaType === "image") {
      minSceneDuration = 4;
      maxSceneDuration = 6;
    } else {
      const model = body.videoConfig?.model?.toLowerCase() || '';
      if (model.includes('veo')) {
        minSceneDuration = 4;
        maxSceneDuration = 8;
      } else {
        minSceneDuration = 5;
        maxSceneDuration = 8;
      }
    }

    // Generate script from text using AI
    const startTime = Date.now();
    const scriptResult = await generateScriptFromText(
      {
        scriptText: body.prompt,
        duration: estimatedDuration,
        language: body.language || body.videoConfig?.language || "en",
        mediaType: body.videoConfig?.mediaType || "image",
        minSceneDuration,
        maxSceneDuration,
      },
      env,
    );
    const durationSeconds = (Date.now() - startTime) / 1000;

    if (!scriptResult.success || !scriptResult.story) {
      console.error(
        "[Script To Video] Script generation failed:",
        scriptResult.error,
      );
      await updateJobStatus(
        jobId,
        {
          jobId,
          userId: body.userId,
          status: "failed",
          progress: 0,
          totalScenes: 0,
          imagesGenerated: 0,
          audioGenerated: 0,
          error: scriptResult.error || "Failed to generate script",
          teamId: body.teamId,
        },
        env,
      );
      return jsonResponse(
        { error: "Failed to generate script", details: scriptResult.error },
        500,
      );
    }

    const storyData = scriptResult.story;
    const usageData = scriptResult.usage;

    console.log(
      `[Script To Video] Script generated with ${storyData.scenes.length} scenes, total duration: ${storyData.totalDuration}s`,
    );

    // Update videoConfig with the prompt for persistence
    const videoConfigWithPrompt = {
      ...body.videoConfig,
      prompt: body.prompt,
      script: body.prompt,
    };

    // Use orchestrator for story creation
    const result = await orchestrateStoryCreation({
      jobId,
      userId: body.userId,
      storyData,
      videoConfig: videoConfigWithPrompt,
      baseUrl: url.origin,
      userTier,
      priority,
      seriesId: body.seriesId,
      teamId: body.teamId,
      title: body.title,
      usageData,
      durationSeconds,
      env,
    });

    if (!result.success) {
      const statusCode = result.error?.includes("already exists") ? 409 : 500;
      return jsonResponse(
        {
          error: result.error?.includes("already exists")
            ? "Duplicate story title"
            : "Failed to create story",
          message: result.error,
        },
        statusCode,
      );
    }

    return jsonResponse({
      success: true,
      jobId,
      message: "Story generation started",
      storyId: result.storyId,
      generatedScript: storyData,
      estimated_duration_seconds: storyData.totalDuration,
      totalScenes: storyData.scenes.length,
      cost: result.cost,
      creditsDeducted: result.creditsDeducted,
      creditError: result.creditError,
    });
  } catch (error) {
    console.error("[Script To Video] Error:", error);
    return jsonResponse(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

/**
 * Handles resuming video generation for an existing story with images
 * Called when user passes storyId to continue from image generation to video generation
 */
async function handleResumeVideoGeneration(
  body: ScriptToVideoRequest,
  env: Env,
  requestBaseUrl?: string,
): Promise<Response> {
  const { storyId, userId } = body;

  if (!storyId || !userId) {
    return jsonResponse(
      { error: "Missing required fields: storyId, userId" },
      400,
    );
  }

  console.log(`[Script To Video] Resume video generation for story ${storyId}`);

  const userTier = parseTier(body.userTier || body.videoConfig?.userTier);
  const priority = getPriorityForTier(userTier, env);
  const webhookBaseUrl =
    requestBaseUrl ||
    body.baseUrl ||
    "https://create-story-worker.artflicks.workers.dev";

  const result = await orchestrateVideoResume({
    storyId,
    userId,
    videoConfig: body.videoConfig,
    baseUrl: webhookBaseUrl,
    userTier,
    priority,
    teamId: body.teamId,
    title: body.title,
    env,
  });

  if (!result.success) {
    const statusCode = result.error?.includes("not found")
      ? 404
      : result.error?.includes("already been triggered")
        ? 400
        : result.error?.includes("No scenes have generated images")
          ? 400
          : result.error?.includes("invalid status")
            ? 400
            : 500;

    // Check if it's the "already have video" case which is actually success
    if (result.storyId && !result.error) {
      return jsonResponse({
        success: true,
        storyId: result.storyId,
        message:
          "All scenes already have video (including manually generated). Nothing to generate.",
      });
    }

    return jsonResponse({ error: result.error }, statusCode);
  }

  return jsonResponse({
    success: true,
    storyId: result.storyId,
    message: "Video generation started",
  });
}
