// Execution Worker - processes individual scene tasks from queue
// When USE_DAG_ENGINE=true, the queue consumer uses this to process scene-level tasks
// with DAG-aware progress tracking and partial sync.

import { createDAGExecutor } from '../workflow/dagExecutor';

export interface ExecutionWorkerOptions {
  env: any;
}

export class ExecutionWorker {
  private env: any;

  constructor(options: ExecutionWorkerOptions) {
    this.env = options.env;
  }

  /**
   * Process a single queue message (image/video/audio scene task).
   * Uses the legacy scene processors for actual generation but adds
   * DAG-aware progress sync via DAGExecutor.onNodeComplete/onJobComplete.
   */
  async processMessage(message: any): Promise<void> {
    const { processSceneImage, processSceneAudio, processSceneVideo } = await import('../../services/queue-processor');

    const getCoordinator = (storyId: string) => {
      const id = this.env.STORY_COORDINATOR.idFromName(storyId);
      return this.env.STORY_COORDINATOR.get(id);
    };

    const coordinator = getCoordinator(message.storyId);

    const dagExecutor = createDAGExecutor({
      env: this.env,
      message: {
        jobId: message.jobId,
        storyId: message.storyId,
        userId: message.userId,
        templateId: message.videoConfig?.templateId || '',
        videoConfig: message.videoConfig,
        seriesId: message.seriesId,
        title: message.title,
        baseUrl: message.baseUrl,
        teamId: message.teamId,
        userTier: message.userTier,
        priority: message.priority,
      },
    });

    if (message.type === 'image') {
      const result = await processSceneImage(message, this.env);
      console.log(`[ExecutionWorker] Image result for scene ${message.sceneIndex}`, { success: result.success, imageUrl: result.imageUrl });

      // Only update DO when we have a URL or an error
      // When imageUrl is null (async Replicate), the webhook handles it
      if (result.imageUrl != null || result.error != null) {
        const updateRes = await coordinator.fetch(new Request('http://do/updateImage', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: message.sceneIndex,
            imageUrl: result.imageUrl,
            imageError: result.success ? undefined : result.error,
          }),
        }));
        const status = await updateRes.json() as any;

