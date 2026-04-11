// Queue consumer worker for processing story generation jobs

import { Env, QueueMessage, WebhookQueueMessage } from './types/env';
import { processSceneImage, processSceneAudio, processSceneVideo } from './services/queue-processor';
import { processWebhookInBackground } from './services/webhook-handler';
import { queueLogger } from './utils/logger';
import { sortMessagesByPriority, canProcessJob } from './services/concurrency-manager';
import { updateCoordinatorImage, updateCoordinatorVideo, updateCoordinatorAudio, getCoordinatorProgress, finalizeCoordinator } from './utils/coordinator';
import { sendStoryCompletionEmail } from './services/email-service';
import { trackWorkerCpuTime } from './services/usage-tracking';
import { calcVideoDelaySeconds } from './utils/queue-batch';
import { getTemplateConfig } from './config/template-config';

/**
 * Dead-letter queue handler - Logs and acks messages that exhausted retries or were sent for audit.
 * Extend here to alert, update job status, or re-enqueue to main queue.
 */
export async function handleDlqQueue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const data: QueueMessage = message.body;
    queueLogger.info('[DLQ] Processing dead-letter message', {
      jobId: data.jobId,
      storyId: data.storyId,
      type: data.type,
      sceneIndex: data.sceneIndex,
      userId: data.userId,
    });
    message.ack();
  }
}

/**
 * Queue consumer handler - Uses Durable Objects for race-condition-free updates
 * Implements tier-based concurrency control and priority processing
 */
