// Durable Object for coordinating story updates - eliminates race conditions
// Each story gets its own instance, all updates are serialized

import { Env } from '../types/env';
import { compile } from '../../lib/@artflicks/video-compiler';

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
  storyId: string;
  userId: string;
  scenes: any[];
  imagesCompleted: number;
  audioCompleted: number;
  totalScenes: number;
  isCancelled?: boolean;
  videoConfig?: any;
  /** Prevents double-counting: tracks which scene indices already recorded an image/video result */
  imageScenesDone: number[];
  /** Prevents double-counting: tracks which scene indices already recorded an audio result */
  audioScenesDone: number[];
  /** Set once the first caller receives isComplete=true; subsequent callers get false */
  completionSignaled?: boolean;
}

export class StoryCoordinator {
  private state: DurableObjectState;
  private env: Env;
  private storyState: StoryState | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1); // Remove leading slash

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
      console.error(`[StoryCoordinator] Error in ${action}:`, error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), { status: 500 });
    }
  }

  private async handleInit(request: Request): Promise<Response> {
    const { storyId, userId, scenes, totalScenes, videoConfig } = await request.json() as any;

    this.storyState = {
      storyId,
      userId,
      scenes: scenes || [],
      imagesCompleted: 0,
      audioCompleted: 0,
      totalScenes,
      videoConfig,
      imageScenesDone: [],
      audioScenesDone: [],
      completionSignaled: false,
    };

    // Persist to durable storage
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Initialized for story ${storyId} with ${totalScenes} scenes`);
    return new Response(JSON.stringify({ success: true }));
  }

  private async handleImageUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;

    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
      if (!this.storyState) {
        return new Response(JSON.stringify({ error: 'Story not initialized' }), { status: 400 });
      }
      // Backfill new fields for DOs created before this deploy
      if (!this.storyState.imageScenesDone) this.storyState.imageScenesDone = [];
      if (!this.storyState.audioScenesDone) this.storyState.audioScenesDone = [];
    }

    // Check if cancelled
    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: this.storyState.imagesCompleted,
        audioCompleted: this.storyState.audioCompleted,
        totalScenes: this.storyState.totalScenes,
        isComplete: false
      }), { status: 499 }); // Using 499 Client Closed Request as a custom "Cancelled" code
    }

    // Update scene with image (single-threaded, no race condition)
    if (this.storyState.scenes[update.sceneIndex]) {
      this.storyState.scenes[update.sceneIndex] = {
        ...this.storyState.scenes[update.sceneIndex],
        generatedImageUrl: update.imageUrl,
        ...(update.imageError ? { generationError: update.imageError } : {}),
      };
    }

    // Deduplicate: only increment if this scene hasn't already been counted
    if (
      (update.imageUrl || update.imageError) &&
      !this.storyState.imageScenesDone.includes(update.sceneIndex)
    ) {
      this.storyState.imageScenesDone.push(update.sceneIndex);
      this.storyState.imagesCompleted++;
    }

    // Signal completion at most once across ALL update handlers
    const allDone = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;
    const isComplete = allDone && !this.storyState.completionSignaled;
    if (isComplete) {
      this.storyState.completionSignaled = true;
    }

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Image updated for scene ${update.sceneIndex}, total: ${this.storyState.imagesCompleted}/${this.storyState.totalScenes}`);

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
    }));
  }

  private async handleVideoUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;

    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
      if (!this.storyState) {
        return new Response(JSON.stringify({ error: 'Story not initialized' }), { status: 400 });
      }
      if (!this.storyState.imageScenesDone) this.storyState.imageScenesDone = [];
      if (!this.storyState.audioScenesDone) this.storyState.audioScenesDone = [];
    }

    // Check if cancelled
    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: this.storyState.imagesCompleted,
        audioCompleted: this.storyState.audioCompleted,
        totalScenes: this.storyState.totalScenes,
        isComplete: false
      }), { status: 499 });
    }

    // Update scene with video (single-threaded, no race condition)
    if (this.storyState.scenes[update.sceneIndex]) {
      this.storyState.scenes[update.sceneIndex] = {
        ...this.storyState.scenes[update.sceneIndex],
        generatedVideoUrl: update.videoUrl,
        ...(update.videoError ? { videoGenerationError: update.videoError } : {}),
      };
    }

    // Deduplicate: reuse imageScenesDone since video replaces image for the same visual slot
    if (
      (update.videoUrl || update.videoError) &&
      !this.storyState.imageScenesDone.includes(update.sceneIndex)
    ) {
      this.storyState.imageScenesDone.push(update.sceneIndex);
      this.storyState.imagesCompleted++;
    }

    // Signal completion at most once across ALL update handlers
    const allDone = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;
    const isComplete = allDone && !this.storyState.completionSignaled;
    if (isComplete) {
      this.storyState.completionSignaled = true;
    }

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Video updated for scene ${update.sceneIndex}, total: ${this.storyState.imagesCompleted}/${this.storyState.totalScenes}`);

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
    }));
  }

  private async handleAudioUpdate(request: Request): Promise<Response> {
    const update: SceneUpdate = await request.json() as any;

    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
      if (!this.storyState) {
        return new Response(JSON.stringify({ error: 'Story not initialized' }), { status: 400 });
      }
      if (!this.storyState.imageScenesDone) this.storyState.imageScenesDone = [];
      if (!this.storyState.audioScenesDone) this.storyState.audioScenesDone = [];
    }

    // Check if cancelled
    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: this.storyState.imagesCompleted,
        audioCompleted: this.storyState.audioCompleted,
        totalScenes: this.storyState.totalScenes,
        isComplete: false
      }), { status: 499 });
    }

    // Update scene (single-threaded, no race condition)
    if (this.storyState.scenes[update.sceneIndex]) {
      const sceneUpdate: any = { ...this.storyState.scenes[update.sceneIndex] };

      if (update.audioUrl) {
        sceneUpdate.audioUrl = update.audioUrl;
        sceneUpdate.audioDuration = update.audioDuration;
        sceneUpdate.captions = update.captions || [];
      }
      if (update.audioError) {
        sceneUpdate.audioGenerationError = update.audioError;
      }

      this.storyState.scenes[update.sceneIndex] = sceneUpdate;
    }

    // Deduplicate: only increment if this scene hasn't already been counted
    if (!this.storyState.audioScenesDone.includes(update.sceneIndex)) {
      this.storyState.audioScenesDone.push(update.sceneIndex);
      this.storyState.audioCompleted++;
    }

    // Signal completion at most once across ALL update handlers
    const allDone = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;
    const isComplete = allDone && !this.storyState.completionSignaled;
    if (isComplete) {
      this.storyState.completionSignaled = true;
    }

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Audio updated for scene ${update.sceneIndex}, total: ${this.storyState.audioCompleted}/${this.storyState.totalScenes}`);

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
    }));
  }

  private async handleGetProgress(): Promise<Response> {
    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
    }

    if (!this.storyState) {
      return new Response(JSON.stringify({
        imagesCompleted: 0,
        audioCompleted: 0,
        totalScenes: 0,
        isComplete: false,
        isCancelled: false,
      }));
    }

    const isComplete = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;

    return new Response(JSON.stringify({
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
      completionSignaled: this.storyState.completionSignaled || false,
      isCancelled: this.storyState.isCancelled || false,
      scenes: this.storyState.scenes,
    }));
  }

  private async handleCancel(): Promise<Response> {
    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
      if (!this.storyState) {
        return new Response(JSON.stringify({ error: 'Story not initialized' }), { status: 400 });
      }
    }

    this.storyState.isCancelled = true;
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Job for story ${this.storyState.storyId} has been cancelled`);
    return new Response(JSON.stringify({ success: true, isCancelled: true }));
  }

  private async handleFinalize(request: Request): Promise<Response> {
    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
      if (!this.storyState) {
        return new Response(JSON.stringify({ error: 'Story not initialized' }), { status: 400 });
      }
    }

    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ error: 'Job cancelled', isCancelled: true }), { status: 499 });
    }

    const isComplete = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;

    if (!isComplete) {
      return new Response(JSON.stringify({
        success: false,
        isComplete: false,
        imagesCompleted: this.storyState.imagesCompleted,
        audioCompleted: this.storyState.audioCompleted,
        totalScenes: this.storyState.totalScenes,
      }));
    }

    // Guard against duplicate finalize calls (e.g. two callers raced to completion)
    if (!this.storyState.completionSignaled) {
      console.warn(`[StoryCoordinator] finalize called but completionSignaled was false — forcing it`);
      this.storyState.completionSignaled = true;
      await this.state.storage.put('storyState', this.storyState);
    }

    // Calculate total duration from scenes
    const totalDuration = this.storyState.scenes.reduce((sum, scene) => {
      return sum + (scene.audioDuration || scene.duration || 0);
    }, 0);

    // Compile timeline using video-compiler
    const timeline = compile({
      story: {
        id: this.storyState.storyId,
        scenes: this.storyState.scenes,
        totalDuration,
      },
      videoConfig: this.storyState.videoConfig || {},
    });

    // Return final state with all scenes and compiled timeline
    const result = {
      success: true,
      isComplete: true,
      storyId: this.storyState.storyId,
      userId: this.storyState.userId,
      scenes: this.storyState.scenes,
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
      timeline,
    };

    // Clean up durable storage after finalization
    await this.state.storage.deleteAll();
    this.storyState = null;

    console.log(`[StoryCoordinator] Finalized and cleaned up with compiled timeline`);

    return new Response(JSON.stringify(result));
  }
}