        // DAG-aware sync
        if (status.isComplete) {
          await this.finalizeJob(coordinator, dagExecutor);
        } else if (result.imageUrl) {
          await this.syncPartialProgress(coordinator, dagExecutor, status);
        }
      }
    } else if (message.type === 'video') {
      const result = await processSceneVideo(message, this.env);
      console.log(`[ExecutionWorker] Video result for scene ${message.sceneIndex}`, { success: result.success, videoUrl: result.videoUrl });

      if (result.videoUrl != null || result.error != null) {
        const updateRes = await coordinator.fetch(new Request('http://do/updateVideo', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: message.sceneIndex,
            videoUrl: result.videoUrl,
            videoError: result.success ? undefined : result.error,
          }),
        }));
        const status = await updateRes.json() as any;

        if (status.isComplete) {
          await this.finalizeJob(coordinator, dagExecutor);
        }
      }
    } else if (message.type === 'audio') {
      const result = await processSceneAudio(message, this.env);
      console.log(`[ExecutionWorker] Audio result for scene ${message.sceneIndex}`, { success: result.success, audioUrl: result.audioUrl });

      const updateRes = await coordinator.fetch(new Request('http://do/updateAudio', {
        method: 'POST',
        body: JSON.stringify({
          sceneIndex: message.sceneIndex,
          audioUrl: result.audioUrl,
          audioDuration: result.audioDuration,
          captions: result.captions,
          audioError: result.success ? undefined : result.error,
        }),
      }));
      const status = await updateRes.json() as any;

      if (status.isComplete) {
        if (message.videoConfig?.sceneReviewRequired) {
          await this.transitionToReview(message, coordinator, dagExecutor, status);
        } else {
          await this.finalizeJob(coordinator, dagExecutor);
        }
      } else {
        await this.syncPartialProgress(coordinator, dagExecutor, status);
      }
    }
  }

  /**
   * Finalize a completed job via DO finalize + DAG sync
   */
  private async finalizeJob(coordinator: any, dagExecutor: ReturnType<typeof createDAGExecutor>): Promise<void> {
    const finalRes = await coordinator.fetch(new Request('http://do/finalize', { method: 'POST' }));
    const finalData = await finalRes.json() as any;

    if (finalData.isComplete && finalData.scenes) {
      await dagExecutor.onJobComplete(
        { title: finalData.title, scenes: finalData.scenes },
        finalData.timeline
      );
    }
  }

  /**
   * Sync partial progress from DO to DB via DAG executor
   */
  private async syncPartialProgress(coordinator: any, dagExecutor: ReturnType<typeof createDAGExecutor>, status: any): Promise<void> {
    const progressRes = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
    const progressData = await progressRes.json() as any;

    if (progressData.scenes) {
      await dagExecutor.onNodeComplete(progressData.scenes, {
        imagesCompleted: status.imagesCompleted || 0,
        audioCompleted: status.audioCompleted || 0,
        videosCompleted: status.videosCompleted || 0,
        totalScenes: status.totalScenes || 1,
      });
    }
  }

  /**
   * Transition to review mode when images + audio complete in sceneReviewRequired mode
   */
  private async transitionToReview(message: any, coordinator: any, dagExecutor: ReturnType<typeof createDAGExecutor>, status: any): Promise<void> {
    console.log(`[ExecutionWorker] Transitioning to awaiting_review for story ${message.storyId}`);

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

    await supabase
      .from('stories')
      .update({
        scene_review_required: true,
        video_generation_triggered: false,
        status: 'awaiting_review',
      })
      .eq('id', message.storyId);

    // Sync current state to DB without finalizing
    await this.syncPartialProgress(coordinator, dagExecutor, status);

    await supabase
      .from('story_jobs')
      .update({
        status: 'awaiting_review',
        progress: 50,
        images_generated: status.imagesCompleted,
        audio_generated: status.audioCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', message.jobId);
  }
}

export function createExecutionWorker(options: ExecutionWorkerOptions): ExecutionWorker {
  return new ExecutionWorker(options);
}

/**
 * DAG-aware queue consumer - processes scene tasks with DAG sync
 */
export async function handleQueueDAG(batch: any, env: any): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { canProcessJob, sortMessagesByPriority } = await import('../../services/concurrency-manager');

  const sortedMessages = sortMessagesByPriority(batch.messages);
  console.log(`[handleQueueDAG] Processing batch of ${sortedMessages.length} messages`);

  const cancelledJobs = new Set<string>();
  const activeJobs = new Set<string>();
  const worker = new ExecutionWorker({ env });

  for (const message of sortedMessages) {
    try {
      const data = message.body as any;

      // Quick cancellation check
      if (cancelledJobs.has(data.jobId)) {
        (message as any).ack();
        continue;
      }

      // Check job status once per job in this batch
      if (!activeJobs.has(data.jobId)) {
        const { data: job } = await supabase
          .from('story_jobs')
          .select('status')
          .eq('job_id', data.jobId)
          .single();

        if (job && job.status !== 'processing' && job.status !== 'pending') {
          cancelledJobs.add(data.jobId);
          (message as any).ack();
          continue;
        }
        activeJobs.add(data.jobId);
      }

      // Concurrency check
      const concurrencyCheck = await canProcessJob(data.userId, data.userTier, env, data.jobId);
      if (!concurrencyCheck.allowed) {
        console.warn(`[handleQueueDAG] Concurrency limit reached for user ${data.userId}`);
        (message as any).retry();
        continue;
      }

      console.log(`[handleQueueDAG] Processing ${data.type} for job ${data.jobId}, scene ${data.sceneIndex}`);
      await worker.processMessage(data);
      (message as any).ack();
    } catch (error) {
      console.error('[handleQueueDAG] Error processing message:', error);
      // Retry on error to prevent data loss, with exponential backoff handled by queue
      (message as any).retry();
    }
  }
}