export async function handleQueue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  queueLogger.info(`[Queue] Batch received from ${batch.queue}`, { messageCount: batch.messages.length });

  // Helper to get Durable Object stub for a story
  const getCoordinator = (storyId: string) => {
    const id = env.STORY_COORDINATOR.idFromName(storyId);
    return env.STORY_COORDINATOR.get(id);
  };

  // Sort messages by priority - high-tier users processed first for better UX
  const sortedMessages = sortMessagesByPriority(batch.messages);
  queueLogger.info(`Processing batch of ${sortedMessages.length} messages (sorted by priority)`);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Cache for job cancellation status to avoid redundant DB checks
  const cancelledJobs = new Set<string>();
  const activeJobs = new Set<string>();

  for (const message of sortedMessages) {
    try {
      const data: QueueMessage = message.body;

      // Quick cancellation check
      if (cancelledJobs.has(data.jobId)) {
        queueLogger.info(`Skipping message for cancelled job ${data.jobId}`, { jobId: data.jobId, type: data.type });
        message.ack();
        continue;
      }

      // If we don't know the status, check the DB (but only once per job in this batch)
      if (!activeJobs.has(data.jobId)) {
        const { data: job, error: jobError } = await supabase
          .from('story_jobs')
          .select('status')
          .eq('job_id', data.jobId)
          .single();

        if (job && job.status !== 'processing' && job.status !== 'pending') {
          queueLogger.info(`Job ${data.jobId} is in terminal state (${job.status}), skipping and caching status`, { jobId: data.jobId });
          cancelledJobs.add(data.jobId);
          message.ack();
          continue;
        }
        activeJobs.add(data.jobId);
      }

      // Check concurrency limits for cost control (allow messages for jobs already in progress)
      const concurrencyCheck = await canProcessJob(data.userId, data.userTier, env, data.jobId);

      if (!concurrencyCheck.allowed) {
        queueLogger.warn(
          `Concurrency limit reached for user ${data.userId}`,
          {
            userId: data.userId,
            tier: data.userTier,
            activeConcurrency: concurrencyCheck.activeConcurrency,
            maxConcurrency: concurrencyCheck.maxConcurrency,
          }
        );
        // Retry later when concurrency is available
        message.retry();
        continue;
      }

      queueLogger.info(
        `Processing ${data.type} for job ${data.jobId} (Tier: ${data.userTier}, Priority: ${data.priority})`,
        {
          jobId: data.jobId,
          type: data.type,
          sceneIndex: data.sceneIndex,
          tier: data.userTier,
          priority: data.priority,
          activeConcurrency: concurrencyCheck.activeConcurrency,
          maxConcurrency: concurrencyCheck.maxConcurrency,
        }
      );

      const coordinator = getCoordinator(data.storyId);
      const startTime = Date.now();

      if (data.type === 'image') {
        // Generate the image (async: triggers Replicate, webhook will update DO with URL)
        const result = await processSceneImage(data, env);
        queueLogger.info(`Image result for scene ${data.sceneIndex}`, { sceneIndex: data.sceneIndex, success: result.success, imageUrl: result.imageUrl });

        // Only update DO when we have a URL or an error. When imageUrl is null (async Replicate),
        // the webhook will update the DO—avoid double update and "total: 0/3" from worker.
        if (result.imageUrl != null || result.error != null) {
          const status = await updateCoordinatorImage(coordinator, {
            sceneIndex: data.sceneIndex,
            imageUrl: result.imageUrl,
            imageError: result.success ? undefined : result.error,
          });
          if (status.isComplete) {
            await syncStoryToSupabase({
              jobId: data.jobId,
              storyId: data.storyId,
              userId: data.userId
            }, coordinator, env);
          }
        }

        await trackWorkerCpuTime(data.jobId, data.userId, data.storyId, Date.now() - startTime, data.sceneIndex, 'image', env);
        message.ack();
      } else if (data.type === 'video') {
        // Generate the video (async: triggers Replicate, webhook will update DO with URL)
        const result = await processSceneVideo(data, env);
        queueLogger.info(`Video result for scene ${data.sceneIndex}`, { sceneIndex: data.sceneIndex, success: result.success, videoUrl: result.videoUrl });

        // Only update DO when we have a URL or an error. When videoUrl is null (async Replicate),
        // the webhook will update the DO—avoid double update and conflict with webhook.
        if (result.videoUrl != null || result.error != null) {
          const status = await updateCoordinatorVideo(coordinator, {
            sceneIndex: data.sceneIndex,
            videoUrl: result.videoUrl,
            videoError: result.success ? undefined : result.error,
          });
          if (status.isComplete) {
            await syncStoryToSupabase({
              jobId: data.jobId,
              storyId: data.storyId,
              userId: data.userId
            }, coordinator, env);
          }
        }

        await trackWorkerCpuTime(data.jobId, data.userId, data.storyId, Date.now() - startTime, data.sceneIndex, 'video', env);
        message.ack();
      } else if (data.type === 'audio') {
        // Generate the audio
        const result = await processSceneAudio(data, env);
        queueLogger.info(`Audio result for scene ${data.sceneIndex}`, { sceneIndex: data.sceneIndex, success: result.success, audioUrl: result.audioUrl });

        const status = await updateCoordinatorAudio(coordinator, {
          sceneIndex: data.sceneIndex,
          audioUrl: result.audioUrl,
          audioDuration: result.audioDuration,
          captions: result.captions,
          audioError: result.success ? undefined : result.error,
        });

        // Gate: if audio arrived second (image was already done), queue video now with real duration
        if (
          result.success &&
          status.isSceneReadyForVideo &&
          status.sceneImageUrl &&
          data.videoConfig?.mediaType === 'video' &&
          !data.videoConfig?.sceneReviewRequired
        ) {
          const videoQueueMessage = {
            jobId: data.jobId,
            userId: data.userId,
            seriesId: data.seriesId,
            storyId: data.storyId,
            title: data.title || '',
            videoConfig: data.videoConfig,
            sceneIndex: data.sceneIndex,
            type: 'video' as const,
            baseUrl: data.baseUrl,
            teamId: data.teamId,
            userTier: data.userTier,
            priority: 3,
            generatedImageUrl: status.sceneImageUrl,
            templateConfig: getTemplateConfig(data.videoConfig?.templateId),
            sceneDuration: result.audioDuration > 0 ? result.audioDuration : undefined,
          };
          await env.STORY_QUEUE.send(videoQueueMessage, {
            delaySeconds: calcVideoDelaySeconds(data.sceneIndex, status.totalScenes ?? 1),
          });
          queueLogger.info(`Queued video for scene ${data.sceneIndex} after audio completion (audioDuration: ${result.audioDuration}s)`, {
            sceneIndex: data.sceneIndex,
            audioDuration: result.audioDuration,
          });
        }

        if (status.isComplete) {
          if (data.videoConfig?.sceneReviewRequired) {
            // Audio completed last in review mode - transition to awaiting_review
            // (completionSignaled ensures this fires exactly once - mutually exclusive with image webhook path)
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            await supabase
              .from('stories')
              .update({
                scene_review_required: true,
                video_generation_triggered: false,
                status: 'awaiting_review'
              })
              .eq('id', data.storyId);
            const { syncStoryForReview } = await import('./services/webhook-handler');
            await syncStoryForReview({
              jobId: data.jobId,
              storyId: data.storyId,
              userId: data.userId
            }, coordinator, env);
          } else {
            // auto mode: all videos+audio done - finalize and send email
            await syncStoryToSupabase({
              jobId: data.jobId,
              storyId: data.storyId,
              userId: data.userId
            }, coordinator, env);
          }
        } else {
          // Incrementally sync audio to DB so it's not lost if job fails before videos complete
          await syncPartialStory({
            jobId: data.jobId,
            storyId: data.storyId,
            userId: data.userId
          }, coordinator, env);
        }

        await trackWorkerCpuTime(data.jobId, data.userId, data.storyId, Date.now() - startTime, data.sceneIndex, 'audio', env);
        message.ack();
      }
    } catch (error) {
      queueLogger.error('Error processing queue message', error);

      const data: QueueMessage = message.body;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (env.STORY_DLQ) {
        try {
          await env.STORY_DLQ.send(data);
        } catch (dlqErr) {
          queueLogger.error('[Queue] Failed to send to DLQ', dlqErr, { jobId: data.jobId });
        }
      }

      await markSceneAsFailed(data, errorMessage, getCoordinator, env);

      message.ack();
    }
  }
}

