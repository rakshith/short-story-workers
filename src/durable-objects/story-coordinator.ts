// Durable Object for coordinating story updates - eliminates race conditions
// Each story gets its own instance, all updates are serialized

import { Env } from '../types/env';

interface SceneUpdate {
  sceneIndex: number;
  imageUrl?: string;
  imageError?: string;
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
        case 'updateAudio':
          return this.handleAudioUpdate(request);
        case 'getProgress':
          return this.handleGetProgress();
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
    const { storyId, userId, scenes, totalScenes } = await request.json() as any;

    this.storyState = {
      storyId,
      userId,
      scenes: scenes || [],
      imagesCompleted: 0,
      audioCompleted: 0,
      totalScenes,
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
    }

    // Update scene (single-threaded, no race condition)
    if (this.storyState.scenes[update.sceneIndex]) {
      this.storyState.scenes[update.sceneIndex] = {
        ...this.storyState.scenes[update.sceneIndex],
        generatedImageUrl: update.imageUrl,
        ...(update.imageError ? { generationError: update.imageError } : {}),
      };
    }

    // Increment counter (both on success and failure to allow finalization)
    if (update.imageUrl || update.imageError) {
      this.storyState.imagesCompleted++;
    }

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Image updated for scene ${update.sceneIndex}, total: ${this.storyState.imagesCompleted}/${this.storyState.totalScenes}`);

    const isComplete = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;

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

    // Always increment audio counter (even if skipped due to no narration)
    this.storyState.audioCompleted++;

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Audio updated for scene ${update.sceneIndex}, total: ${this.storyState.audioCompleted}/${this.storyState.totalScenes}`);

    const isComplete = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;

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
      }));
    }

    const isComplete = this.storyState.imagesCompleted >= this.storyState.totalScenes &&
      this.storyState.audioCompleted >= this.storyState.totalScenes;

    return new Response(JSON.stringify({
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
      scenes: this.storyState.scenes,
    }));
  }

  private async handleFinalize(request: Request): Promise<Response> {
    // Load state if not in memory
    if (!this.storyState) {
      this.storyState = await this.state.storage.get('storyState') as StoryState;
      if (!this.storyState) {
        return new Response(JSON.stringify({ error: 'Story not initialized' }), { status: 400 });
      }
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

    // Return final state with all scenes
    const result = {
      success: true,
      isComplete: true,
      storyId: this.storyState.storyId,
      userId: this.storyState.userId,
      scenes: this.storyState.scenes,
      imagesCompleted: this.storyState.imagesCompleted,
      audioCompleted: this.storyState.audioCompleted,
    };

    // Clean up durable storage after finalization
    await this.state.storage.deleteAll();
    this.storyState = null;

    console.log(`[StoryCoordinator] Finalized and cleaned up`);

    return new Response(JSON.stringify(result));
  }
}

