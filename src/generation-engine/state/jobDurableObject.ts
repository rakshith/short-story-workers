// Job Durable Object - Event-driven workflow orchestrator
// DO handles orchestration (WHAT to run, WHEN), Workers handle execution (actual generation)

interface JobMetadata {
  jobId: string;
  userId: string;
  seriesId: string;
  storyId: string;
  title: string;
  storyData: any;
  baseUrl: string;
  userTier: string;
  priority: number;
  teamId?: string;
}

interface ScheduledTasks {
  image: number[];
  video: number[];
  audio: number[];
}

interface SceneUpdate {
  sceneIndex: number;
  imageUrl?: string;
  imageError?: string;
  videoUrl?: string;
  videoError?: string;
  audioUrl?: string;
  audioDuration?: number;
  captions?: any[];
  audioError?: string;
}

interface StoryState {
  jobId: string;
  userId: string;
  scenes: any[];
  imagesCompleted: number;
  videosCompleted: number;
  audioCompleted: number;
  totalScenes: number;
  isCancelled?: boolean;
  videoConfig?: any;
  imageScenesDone: number[];
  videoScenesDone: number[];
  audioScenesDone: number[];
  completionSignaled?: boolean;
  sceneReviewRequired?: boolean;
  jobMetadata?: JobMetadata;
  scheduledTasks?: ScheduledTasks;
}