/**
 * Mark a scene as failed in the Durable Object so the job can complete with partial failures.
 * Failed scenes are stored in the database and can be retried by the user from the UI.
 */
async function markSceneAsFailed(
  data: QueueMessage,
  errorMessage: string,
  getCoordinator: (storyId: string) => any,
  env: Env
): Promise<void> {
  try {
    const coordinator = getCoordinator(data.storyId);
    let status: Awaited<ReturnType<typeof updateCoordinatorImage>>;

    switch (data.type) {
      case 'image':
        status = await updateCoordinatorImage(coordinator, { sceneIndex: data.sceneIndex, imageUrl: null, imageError: errorMessage });
        break;
      case 'video':
        status = await updateCoordinatorVideo(coordinator, { sceneIndex: data.sceneIndex, videoUrl: null, videoError: errorMessage });
        break;
      case 'audio':
        status = await updateCoordinatorAudio(coordinator, { sceneIndex: data.sceneIndex, audioUrl: null, audioDuration: 0, captions: [], audioError: errorMessage });
        break;
      default:
        queueLogger.warn(`Unknown message type: ${data.type}`);
        return;
    }

    if (status.isComplete) {
      const { syncStoryToSupabase } = await import('./queue-consumer');
      await syncStoryToSupabase({
        jobId: data.jobId,
        storyId: data.storyId,
        userId: data.userId
      }, coordinator, env);
    }

    queueLogger.info(`Scene ${data.sceneIndex} marked as failed, moving on`, {
      sceneIndex: data.sceneIndex,
      type: data.type,
      error: errorMessage
    });
  } catch (updateError) {
    console.error('[Queue] Failed to mark scene as failed:', updateError);
  }
}

/**
 * Finalize story and sync all generated content from Durable Object to Supabase
 */
