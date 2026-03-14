// Execution Worker - processes individual scene tasks from queue
// When USE_DAG_ENGINE=true, the queue consumer uses this to process scene-level tasks
// with DAG-aware progress tracking and partial sync.

import { createDAGExecutor } from '../workflow/dagExecutor';
import { createEventLogger } from '../storage/eventLogger';

export interface ExecutionWorkerOptions {
  env: any;
}

class ExecutionWorker {
  private env: any;
  private eventLogger: ReturnType<typeof createEventLogger> | null;

  constructor(options: ExecutionWorkerOptions) {
    this.env = options.env;
    
    if (this.env.SUPABASE_URL && this.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.eventLogger = createEventLogger({
        supabaseUrl: this.env.SUPABASE_URL as string,
        supabaseServiceKey: this.env.SUPABASE_SERVICE_ROLE_KEY as string,
      });
    } else {
      this.eventLogger = null;
    }
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
        storyData: message.storyData,
        seriesId: message.seriesId,
        title: message.title,
        baseUrl: message.baseUrl,
        teamId: message.teamId,
        userTier: message.userTier,
        priority: message.priority,
      },
    });

    // Handle script generation (first step in DAG)
    if (message.type === 'script' || message.dagCapability === 'script-generation') {
      console.log(`[ExecutionWorker] Processing script-generation for job ${message.jobId}`);
      
      this.eventLogger?.logScriptStarted(message.jobId, message.storyId, message.userId);
      
      // Generate script using the prompt from videoConfig
      const prompt = message.videoConfig?.prompt || message.storyData?.prompt || '';
      const duration = message.videoConfig?.duration || 15;
      const templateId = message.videoConfig?.templateId || '';
      const mediaType = message.videoConfig?.mediaType || 'image';
      
      try {
        let scriptResult: any;
        
        if (this.env.GEN_PROVIDER === 'mock') {
          const { createScriptService } = await import('../services/scriptService');
          const scriptService = createScriptService('mock-key', true);
          scriptResult = await scriptService.generate({
            prompt,
            templateId,
            videoConfig: message.videoConfig,
          });
        } else {
          const { generateScript } = await import('../../services/script-generation');
          scriptResult = await generateScript(
            {
              prompt,
              duration,
              language: (message.videoConfig?.language as string) || 'en',
              model: (message.videoConfig?.textModel as string) || 'gpt-5.2',
              templateId,
              mediaType: mediaType as 'image' | 'video',
            },
            this.env.OPENAI_API_KEY
          );
        }

        if (!scriptResult.success || !scriptResult.story) {
          const errMsg = scriptResult.error || 'Script generation failed';
          console.error('[ExecutionWorker] Script generation failed:', errMsg);
          await dagExecutor.onJobFailed(errMsg);
          throw new Error(errMsg);
        }

        const storyData = scriptResult.story;
        console.log(`[ExecutionWorker] Script generated with ${storyData.scenes?.length || 0} scenes`);

        // Update DAGExecutor's message with generated storyData for downstream nodes
        dagExecutor.updateMessage({ storyData });

        // Update DO with generated script
        const updateRes = await coordinator.fetch(new Request('http://do/updateScript', {
          method: 'POST',
          body: JSON.stringify({
            story: storyData,
            title: storyData.title,
          }),
        }));

        const updateResult = await updateRes.json();
        console.log('[ExecutionWorker] updateScript result:', updateResult);
        
        // Create story in DB
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);
        
        await supabase
          .from('stories')
          .update({
            story: storyData,
            title: storyData.title,
            status: 'processing',
          })
          .eq('id', message.storyId);

        // Update job with scene count
        await supabase
          .from('story_jobs')
          .update({
            status: 'processing',
            total_scenes: storyData.scenes?.length || 0,
          })
          .eq('job_id', message.jobId);

        // Log completion and continue DAG
        this.eventLogger?.logScriptCompleted(message.jobId, message.storyId, message.userId, storyData.scenes?.length || 0);
        
        // Continue DAG - signal script node complete
        await dagExecutor.onNodeComplete(
          storyData.scenes || [],
          {
            imagesCompleted: 0,
            audioCompleted: 0,
            videosCompleted: 0,
            totalScenes: storyData.scenes?.length || 0,
          },
          'script-generation'
        );

        console.log(`[ExecutionWorker] Script generation complete, DAG continuing`);
      } catch (error) {
        console.error('[ExecutionWorker] Error in script generation:', error);
        this.eventLogger?.logJobFailed(message.jobId, message.storyId, message.userId, error instanceof Error ? error.message : 'Unknown error');
        await this.eventLogger?.stop();
        throw error;
      }

      await this.eventLogger?.stop();
      return;
    }

     if (message.type === 'image') {
       this.eventLogger?.logImageGenerationStarted(
         message.jobId, message.storyId, message.userId,
         `scene-${message.sceneIndex}`, message.sceneIndex || 0
       );
       const result = await processSceneImage(message, this.env);
       console.log(`[ExecutionWorker] Image result for scene ${message.sceneIndex}`, { success: result.success, imageUrl: result.imageUrl });

       if (!result.success) {
         const blockCompleteRes = await coordinator.fetch(new Request('http://do/blockComplete', {
           method: 'POST',
           body: JSON.stringify({
             sceneIndex: message.sceneIndex,
             capability: 'image-generation',
             success: false,
             error: result.error,
             imageError: result.error,
           }),
         }));
         const blockStatus = await blockCompleteRes.json() as any;
         if (blockStatus.jobFailed || blockStatus.sceneFailed) {
           await this.markJobFailed(message, coordinator, dagExecutor, blockStatus.failureReason || result.error);
         }
       }
     } else if (message.type === 'video') {
       this.eventLogger?.logVideoStarted(
         message.jobId, message.storyId, message.userId,
         `scene-${message.sceneIndex}`, message.sceneIndex || 0
       );
       const result = await processSceneVideo(message, this.env);
       console.log(`[ExecutionWorker] Video result for scene ${message.sceneIndex}`, { success: result.success, videoUrl: result.videoUrl });

       if (!result.success) {
         const blockCompleteRes = await coordinator.fetch(new Request('http://do/blockComplete', {
           method: 'POST',
           body: JSON.stringify({
             sceneIndex: message.sceneIndex,
             capability: 'video-generation',
             success: false,
             error: result.error,
             videoError: result.error,
           }),
         }));
         const blockStatus = await blockCompleteRes.json() as any;
         if (blockStatus.jobFailed || blockStatus.sceneFailed) {
           await this.markJobFailed(message, coordinator, dagExecutor, blockStatus.failureReason || result.error);
         }
       }
     } else if (message.type === 'audio') {
       this.eventLogger?.logVoiceStarted(
         message.jobId, message.storyId, message.userId,
         `scene-${message.sceneIndex}`, message.sceneIndex || 0
       );
       const result = await processSceneAudio(message, this.env);
        console.log(`[ExecutionWorker] Audio result for scene ${message.sceneIndex}`, { success: result.success, audioUrl: result.audioUrl });

        // Log completion event
        if (result.success && result.audioUrl) {
          this.eventLogger?.logVoiceCompleted(
            message.jobId, message.storyId, message.userId,
            `scene-${message.sceneIndex}`, message.sceneIndex || 0, result.audioUrl
          );
        }

        const blockCompleteRes = await coordinator.fetch(new Request('http://do/blockComplete', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: message.sceneIndex,
            capability: 'voice-generation',
            success: result.success,
            error: result.error,
            audioUrl: result.audioUrl,
            audioDuration: result.audioDuration,
            captions: result.captions,
            audioError: result.error,
          }),
        }));
        if (!blockCompleteRes.ok) {
          throw new Error(`blockComplete failed status ${blockCompleteRes.status}`);
        }
        const blockStatus = await blockCompleteRes.json() as any;

        if (blockStatus.jobComplete) {
          await this.finalizeJob(coordinator, dagExecutor);
        } else if (blockStatus.sceneFailed || blockStatus.jobFailed) {
          await this.markJobFailed(message, coordinator, dagExecutor, blockStatus.failureReason || result.error);
        } else if (blockStatus.phase === 'AWAITING_REVIEW') {
          await this.transitionToReview(message, coordinator, dagExecutor, blockStatus);
        } else if (result.success) {
          await this.syncPartialProgress(coordinator, dagExecutor, blockStatus, 'voice-generation');
        }
      }

      // Flush events to DB
      await this.eventLogger?.stop();
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
  private async syncPartialProgress(
    coordinator: any,
    dagExecutor: ReturnType<typeof createDAGExecutor>,
    status: any,
    nodeType?: string
  ): Promise<void> {
    const progressRes = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
    const progressData = await progressRes.json() as any;

    if (progressData.scenes) {
      await dagExecutor.onNodeComplete(
        progressData.scenes,
        {
          imagesCompleted: status.imagesCompleted || 0,
          audioCompleted: status.audioCompleted || 0,
          videosCompleted: status.videosCompleted || 0,
          totalScenes: status.totalScenes || 1,
        },
        nodeType
      );
    }
  }

  /**
   * Mark job as failed in DB and DAG sync when a scene fails
   */
  private async markJobFailed(message: any, coordinator: any, dagExecutor: ReturnType<typeof createDAGExecutor>, errorDetail?: string): Promise<void> {
    const reason = errorDetail || 'Scene generation failed';
    console.error(`[ExecutionWorker] Marking job ${message.jobId} failed: ${reason}`);
    await dagExecutor.onJobFailed(reason);
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

function createExecutionWorker(options: ExecutionWorkerOptions): ExecutionWorker {
  return new ExecutionWorker(options);
}

/**
 * DAG-aware queue consumer - processes scene tasks with DAG sync
 */
export async function handleQueueDAG(batch: any, env: any): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { canProcessJob, sortMessagesByPriority } = await import('../../services/concurrency-manager');
  const { isRetryableError } = await import('../../utils/error-handling');

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
      if (isRetryableError(error)) {
        (message as any).retry();
      } else {
        (message as any).ack();
      }
    }
  }
}
