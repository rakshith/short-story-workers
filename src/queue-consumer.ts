// Queue consumer worker for processing story generation jobs

import { Env, QueueMessage, WebhookQueueMessage } from './types/env';
import { processSceneImage, processSceneAudio, processSceneVideo } from './services/queue-processor';
import { processWebhookInBackground } from './services/webhook-handler';
import { queueLogger } from './utils/logger';
import { sortMessagesByPriority, canProcessJob } from './services/concurrency-manager';
import { sendStoryCompletionEmail } from './services/email-service';
import { trackWorkerCpuTime } from './services/usage-tracking';

/**
 * Queue consumer handler - Uses Durable Objects for race-condition-free updates
 * Implements tier-based concurrency control and priority processing
 */
export async function handleQueue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  // Helper to get Durable Object stub for a story
  const getCoordinator = (storyId: string) => {
    const id = env.STORY_COORDINATOR.idFromName(storyId);
    return env.STORY_COORDINATOR.get(id);
  };

  // Sort messages by priority - high-tier users processed first for better experience
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
          const updateRes = await coordinator.fetch(new Request('http://do/updateImage', {
            method: 'POST',
            body: JSON.stringify({
              sceneIndex: data.sceneIndex,
              imageUrl: result.imageUrl,
              imageError: result.success ? undefined : result.error,
            }),
          }));
          const status = await updateRes.json() as any;
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
          const updateRes = await coordinator.fetch(new Request('http://do/updateVideo', {
            method: 'POST',
            body: JSON.stringify({
              sceneIndex: data.sceneIndex,
              videoUrl: result.videoUrl,
              videoError: result.success ? undefined : result.error,
            }),
          }));
          const status = await updateRes.json() as any;
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

        // Update via Durable Object (no race condition)
        const updateRes = await coordinator.fetch(new Request('http://do/updateAudio', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: data.sceneIndex,
            audioUrl: result.audioUrl,
            audioDuration: result.audioDuration,
            captions: result.captions,
            audioError: result.success ? undefined : result.error,
          }),
        }));

        const status = await updateRes.json() as any;
        if (status.isComplete) {
          await syncStoryToSupabase({
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

      // Mark the scene as failed and continue - user can retry from UI
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
    let updateRes: Response;

    switch (data.type) {
      case 'image':
        updateRes = await coordinator.fetch(new Request('http://do/updateImage', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: data.sceneIndex,
            imageUrl: null,
            imageError: errorMessage,
          }),
        }));
        break;

      case 'video':
        updateRes = await coordinator.fetch(new Request('http://do/updateVideo', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: data.sceneIndex,
            videoUrl: null,
            videoError: errorMessage,
          }),
        }));
        break;

      case 'audio':
        updateRes = await coordinator.fetch(new Request('http://do/updateAudio', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: data.sceneIndex,
            audioUrl: null,
            audioDuration: 0,
            captions: [],
            audioError: errorMessage,
          }),
        }));
        break;

      default:
        queueLogger.warn(`Unknown message type: ${data.type}`);
        return;
    }

    const status = await updateRes.json() as any;

    // If all scenes are now complete, sync to database
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
    const finalRes = await coordinator.fetch(new Request('http://do/finalize', { method: 'POST' }));
    const finalData = await finalRes.json() as any;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Get current story and merge with Durable Object state
    const { data: currentStory } = await supabase
      .from('stories')
      .select('story')
      .eq('id', data.storyId)
      .single();

    let updatedStory: any = null;

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

      // Single DB write with all updates (story + timeline)
      await supabase
        .from('stories')
        .update({
          story: updatedStory,
          timeline: finalData.timeline || null,
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.storyId);
    }

    // Mark job complete (Progress 4/4: 100%)
    await supabase
      .from('story_jobs')
      .update({
        status: 'completed',
        progress: 100,
        images_generated: finalData.imagesCompleted,
        audio_generated: finalData.audioCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', data.jobId);

    queueLogger.info(`Story synced to database`, { jobId: data.jobId, storyId: data.storyId });

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
 * Webhook queue consumer - processes Replicate webhook payloads (R2 upload, DO update, sync).
 * Durable so work is not lost to Worker eviction; retries on failure.
 */
export async function handleWebhookQueue(batch: MessageBatch<WebhookQueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { prediction, metadata } = message.body;
      await processWebhookInBackground(prediction as any, metadata, env);
      message.ack();
    } catch (error) {
      queueLogger.error('Webhook queue processing error', error, { storyId: message.body.metadata?.storyId, sceneIndex: message.body.metadata?.sceneIndex });
      message.retry();
    }
  }
}