export async function syncStoryToSupabase(
  data: { jobId: string; storyId: string; userId: string },
  coordinator: any,
  env: Env
): Promise<void> {
  queueLogger.info(`All scenes complete, syncing to database`, { jobId: data.jobId });

  try {
    const finalData = await finalizeCoordinator(coordinator);

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Get current story and merge with Durable Object state (do NOT update video_config here)
    const { data: currentStory } = await supabase
      .from('stories')
      .select('story')
      .eq('id', data.storyId)
      .single();

    let updatedStory: any = null;

    // Check if any scenes have errors (outside the if block so available for job update)
    const hasErrors = finalData.scenes?.some((scene: any) => 
      scene.generationError || scene.videoGenerationError || scene.audioGenerationError
    );

    // Set job status: 'failed' if errors, 'completed' if clean
    const jobStatus = hasErrors ? 'failed' : 'completed';
    const jobProgress = hasErrors ? 95 : 100;

    // Collect error messages for user-friendly display
    const errorDetails: string[] = [];
    finalData.scenes?.forEach((scene: any, idx: number) => {
      if (scene.generationError) {
        errorDetails.push(`Scene ${idx + 1} image: ${scene.generationError}`);
      }
      if (scene.videoGenerationError) {
        errorDetails.push(`Scene ${idx + 1} video: ${scene.videoGenerationError}`);
      }
      if (scene.audioGenerationError) {
        errorDetails.push(`Scene ${idx + 1} audio: ${scene.audioGenerationError}`);
      }
    });
    const errorMessage = hasErrors ? errorDetails.join('; ') : null;

    if (currentStory?.story && finalData.scenes) {
      updatedStory = { ...currentStory.story };
      // Merge each scene's generated content
      finalData.scenes.forEach((scene: any, idx: number) => {
        if (updatedStory.scenes[idx]) {
          updatedStory.scenes[idx] = {
            ...updatedStory.scenes[idx],
            ...scene,
          };
        }
      });

      // Update story with appropriate status (failed if errors, draft if clean)
      await supabase
        .from('stories')
        .update({
          story: updatedStory,
          timeline: finalData.timeline || null,
          status: hasErrors ? 'failed' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.storyId);
    }

    // Mark job with appropriate status (failed if errors, completed if clean)
    const jobUpdate: any = {
      status: jobStatus,
      progress: jobProgress,
      images_generated: finalData.imagesCompleted,
      audio_generated: finalData.audioCompleted,
      updated_at: new Date().toISOString(),
    };
    
    // Add error message if there are failures
    if (errorMessage) {
      jobUpdate.error = errorMessage;
    }
    
    await supabase
      .from('story_jobs')
      .update(jobUpdate)
      .eq('job_id', data.jobId);

    queueLogger.info(`Story synced to database`, { jobId: data.jobId, storyId: data.storyId });

    // Broadcast completion to SSE clients via DO (BEFORE sending email)
    try {
      const broadcastData = {
        type: 'story_completed',
        storyId: data.storyId,
        jobId: data.jobId,
        status: jobStatus,
        progress: jobProgress,
        title: updatedStory?.title || 'Your Story',
      };
      
      // Call broadcast endpoint on Cloudflare worker (NOT NextJS)
      // Use the correct worker URL based on environment
      const isStaging = env.ENVIRONMENT === 'staging' || !env.ENVIRONMENT;
      const workerUrl = isStaging 
        ? 'https://create-story-worker-staging.matrixrak.workers.dev'
        : 'https://create-story-worker-production.matrixrak.workers.dev';
      
      const response = await fetch(`${workerUrl}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: data.storyId, data: broadcastData }),
      });
      
      if (response.ok) {
        queueLogger.info(`[SSE] Broadcasted completion for story: ${data.storyId}`);
      } else {
        const errorText = await response.text();
        queueLogger.error(`[SSE] Failed to broadcast: ${response.status} - ${errorText}`, { storyId: data.storyId });
      }
    } catch (sseError) {
      queueLogger.error('[SSE] Error broadcasting:', sseError, { storyId: data.storyId });
      // Don't fail the job if SSE fails - continue with email
    }

    // Send completion email notification
    try {
      // Fetch user profile for email and name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', data.userId)
        .single();

      if (profileError) {
        queueLogger.error('Failed to fetch user profile for email notification', profileError, { userId: data.userId });
      } else if (profile?.email) {
        // Thumbnail URL - use the first scene image that exists
        let thumbnailUrl = 'https://artflicks.app/short-stories'; // Fallback

        if (updatedStory && updatedStory.scenes && updatedStory.scenes.length > 0) {
          const firstScene = updatedStory.scenes.find((s: any) => s.imageUrl);
          if (firstScene) {
            thumbnailUrl = firstScene.imageUrl;
          }
        }

        await sendStoryCompletionEmail(profile.email, {
          DISPLAY_NAME: profile.display_name || 'there',
          STORY_TITLE: updatedStory?.title || 'Your Story',
          STORY_URL: `https://artflicks.app/short-stories`,
          THUMBNAIL_URL: thumbnailUrl
        });

        queueLogger.info(`Completion email notification sent to ${profile.email}`, { jobId: data.jobId });
      } else {
        queueLogger.warn('No email found for user, skipping notification', { userId: data.userId });
      }
    } catch (emailError) {
      // Don't fail the whole sync if email fails
      queueLogger.error('Failed to send completion email', emailError, { jobId: data.jobId });
    }
  } catch (error) {
    queueLogger.error('Error syncing to Supabase', error, { jobId: data.jobId });
    throw error; // Re-throw to be caught by the main queue catch block
  }
}

