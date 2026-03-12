// Job Durable Object - tracks node states and dependency counters for DAG execution

import { NodeStatus } from '../types';

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
    const { jobId, userId, scenes, totalScenes, videoConfig, skipAudioCheck, sceneReviewRequired } = await request.json() as any;

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
    };

    await this.state.storage.put('storyState', this.storyState);

    console.log(`[JobDurableObject] Initialized for job ${jobId} with ${totalScenes} scenes`);
    return new Response(JSON.stringify({ success: true }));
  }

  private async loadState(): Promise<StoryState | null> {
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState | null;
    }
    return this.storyState;
  }

  private async handleImageUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;
    const state = await this.loadState();

    if (!state) {
      return new Response(JSON.stringify({ error: 'Job not initialized' }), { status: 400 });
    }

    if (state.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
        isComplete: false
      }), { status: 499 });
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
    const allDone = videosAllDone && audioAllDone;

    const isComplete = state.sceneReviewRequired
      ? (isImagesCompleteForReview && !state.completionSignaled)
      : (allDone && !state.completionSignaled);

    if (isComplete) {
      state.completionSignaled = true;
    }

    await this.state.storage.put('storyState', state);

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: state.imagesCompleted,
      videosCompleted: state.videosCompleted,
      audioCompleted: state.audioCompleted,
      totalScenes: state.totalScenes,
      isComplete,
      isImagesCompleteForReview,
    }));
  }

  private async handleVideoUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;
    const state = await this.loadState();

    if (!state) {
      return new Response(JSON.stringify({ error: 'Job not initialized' }), { status: 400 });
    }

    if (state.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
        isComplete: false
      }), { status: 499 });
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
    const allDone = videosAllDone && audioAllDone;

    const isComplete = allDone && !state.completionSignaled;
    if (isComplete) {
      state.completionSignaled = true;
    }

    await this.state.storage.put('storyState', state);

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: state.imagesCompleted,
      videosCompleted: state.videosCompleted,
      audioCompleted: state.audioCompleted,
      totalScenes: state.totalScenes,
      isComplete,
    }));
  }

  private async handleAudioUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;
    const state = await this.loadState();

    if (!state) {
      return new Response(JSON.stringify({ error: 'Job not initialized' }), { status: 400 });
    }

    if (state.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
        isComplete: false
      }), { status: 499 });
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
    const allDone = videosAllDone && audioAllDone;

    const isComplete = state.sceneReviewRequired
      ? (isImagesCompleteForReview && !state.completionSignaled)
      : (allDone && !state.completionSignaled);

    if (isComplete) {
      state.completionSignaled = true;
    }

    await this.state.storage.put('storyState', state);

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: state.imagesCompleted,
      videosCompleted: state.videosCompleted,
      audioCompleted: state.audioCompleted,
      totalScenes: state.totalScenes,
      isComplete,
    }));
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
    const isComplete = (imagesAllDone && audioAllDone) || (videosAllDone && audioAllDone);

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
    const state = await this.loadState();

    if (!state) {
      return new Response(JSON.stringify({ error: 'Job not initialized' }), { status: 400 });
    }

    state.isCancelled = true;
    await this.state.storage.put('storyState', state);

    console.log(`[JobDurableObject] Job ${state.jobId} has been cancelled`);
    return new Response(JSON.stringify({ success: true, isCancelled: true }));
  }

  private async handleFinalize(request: Request): Promise<Response> {
    const state = await this.loadState();

    if (!state) {
      return new Response(JSON.stringify({ error: 'Job not initialized' }), { status: 400 });
    }

    if (state.isCancelled) {
      return new Response(JSON.stringify({ error: 'Job cancelled', isCancelled: true }), { status: 499 });
    }

    const videosAllDone = state.videosCompleted >= state.totalScenes;
    const imagesAllDone = state.imagesCompleted >= state.totalScenes;
    const voiceOverEnabled = state.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || state.audioCompleted >= state.totalScenes;

    const isComplete = (imagesAllDone && audioAllDone) || (videosAllDone && audioAllDone);

    if (!isComplete) {
      return new Response(JSON.stringify({
        success: false,
        isComplete: false,
        imagesCompleted: state.imagesCompleted,
        videosCompleted: state.videosCompleted,
        audioCompleted: state.audioCompleted,
        totalScenes: state.totalScenes,
      }));
    }

    if (!state.completionSignaled) {
      state.completionSignaled = true;
      await this.state.storage.put('storyState', state);
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

    const result = {
      success: true,
      isComplete: true,
      jobId: state.jobId,
      userId: state.userId,
      scenes: state.scenes,
      imagesCompleted: state.imagesCompleted,
      videosCompleted: state.videosCompleted,
      audioCompleted: state.audioCompleted,
      timeline,
    };

    await this.state.storage.deleteAll();
    this.storyState = null;

    return new Response(JSON.stringify(result));
  }
}

export function createJobDurableObject(state: DurableObjectState, env: any): JobDurableObject {
  return new JobDurableObject(state, env);
}
