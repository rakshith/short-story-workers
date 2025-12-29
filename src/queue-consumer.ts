// Queue consumer worker for processing story generation jobs

import { Env, QueueMessage } from './types/env';
import { processSceneImage, processSceneAudio, processSceneVideo } from './services/queue-processor';
import { queueLogger } from './utils/logger';
import { sortMessagesByPriority, canProcessJob } from './services/concurrency-manager';
import { trackWorkerInvocation } from './services/usage-tracking';

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

  for (const message of sortedMessages) {
    try {
      const data: QueueMessage = message.body;
      
      // Check concurrency limits for cost control
      const concurrencyCheck = await canProcessJob(data.userId, data.userTier, env);
      
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

      // Track worker invocation cost
      await trackWorkerInvocation(data.jobId, data.userId, data.storyId, env);
      
      const coordinator = getCoordinator(data.storyId);

      if (data.type === 'image') {
        // Generate the image
        const result = await processSceneImage(data, env);
        queueLogger.info(`Image result for scene ${data.sceneIndex}`, { sceneIndex: data.sceneIndex, success: result.success, imageUrl: result.imageUrl });

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

        message.ack();
      } else if (data.type === 'video') {
        // Generate the video
        const result = await processSceneVideo(data, env);
        queueLogger.info(`Video result for scene ${data.sceneIndex}`, { sceneIndex: data.sceneIndex, success: result.success, videoUrl: result.videoUrl });

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

        message.ack();
      }
    } catch (error) {
      queueLogger.error('Error processing queue message', error);

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const data: QueueMessage = message.body;
        await supabase
          .from('story_jobs')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('job_id', data.jobId);
      } catch (dbError) {
        console.error('[Queue] Failed to update error status in DB:', dbError);
      }

      message.retry();
    }
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

    if (currentStory?.story && finalData.scenes) {
      const updatedStory = { ...currentStory.story };
      // Merge each scene's generated content
      finalData.scenes.forEach((scene: any, idx: number) => {
        if (updatedStory.scenes[idx]) {
          updatedStory.scenes[idx] = {
            ...updatedStory.scenes[idx],
            ...scene,
          };
        }
      });

      // Single DB write with all updates
      await supabase
        .from('stories')
        .update({ story: updatedStory, status: 'draft', updated_at: new Date().toISOString() })
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
  } catch (error) {
    queueLogger.error('Error syncing to Supabase', error, { jobId: data.jobId });
    throw error; // Re-throw to be caught by the main queue catch block
  }
}
