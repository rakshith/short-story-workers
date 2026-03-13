// Execution Worker - processes nodes from queue (supports both legacy and DAG modes)

import { createDAGExecutor, DAGMessage } from '../workflow/dagExecutor';

export interface ExecutionWorkerOptions {
  env: any;
  concurrencyService?: any;
  useDAG?: boolean;
}

export class ExecutionWorker {
  private env: any;
  private concurrencyService?: any;
  private useDAG: boolean;

  constructor(options: ExecutionWorkerOptions) {
    this.env = options.env;
    this.concurrencyService = options.concurrencyService;
    this.useDAG = options.useDAG || false;
  }

  async processMessage(message: any): Promise<void> {
    if (this.useDAG) {
      return this.processWithDAG(message);
    }
    return this.processLegacy(message);
  }

  private async processWithDAG(message: DAGMessage): Promise<void> {
    console.log('[ExecutionWorker] Processing with DAG:', message.jobId, message.type);

    const executor = createDAGExecutor({
      env: this.env,
      message,
    });

    const result = await executor.run();

    if (!result.success) {
      console.error('[ExecutionWorker] DAG execution failed:', result.error);
      await executor.onJobFailed(result.error || 'Unknown error');
    }
  }

  private async processLegacy(message: any): Promise<void> {
    const { processSceneImage, processSceneAudio, processSceneVideo } = await import('../../services/queue-processor');

    const getCoordinator = (storyId: string) => {
      const id = this.env.STORY_COORDINATOR.idFromName(storyId);
      return this.env.STORY_COORDINATOR.get(id);
    };

    const coordinator = getCoordinator(message.storyId);

    if (message.type === 'image') {
      const result = await processSceneImage(message, this.env);
      
      if (result.imageUrl != null || result.error != null) {
        await coordinator.fetch(new Request('http://do/updateImage', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: message.sceneIndex,
            imageUrl: result.imageUrl,
            imageError: result.success ? undefined : result.error,
          }),
        }));
      }
    } else if (message.type === 'video') {
      const result = await processSceneVideo(message, this.env);
      
      if (result.videoUrl != null || result.error != null) {
        await coordinator.fetch(new Request('http://do/updateVideo', {
          method: 'POST',
          body: JSON.stringify({
            sceneIndex: message.sceneIndex,
            videoUrl: result.videoUrl,
            videoError: result.success ? undefined : result.error,
          }),
        }));
      }
    } else if (message.type === 'audio') {
      const result = await processSceneAudio(message, this.env);
      
      await coordinator.fetch(new Request('http://do/updateAudio', {
        method: 'POST',
        body: JSON.stringify({
          sceneIndex: message.sceneIndex,
          audioUrl: result.audioUrl,
          audioDuration: result.audioDuration,
          captions: result.captions,
          audioError: result.success ? undefined : result.error,
        }),
      }));
    }
  }

  async checkConcurrency(userId: string, userTier?: string): Promise<boolean> {
    if (this.concurrencyService) {
      const result = await this.concurrencyService.check(userId, userTier || 'tier1', this.env);
      return result.allowed;
    }
    return true;
  }
}

export function createExecutionWorker(options: ExecutionWorkerOptions): ExecutionWorker {
  return new ExecutionWorker(options);
}

export async function handleQueueDAG(batch: any, env: any): Promise<void> {
  const worker = new ExecutionWorker({ env, useDAG: true });
  
  for (const message of batch.messages) {
    try {
      await worker.processMessage(message.body);
      message.ack();
    } catch (error) {
      console.error('[handleQueueDAG] Error processing message:', error);
      message.retry();
    }
  }
}