/**
 * Incrementally sync partial story progress to database (images/audio) without finalizing.
 * Called after each image/audio completion for sceneReviewRequired=false flow.
 * Keeps status as 'processing' and saves generated URLs to DB so they are not lost if job fails.
 */
export async function syncPartialStory(
  data: { jobId: string; storyId: string; userId: string },
  coordinator: any,
  env: Env
): Promise<void> {
  try {
    const progressData = await getCoordinatorProgress(coordinator);

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Get current story and merge generated content from DO
    const { data: currentStory } = await supabase
      .from('stories')
      .select('story')
      .eq('id', data.storyId)
      .single();

    if (currentStory?.story && progressData.scenes) {
      const updatedStory = { ...currentStory.story };
      progressData.scenes.forEach((scene: any, idx: number) => {
        if (updatedStory.scenes[idx]) {
          updatedStory.scenes[idx] = {
            ...updatedStory.scenes[idx],
            ...scene,
          };
        }
      });

      await supabase
        .from('stories')
        .update({
          story: updatedStory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.storyId);
    }

    const totalScenes = progressData.totalScenes || 1;
    const voiceOverEnabled = progressData.videoConfig?.enableVoiceOver !== false;
    const denominator = voiceOverEnabled ? totalScenes * 2 : totalScenes;
    const useVideoProgress = progressData.videoConfig?.mediaType === 'video';
    const numerator = useVideoProgress
      ? (progressData.videosCompleted || 0) + (voiceOverEnabled ? (progressData.audioCompleted || 0) : 0)
      : (progressData.imagesCompleted || 0) + (voiceOverEnabled ? (progressData.audioCompleted || 0) : 0);
    const progress = Math.min(Math.round((numerator / denominator) * 75), 75);

    await supabase
      .from('story_jobs')
      .update({
        status: 'processing',
        progress,
        images_generated: progressData.imagesCompleted || 0,
        audio_generated: progressData.audioCompleted || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', data.jobId);

    queueLogger.info(`Partial story synced to database`, { jobId: data.jobId, storyId: data.storyId, progress, imagesCompleted: progressData.imagesCompleted, audioCompleted: progressData.audioCompleted });
  } catch (error) {
    // Don't throw - partial sync failure should not block generation
    queueLogger.error('Error in partial story sync (non-fatal)', error, { jobId: data.jobId });
  }
}

/**
 * Webhook queue consumer - processes Replicate webhook payloads (R2 upload, DO update, sync).
 * Durable so work is not lost to Worker eviction; retries on failure.
 */
export async function handleWebhookQueue(batch: MessageBatch<WebhookQueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { prediction, metadata, origin } = message.body;
      queueLogger.info(`Processing webhook queue for ${metadata.type} - storyId: ${metadata.storyId}, sceneIndex: ${metadata.sceneIndex}`);
      await processWebhookInBackground(prediction as any, metadata, env, origin);
      queueLogger.info(`Completed webhook queue for ${metadata.type} - storyId: ${metadata.storyId}, sceneIndex: ${metadata.sceneIndex}`);
      message.ack();
    } catch (error) {
      queueLogger.error('Webhook queue processing error', error, { storyId: message.body.metadata?.storyId, sceneIndex: message.body.metadata?.sceneIndex });
      message.retry();
    }
  }
}
