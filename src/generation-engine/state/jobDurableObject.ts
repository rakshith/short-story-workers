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

interface SceneCompletion {
  completedCapabilities: Set<string>;
  failed: boolean;
  failureReason?: string;
}

interface DAGMetadata {
  sceneCount: number;
  templateId: string;
  profileId: string;
  blocks: any[];
  reviewRequired: boolean;
  builtAt: string;
}

interface StoredDAG {
  graph: any;
  counters: any;
  metadata: DAGMetadata;
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
  dag?: StoredDAG;
  sceneCompletion: Map<number, SceneCompletion>;
  jobPhase: 'PENDING' | 'SCRIPT_RUNNING' | 'GENERATION_RUNNING' | 'AWAITING_REVIEW' | 'FINALIZED' | 'FAILED';
  reviewApproved: boolean;
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
          case 'updateScript':
            return this.handleUpdateScript(request);
          case 'updateImage':
            return this.handleImageUpdate(request);
          case 'updateVideo':
            return this.handleVideoUpdate(request);
          case 'updateAudio':
            return this.handleAudioUpdate(request);
          case 'getProgress':
            return this.handleGetProgress();
          case 'getState':
            return this.handleGetState();
          case 'cancel':
            return this.handleCancel();
          case 'finalize':
            return this.handleFinalize(request);
           case 'queueInitialTasks':
             return this.handleQueueInitialTasks();
           case 'storeDag':
             return this.handleStoreDag(request);
           case 'getDag':
             return this.handleGetDag();
           case 'blockComplete':
             return this.handleBlockComplete(request);
           case 'approveReview':
             return this.handleApproveReview();
           case 'recordScheduled':
             return this.handleRecordScheduled(request);
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
      sceneCompletion: new Map(),
      jobPhase: 'PENDING',
      reviewApproved: false,
    };

    await this.state.storage.put('storyState', this.storyState);

    console.log(`[JobDurableObject] Initialized for job ${jobId} with ${totalScenes} scenes`);

    // Note: DAGExecutor now handles scheduling via dagExecutor.run()
    // No need to queue initial tasks here

    return new Response(JSON.stringify({ success: true }));
  }

  private async handleUpdateScript(request: Request): Promise<Response> {
    const { story, title } = await request.json() as any;

    await this.loadState();

    if (!this.storyState) {
      return new Response(JSON.stringify({ error: 'State not initialized' }), { status: 400 });
    }

    this.storyState.scenes = story?.scenes || [];
    const existingMeta = this.storyState.jobMetadata;
    this.storyState.jobMetadata = {
      jobId: existingMeta?.jobId || '',
      userId: existingMeta?.userId || '',
      seriesId: existingMeta?.seriesId || '',
      storyId: existingMeta?.storyId || '',
      title: title || existingMeta?.title || '',
      storyData: story,
      baseUrl: existingMeta?.baseUrl || '',
      userTier: existingMeta?.userTier || 'tier1',
      priority: existingMeta?.priority || 1,
      teamId: existingMeta?.teamId,
    };
    this.storyState.totalScenes = story?.scenes?.length || 0;

    await this.state.storage.put('storyState', this.storyState);

    console.log(`[JobDurableObject] Updated with script: ${story?.scenes?.length || 0} scenes`);

    return new Response(JSON.stringify({ success: true, totalScenes: this.storyState.totalScenes }));
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
        videoConfig: state.videoConfig,
      };
    });

    if (result.error) {
      return new Response(JSON.stringify(result), { status: result.status });
    }

    // Note: DAGExecutor now handles video scheduling after image via scheduleNextNodes()
    // No need to queue video tasks here

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
        videoConfig: state.videoConfig,
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
        sceneReviewRequired: state.sceneReviewRequired || false,
        scenes: state.scenes || [],
        scheduledTasks: state.scheduledTasks || { image: [], video: [], audio: [] },
        jobPhase: state.jobPhase || 'PENDING',
        imageScenesDone: state.imageScenesDone || [],
        videoScenesDone: state.videoScenesDone || [],
        audioScenesDone: state.audioScenesDone || [],
      }));
   }

  private async handleRecordScheduled(request: Request): Promise<Response> {
    const { type, sceneIndex } = await request.json() as { type: 'image' | 'video' | 'audio'; sceneIndex: number };

    await this.loadState();
    if (!this.storyState?.scheduledTasks) {
      return new Response(JSON.stringify({ error: 'State not initialized' }), { status: 400 });
    }

    const arr = this.storyState.scheduledTasks[type];
    if (!arr.includes(sceneIndex)) {
      arr.push(sceneIndex);
      await this.state.storage.put('storyState', this.storyState);
    }
    return new Response(JSON.stringify({ success: true }));
  }

   private async handleGetState(): Promise<Response> {
     const state = await this.loadState();

     if (!state) {
       return new Response(JSON.stringify({ error: 'State not found' }), { status: 404 });
     }

     return new Response(JSON.stringify(state));
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
        storyId: state.jobMetadata?.storyId,
        title: state.jobMetadata?.title,
        userId: state.userId,
        scenes: state.scenes,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        timeline,
      };

      await txn.put('storyState', { jobId: state.jobId, _completed: true });
      this.storyState = null;
    });

    console.log(`[JobDurableObject] Finalized with compiled timeline`);

    return new Response(JSON.stringify(result));
  }

  /**
   * Store DAG + counters in DO for persistence (never rebuild)
   */
  private async handleStoreDag(request: Request): Promise<Response> {
    const { graph, counters, metadata } = await request.json() as any;

    await this.loadState();

    if (!this.storyState) {
      return new Response(JSON.stringify({ error: 'State not initialized' }), { status: 400 });
    }

    this.storyState.dag = { graph, counters, metadata };
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[JobDurableObject] DAG stored (blocks: ${metadata.blocks.length}, reviewRequired: ${metadata.reviewRequired})`);
    return new Response(JSON.stringify({ success: true }));
  }

  /**
   * Retrieve cached DAG from DO
   */
  private async handleGetDag(): Promise<Response> {
    const state = await this.loadState();

    if (!state || !state.dag) {
      return new Response(JSON.stringify({ error: 'DAG not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(state.dag));
  }

  /**
   * Track scene completion when a block completes.
   * Optional scene outputs (imageUrl, videoUrl, audioUrl, etc.) update state.scenes and counters so DAG path stays in sync.
   */
  private async handleBlockComplete(request: Request): Promise<Response> {
    const payload = await request.json() as any;
    const {
      sceneIndex,
      capability,
      success,
      error: blockError,
      imageUrl,
      imageError,
      videoUrl,
      videoError,
      audioUrl,
      audioDuration,
      captions,
      audioError,
    } = payload;

    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'State not initialized', status: 400 };
        return;
      }

      if (!state.sceneCompletion.has(sceneIndex)) {
        state.sceneCompletion.set(sceneIndex, {
          completedCapabilities: new Set(),
          failed: false,
        });
      }

      const sceneCompletion = state.sceneCompletion.get(sceneIndex)!;

      if (!success) {
        sceneCompletion.failed = true;
        sceneCompletion.failureReason = blockError;
        state.jobPhase = 'FAILED';
        console.log(`[JobDurableObject] Scene ${sceneIndex} failed: ${blockError}, job marked FAILED`);
        await txn.put('storyState', state);
        this.storyState = state;
        result = {
          jobComplete: false,
          sceneFailed: true,
          jobFailed: true,
          failureReason: blockError,
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
        };
        return;
      }

      sceneCompletion.completedCapabilities.add(capability);

      if (capability === 'image-generation' && (imageUrl || imageError) && state.scenes[sceneIndex]) {
        state.scenes[sceneIndex] = {
          ...state.scenes[sceneIndex],
          generatedImageUrl: imageUrl,
          ...(imageError ? { generationError: imageError } : {}),
        };
        if (!state.imageScenesDone.includes(sceneIndex)) {
          state.imageScenesDone.push(sceneIndex);
          state.imagesCompleted++;
        }
      }

      if (capability === 'video-generation' && (videoUrl || videoError) && state.scenes[sceneIndex]) {
        state.scenes[sceneIndex] = {
          ...state.scenes[sceneIndex],
          generatedVideoUrl: videoUrl,
          ...(videoError ? { videoGenerationError: videoError } : {}),
        };
        if (!state.videoScenesDone.includes(sceneIndex)) {
          state.videoScenesDone.push(sceneIndex);
          state.videosCompleted++;
        }
      }

      if (capability === 'voice-generation' && state.scenes[sceneIndex]) {
        const sceneUpdate: any = { ...state.scenes[sceneIndex] };
        if (audioUrl) {
          sceneUpdate.audioUrl = audioUrl;
          sceneUpdate.audioDuration = audioDuration;
          sceneUpdate.captions = captions || [];
        }
        if (audioError) sceneUpdate.audioGenerationError = audioError;
        state.scenes[sceneIndex] = sceneUpdate;
        if (!state.audioScenesDone.includes(sceneIndex)) {
          state.audioScenesDone.push(sceneIndex);
          state.audioCompleted++;
        }
      }

      await txn.put('storyState', state);
      this.storyState = state;

      console.log(`[JobDurableObject] Scene ${sceneIndex} capability '${capability}' completed`);

      if (this.isJobComplete()) {
        state.jobPhase = 'FINALIZED';
        await txn.put('storyState', state);
        this.storyState = state;
        console.log(`[JobDurableObject] Job marked FINALIZED - all scenes complete`);
        result = {
          jobComplete: true,
          phase: 'FINALIZED',
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
        };
        return;
      }

      if (this.shouldPauseForReview()) {
        state.jobPhase = 'AWAITING_REVIEW';
        await txn.put('storyState', state);
        this.storyState = state;
        console.log(`[JobDurableObject] Job paused at AWAITING_REVIEW phase`);
        result = {
          jobComplete: false,
          phase: 'AWAITING_REVIEW',
          imagesCompleted: state.imagesCompleted,
          videosCompleted: state.videosCompleted,
          audioCompleted: state.audioCompleted,
          totalScenes: state.totalScenes,
        };
        return;
      }

      result = {
        jobComplete: false,
        phase: 'GENERATION_RUNNING',
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
      };
    });

    if (result.error) {
      return new Response(JSON.stringify(result), { status: result.status });
    }
    return new Response(JSON.stringify(result));
  }

  /**
   * User approves review, resume generation
   */
  private async handleApproveReview(): Promise<Response> {
    let result: any;

    await this.state.storage.transaction(async (txn) => {
      const state = await txn.get('storyState') as StoryState;

      if (!state) {
        result = { error: 'State not initialized', status: 400 };
        return;
      }

      if (state.reviewApproved) {
        result = { error: 'Review already approved', status: 400 };
        return;
      }

      const imagesAllDone = state.imagesCompleted >= state.totalScenes;
      const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;

      if (!imagesAllDone || !audioAllDone) {
        result = { error: 'Pre-review generation not complete', status: 400 };
        return;
      }

      state.reviewApproved = true;
      state.jobPhase = 'GENERATION_RUNNING';
      await txn.put('storyState', state);
      this.storyState = state;

      console.log(`[JobDurableObject] Review approved, resuming generation`);
      result = { success: true, phase: 'GENERATION_RUNNING' };
    });

    if (result.error) {
      return new Response(JSON.stringify(result), { status: result.status || 400 });
    }
    return new Response(JSON.stringify(result));
  }

  /**
   * Get required capabilities per scene (excludes script-generation and review_required).
   * Script is global; review is a gate. Scene completion = image + voice + video when applicable.
   */
  private getRequiredCapabilities(): Set<string> {
    if (!this.storyState?.dag?.metadata?.blocks) {
      return new Set();
    }

    const blocks = this.storyState.dag.metadata.blocks;
    return new Set(
      blocks
        .filter((b: any) => b.capability !== 'review_required' && b.capability !== 'script-generation')
        .map((b: any) => b.capability)
    );
  }

  /**
   * Check if a scene has all required capabilities
   */
  private isSceneComplete(sceneIndex: number): boolean {
    const scene = this.storyState?.sceneCompletion.get(sceneIndex);
    if (!scene || scene.failed) return false;

    const requiredCapabilities = this.getRequiredCapabilities();
    if (requiredCapabilities.size === 0) return false;

    // Scene complete = all required capabilities done
    return Array.from(requiredCapabilities).every(cap => scene.completedCapabilities.has(cap));
  }

  /**
   * Check if entire job is complete
   */
  private isJobComplete(): boolean {
    if (!this.storyState) return false;

    // If review is required but not approved yet, job can't be complete
    if (this.storyState.dag?.metadata?.reviewRequired && !this.storyState.reviewApproved) {
      return false;
    }

    // All scenes must be complete
    for (let i = 0; i < this.storyState.totalScenes; i++) {
      if (!this.isSceneComplete(i)) return false;
    }

    return true;
  }

  /**
   * Check if job should pause for review at this moment
   */
  private shouldPauseForReview(): boolean {
    if (!this.storyState?.dag?.metadata?.reviewRequired) {
      return false;
    }

    if (this.storyState.reviewApproved) {
      return false;
    }

    if (this.storyState.jobPhase === 'AWAITING_REVIEW') {
      return false;
    }

    const imagesAllDone = this.storyState.imagesCompleted >= this.storyState.totalScenes;
    const voiceOverEnabled = this.storyState.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || this.storyState.audioCompleted >= this.storyState.totalScenes;

    return imagesAllDone && audioAllDone;
  }
}