export class JobDurableObject {
  private state: DurableObjectState;
  private env: any;
  private storyState: StoryState | null = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1);

    try {
      switch (action) {
        case 'init':
          return this.handleInit(request);
        case 'updateImage':
          return this.handleImageUpdate(request);
        case 'updateVideo':
          return this.handleVideoUpdate(request);
        case 'updateAudio':
          return this.handleAudioUpdate(request);
        case 'getProgress':
          return this.handleGetProgress();
        case 'cancel':
          return this.handleCancel();
        case 'finalize':
          return this.handleFinalize(request);
        case 'queueInitialTasks':
          return this.handleQueueInitialTasks();
        default:
          return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
      }
    } catch (error) {
      console.error(`[JobDurableObject] Error in ${action}:`, error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }

  private async handleInit(request: Request): Promise<Response> {
    const {
      jobId,
      userId,
      scenes,
      totalScenes,
      videoConfig,
      skipAudioCheck,
      sceneReviewRequired,
      jobMetadata
    } = await request.json() as any;

    const imagesDone = scenes?.filter((s: any) => s.generatedImageUrl).length || 0;
    const audioDone = skipAudioCheck ? totalScenes : (scenes?.filter((s: any) => s.audioUrl).length || 0);
    const videosDone = scenes?.filter((s: any) => s.generatedVideoUrl).length || 0;

    this.storyState = {
      jobId,
      userId,
      scenes: scenes || [],
      imagesCompleted: imagesDone,
      videosCompleted: videosDone,
      audioCompleted: audioDone,
      totalScenes,
      videoConfig,
      imageScenesDone: Array.from({ length: imagesDone }, (_, i) => i),
      videoScenesDone: Array.from({ length: videosDone }, (_, i) => i),
      audioScenesDone: Array.from({ length: audioDone }, (_, i) => i),
      completionSignaled: false,
      sceneReviewRequired: sceneReviewRequired || false,
      jobMetadata: jobMetadata || null,
      scheduledTasks: {
        image: Array.from({ length: imagesDone }, (_, i) => i),
        video: Array.from({ length: videosDone }, (_, i) => i),
        audio: Array.from({ length: audioDone }, (_, i) => i),
      },
    };

    await this.state.storage.put('storyState', this.storyState);

    console.log(`[JobDurableObject] Initialized for job ${jobId} with ${totalScenes} scenes`);

    await this.queueInitialTasks();

    return new Response(JSON.stringify({ success: true }));
  }

  private async queueInitialTasks(): Promise<void> {
    const state = this.storyState;
    if (!state?.jobMetadata) {
      console.log(`[JobDurableObject] No job metadata, skipping initial queue`);
      return;
    }

    const { jobMetadata, videoConfig, scenes } = state;
    const enableVoiceOver = videoConfig?.enableVoiceOver !== false;
    const mediaType = videoConfig?.mediaType === 'video' ? 'video' : 'image';

    console.log(`[JobDurableObject] Queueing initial tasks for job ${jobMetadata.jobId}`);

    const tasksToQueue: { type: 'image' | 'video' | 'audio'; sceneIndex: number }[] = [];

    // Prioritize template/user configuration for review
    const requiresReview = videoConfig?.sceneReviewRequired === true;

    // Determine if we need to generate base images
    const startWithImage = mediaType === 'image' || requiresReview;

    for (let i = 0; i < scenes.length; i++) {
      // Only queue images if we are outputting images OR doing a required review loop 
      // (which requires images to be approved before video)
      if (startWithImage && !state.imageScenesDone.includes(i)) {
        tasksToQueue.push({ type: 'image', sceneIndex: i });
      }

      // If review is NOT required, queue videos immediately
      if (!requiresReview && mediaType === 'video' && !state.videoScenesDone.includes(i)) {
        // We queue video tasks early. The video pipeline handles Text-to-Video directly 
        // if no reference image is generated.
        tasksToQueue.push({ type: 'video', sceneIndex: i });
      }
      
      if (enableVoiceOver && !state.audioScenesDone.includes(i)) {
        tasksToQueue.push({ type: 'audio', sceneIndex: i });
      }
    }

    await this.queueTasks(tasksToQueue);
  }

  private async queueTasks(tasks: { type: 'image' | 'video' | 'audio'; sceneIndex: number }[]): Promise<void> {
    const state = this.storyState;
    if (!state?.jobMetadata) return;

    const { jobMetadata, videoConfig, scenes, scheduledTasks } = state;
    const queue = this.env.STORY_QUEUE;

    if (!queue) {
      console.error(`[JobDurableObject] STORY_QUEUE not available in env`);
      return;
    }

    for (const task of tasks) {
      const alreadyScheduled = scheduledTasks?.[task.type]?.includes(task.sceneIndex);
      if (alreadyScheduled) {
        console.log(`[JobDurableObject] Task ${task.type} for scene ${task.sceneIndex} already scheduled, skipping`);
        continue;
      }

      const scene = scenes[task.sceneIndex];
      const message: any = {
        jobId: jobMetadata.jobId,
        userId: jobMetadata.userId,
        seriesId: jobMetadata.seriesId,
        storyId: jobMetadata.storyId,
        title: jobMetadata.title,
        storyData: jobMetadata.storyData,
        videoConfig,
        sceneIndex: task.sceneIndex,
        type: task.type,
        baseUrl: jobMetadata.baseUrl,
        teamId: jobMetadata.teamId,
        userTier: jobMetadata.userTier,
        priority: jobMetadata.priority,
      };

      if (task.type === 'image' && scene?.generatedImageUrl) {
        message.generatedImageUrl = scene.generatedImageUrl;
      }

      try {
        await queue.send(message);
        console.log(`[JobDurableObject] Queued ${task.type} for scene ${task.sceneIndex}`);

        if (state.scheduledTasks) {
          if (!state.scheduledTasks[task.type].includes(task.sceneIndex)) {
            state.scheduledTasks[task.type].push(task.sceneIndex);
          }
        }
      } catch (error) {
        console.error(`[JobDurableObject] Failed to queue ${task.type} for scene ${task.sceneIndex}:`, error);
      }
    }

    await this.state.storage.put('storyState', state);
  }

  private async loadState(): Promise<StoryState | null> {
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState | null;
    }
    return this.storyState;
  }

  private async handleImageUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;

    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'Job not initialized', status: 400 };
        return;
      }

      if (state.isCancelled) {
        result = {
          error: 'Job cancelled',
          isCancelled: true,
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
          isComplete: false
        };
        return;
      }

      if (state.scenes[update.sceneIndex]) {
        state.scenes[update.sceneIndex] = {
          ...state.scenes[update.sceneIndex],
          generatedImageUrl: update.imageUrl,
          ...(update.imageError ? { generationError: update.imageError } : {}),
        };
      }

      if (
        (update.imageUrl || update.imageError) &&
        !state.imageScenesDone.includes(update.sceneIndex)
      ) {
        state.imageScenesDone.push(update.sceneIndex);
        state.imagesCompleted++;
      }

      const imagesAllDone = state.imagesCompleted >= state.totalScenes;
      const videosAllDone = state.videosCompleted >= state.totalScenes;
      const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;

      const isImagesCompleteForReview = imagesAllDone && audioAllDone;
      const mediaType = state.videoConfig?.mediaType === 'video' ? 'video' : 'image';
      const allDone = mediaType === 'image' ? isImagesCompleteForReview : (videosAllDone && audioAllDone);

      const isComplete = state.sceneReviewRequired
        ? (isImagesCompleteForReview && !state.completionSignaled)
        : (allDone && !state.completionSignaled);

      if (isComplete) {
        state.completionSignaled = true;
      }

      await txn.put('storyState', state);
      this.storyState = state;

      result = {
        success: true,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
        isComplete,
        isImagesCompleteForReview,
      };
    });

    if (result.error) {
      return new Response(JSON.stringify(result), { status: result.status });
    }

    if (!this.storyState?.sceneReviewRequired && update.imageUrl) {
      const alreadyScheduled = this.storyState?.scheduledTasks?.video?.includes(update.sceneIndex);
      if (!alreadyScheduled) {
        await this.queueTasks([{ type: 'video', sceneIndex: update.sceneIndex }]);
      }
    }

    return new Response(JSON.stringify(result));
  }

  private async handleVideoUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;

    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'Job not initialized', status: 400 };
        return;
      }

      if (state.isCancelled) {
        result = {
          error: 'Job cancelled',
          isCancelled: true,
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
          isComplete: false
        };
        return;
      }

      if (state.scenes[update.sceneIndex]) {
        state.scenes[update.sceneIndex] = {
          ...state.scenes[update.sceneIndex],
          generatedVideoUrl: update.videoUrl,
          ...(update.videoError ? { videoGenerationError: update.videoError } : {}),
        };
      }

      if (
        (update.videoUrl || update.videoError) &&
        !state.videoScenesDone.includes(update.sceneIndex)
      ) {
        state.videoScenesDone.push(update.sceneIndex);
        state.videosCompleted++;
      }

      const videosAllDone = state.videosCompleted >= state.totalScenes;
      const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;
      const imagesAllDone = state.imagesCompleted >= state.totalScenes;
      const mediaType = state.videoConfig?.mediaType === 'video' ? 'video' : 'image';
      const allDone = mediaType === 'image' ? (imagesAllDone && audioAllDone) : (videosAllDone && audioAllDone);

      const isComplete = allDone && !state.completionSignaled;
      if (isComplete) {
        state.completionSignaled = true;
      }

      await txn.put('storyState', state);
      this.storyState = state;

      result = {
        success: true,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
        isComplete,
      };
    });

    if (result.error) {
      return new Response(JSON.stringify(result), { status: result.status });
    }

    return new Response(JSON.stringify(result));
  }

  private async handleAudioUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;

    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'Job not initialized', status: 400 };
        return;
      }

      if (state.isCancelled) {
        result = {
          error: 'Job cancelled',
          isCancelled: true,
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
          isComplete: false
        };
        return;
      }

      if (state.scenes[update.sceneIndex]) {
        const sceneUpdate: any = { ...state.scenes[update.sceneIndex] };
        if (update.audioUrl) {
          sceneUpdate.audioUrl = update.audioUrl;
          sceneUpdate.audioDuration = update.audioDuration;
          sceneUpdate.captions = update.captions || [];
        }
        if (update.audioError) {
          sceneUpdate.audioGenerationError = update.audioError;
        }
        state.scenes[update.sceneIndex] = sceneUpdate;
      }

      if (!state.audioScenesDone.includes(update.sceneIndex)) {
        state.audioScenesDone.push(update.sceneIndex);
        state.audioCompleted++;
      }

      const imagesAllDone = state.imagesCompleted >= state.totalScenes;
      const videosAllDone = state.videosCompleted >= state.totalScenes;
      const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;

      const isImagesCompleteForReview = imagesAllDone && audioAllDone;
      const mediaType = state.videoConfig?.mediaType === 'video' ? 'video' : 'image';
      const allDone = mediaType === 'image' ? isImagesCompleteForReview : (videosAllDone && audioAllDone);

      const isComplete = state.sceneReviewRequired
        ? (isImagesCompleteForReview && !state.completionSignaled)
        : (allDone && !state.completionSignaled);

      if (isComplete) {
        state.completionSignaled = true;
      }

      await txn.put('storyState', state);
      this.storyState = state;

      result = {
        success: true,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
        isComplete,
      };
    });

    if (result.error) {
      return new Response(JSON.stringify(result), { status: result.status });
    }

    return new Response(JSON.stringify(result));
  }

  private async handleGetProgress(): Promise<Response> {
    const state = await this.loadState();

    if (!state) {
      return new Response(JSON.stringify({
        imagesCompleted: 0,
        videosCompleted: 0,
        audioCompleted: 0,
        totalScenes: 0,
        isComplete: false,
        isCancelled: false,
      }));
    }

    const imagesAllDone = state.imagesCompleted >= state.totalScenes;
    const videosAllDone = state.videosCompleted >= state.totalScenes;
    const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;
    const mediaType = state.videoConfig?.mediaType === 'video' ? 'video' : 'image';
    const isComplete = mediaType === 'image'
      ? (imagesAllDone && audioAllDone)
      : (videosAllDone && audioAllDone);

    return new Response(JSON.stringify({
      imagesCompleted: state.imagesCompleted,
      videosCompleted: state.videosCompleted,
      audioCompleted: state.audioCompleted,
      totalScenes: state.totalScenes,
      isComplete,
      completionSignaled: state.completionSignaled || false,
      isCancelled: state.isCancelled || false,
      scenes: state.scenes,
      videoConfig: state.videoConfig,
    }));
  }

  private async handleCancel(): Promise<Response> {
    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'Job not initialized', status: 400 };
        return;
      }

      state.isCancelled = true;
      await txn.put('storyState', state);
      this.storyState = state;

      console.log(`[JobDurableObject] Job ${state.jobId} has been cancelled`);
      result = { success: true, isCancelled: true };
    });

    return new Response(JSON.stringify(result));
  }

  private async handleQueueInitialTasks(): Promise<Response> {
    await this.queueInitialTasks();
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleFinalize(request: Request): Promise<Response> {
    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'Job not initialized', status: 400 };
        return;
      }

      if (state.isCancelled) {
        result = { error: 'Job cancelled', isCancelled: true, status: 499 };
        return;
      }

      const videosAllDone = state.videosCompleted >= state.totalScenes;
      const imagesAllDone = state.imagesCompleted >= state.totalScenes;
      const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;

      const mediaType = state.videoConfig?.mediaType === 'video' ? 'video' : 'image';
      const isComplete = mediaType === 'image'
        ? (imagesAllDone && audioAllDone)
        : (videosAllDone && audioAllDone);

      if (!isComplete) {
        result = {
          success: false,
          isComplete: false,
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
        };
        return;
      }

      if (!state.completionSignaled) {
        state.completionSignaled = true;
        await txn.put('storyState', state);
      }

      const totalDuration = state.scenes.reduce((sum, scene) => {
        return sum + (scene.audioDuration || scene.duration || 0);
      }, 0);

      const { compile } = await import('@artflicks/video-compiler');
      const timeline = compile({
        story: {
          id: state.jobId,
          scenes: state.scenes,
          totalDuration,
        },
        videoConfig: state.videoConfig || {},
      });

      result = {
        success: true,
        isComplete: true,
        jobId: state.jobId,
        userId: state.userId,
        scenes: state.scenes,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        timeline,
        shouldCleanup: true,
      };

      await txn.put('storyState', { jobId: state.jobId, _completed: true });
      this.storyState = null;
    });

    if (result.shouldCleanup) {
      await this.state.storage.deleteAll();
    }

    const { shouldCleanup: _cleanup, ...response } = result;
    return new Response(JSON.stringify(response));
  }
}

function createJobDurableObject(state: DurableObjectState, env: any): JobDurableObject {
  return new JobDurableObject(state, env);
}
