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
  videosCompleted: number;
  audioCompleted: number;
  totalScenes: number;
  isCancelled?: boolean;
  videoConfig?: any;
  /** Prevents double-counting: tracks which scene indices already recorded an image result */
  imageScenesDone: number[];
  /** Prevents double-counting: tracks which scene indices already recorded a video result */
  videoScenesDone: number[];
  /** Prevents double-counting: tracks which scene indices already recorded an audio result */
  audioScenesDone: number[];
  /** Set once the first caller receives isComplete=true; subsequent callers get false */
  completionSignaled?: boolean;
  /** Whether this story requires scene review before video generation */
  sceneReviewRequired?: boolean;
}

export class StoryCoordinator {
  private state: DurableObjectState;
  private env: Env;
  private storyState: StoryState | null = null;
  // SSE clients for real-time updates - stored in DO memory
  private sseClients: Map<string, Set<ReadableStreamDefaultController>> = new Map();

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
        case 'sse':
          return this.handleSSE(request);
        case 'broadcast':
          return this.handleBroadcast(request);
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
    const { storyId, userId, scenes, totalScenes, videoConfig, skipAudioCheck, sceneReviewRequired } = await request.json() as any;

    // Count and collect actual completed scene indices (for resume flow - Step 2)
    const sceneList = scenes || [];
    const imageScenesDone = sceneList.map((s: any, i: number) => (s?.generatedImageUrl ? i : -1)).filter((i: number) => i >= 0);
    const videoScenesDone = sceneList.map((s: any, i: number) => (s?.generatedVideoUrl ? i : -1)).filter((i: number) => i >= 0);
    const audioScenesDone = skipAudioCheck
      ? Array.from({ length: totalScenes }, (_, i) => i)
      : sceneList.map((s: any, i: number) => (s?.audioUrl ? i : -1)).filter((i: number) => i >= 0);

    const imagesDone = imageScenesDone.length;
    const videosDone = videoScenesDone.length;
    const audioDone = audioScenesDone.length;

    this.storyState = {
      storyId,
      userId,
      scenes: sceneList,
      imagesCompleted: imagesDone,
      videosCompleted: videosDone,
      audioCompleted: audioDone,
      totalScenes,
      videoConfig,
      imageScenesDone,
      videoScenesDone,
      audioScenesDone,
      completionSignaled: false,
      sceneReviewRequired: sceneReviewRequired || false,
    };

    // Persist to durable storage
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Initialized for story ${storyId} with ${totalScenes} scenes (images: ${imagesDone}, audio: ${audioDone}, videos: ${videosDone}, skipAudioCheck: ${skipAudioCheck})`);
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
      if (!this.storyState.videoScenesDone) this.storyState.videoScenesDone = [];
      if (!this.storyState.audioScenesDone) this.storyState.audioScenesDone = [];
      if (this.storyState.videosCompleted === undefined) this.storyState.videosCompleted = 0;
    }

    // Check if cancelled
    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: this.storyState.imagesCompleted,
        videosCompleted: this.storyState.videosCompleted,
        audioCompleted: this.storyState.audioCompleted,
        totalScenes: this.storyState.totalScenes,
        isComplete: false
      }), { status: 499 });
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

    const imagesAllDone = this.storyState.imagesCompleted >= this.storyState.totalScenes;
    const videosAllDone = this.storyState.videosCompleted >= this.storyState.totalScenes;
    const voiceOverEnabled = this.storyState.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || this.storyState.audioCompleted >= this.storyState.totalScenes;
    const isImageOnlyStory = this.storyState.videoConfig?.mediaType !== 'video';

    const isImagesCompleteForReview = imagesAllDone && audioAllDone;
    const allDone = isImageOnlyStory
      ? (imagesAllDone && audioAllDone)
      : (videosAllDone && audioAllDone);

    const isComplete = this.storyState.sceneReviewRequired
      ? (isImagesCompleteForReview && !this.storyState.completionSignaled)
      : (allDone && !this.storyState.completionSignaled);

    if (isComplete) {
      this.storyState.completionSignaled = true;
    }

    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Image updated for scene ${update.sceneIndex}, total: ${this.storyState.imagesCompleted}/${this.storyState.totalScenes}`);

    // Note: Progress updates removed - only completion is broadcasted

    // Gate: scene is ready to queue video when it has both a generated image AND real audio duration
    const updatedSceneForGate = this.storyState.scenes[update.sceneIndex];
    const sceneHasImage = !!(updatedSceneForGate?.generatedImageUrl);
    const sceneHasAudio = !!(updatedSceneForGate?.audioDuration && updatedSceneForGate.audioDuration > 0);
    const isSceneReadyForVideo = sceneHasImage && (sceneHasAudio || !voiceOverEnabled);
    const sceneImageUrl = updatedSceneForGate?.generatedImageUrl || null;
    const sceneAudioDuration: number = updatedSceneForGate?.audioDuration || 0;

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: this.storyState.imagesCompleted,
      videosCompleted: this.storyState.videosCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
      isImagesCompleteForReview,
      isSceneReadyForVideo,
      sceneImageUrl,
      sceneAudioDuration,
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
      if (!this.storyState.videoScenesDone) this.storyState.videoScenesDone = [];
      if (!this.storyState.audioScenesDone) this.storyState.audioScenesDone = [];
      if (this.storyState.videosCompleted === undefined) this.storyState.videosCompleted = 0;
    }

    // Check if cancelled
    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: this.storyState.imagesCompleted,
        videosCompleted: this.storyState.videosCompleted,
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

    // Deduplicate: track video completion separately from images
    if (
      (update.videoUrl || update.videoError) &&
      !this.storyState.videoScenesDone.includes(update.sceneIndex)
    ) {
      this.storyState.videoScenesDone.push(update.sceneIndex);
      this.storyState.videosCompleted++;
    }

    // Check completion: videos + audio
    const videosAllDone = this.storyState.videosCompleted >= this.storyState.totalScenes;
    const voiceOverEnabled = this.storyState.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || this.storyState.audioCompleted >= this.storyState.totalScenes;
    const allDone = videosAllDone && audioAllDone;

    const isComplete = allDone && !this.storyState.completionSignaled;
    if (isComplete) {
      this.storyState.completionSignaled = true;
    }

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Video updated for scene ${update.sceneIndex}, total: ${this.storyState.videosCompleted}/${this.storyState.totalScenes}`);

    // Note: Progress updates removed - only completion is broadcasted

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: this.storyState.imagesCompleted,
      videosCompleted: this.storyState.videosCompleted,
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
      if (!this.storyState.videoScenesDone) this.storyState.videoScenesDone = [];
      if (!this.storyState.audioScenesDone) this.storyState.audioScenesDone = [];
      if (this.storyState.videosCompleted === undefined) this.storyState.videosCompleted = 0;
    }

    // Check if cancelled
    if (this.storyState.isCancelled) {
      return new Response(JSON.stringify({ 
        error: 'Job cancelled', 
        isCancelled: true,
        imagesCompleted: this.storyState.imagesCompleted,
        videosCompleted: this.storyState.videosCompleted,
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
        sceneUpdate.videoDuration = sceneUpdate.duration; // Cache original before audio replaces it
        sceneUpdate.duration = update.audioDuration;
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

    const imagesAllDone = this.storyState.imagesCompleted >= this.storyState.totalScenes;
    const videosAllDone = this.storyState.videosCompleted >= this.storyState.totalScenes;
    const voiceOverEnabled = this.storyState.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || this.storyState.audioCompleted >= this.storyState.totalScenes;
    const isImageOnlyStory = this.storyState.videoConfig?.mediaType !== 'video';

    const isImagesCompleteForReview = imagesAllDone && audioAllDone;
    const allDone = isImageOnlyStory
      ? (imagesAllDone && audioAllDone)
      : (videosAllDone && audioAllDone);

    const isComplete = this.storyState.sceneReviewRequired
      ? (isImagesCompleteForReview && !this.storyState.completionSignaled)
      : (allDone && !this.storyState.completionSignaled);

    if (isComplete) {
      this.storyState.completionSignaled = true;
    }

    // Persist
    await this.state.storage.put('storyState', this.storyState);

    console.log(`[StoryCoordinator] Audio updated for scene ${update.sceneIndex}, total: ${this.storyState.audioCompleted}/${this.storyState.totalScenes}`);

    // Note: Progress updates removed - only completion is broadcasted

    // Gate: scene is ready to queue video when it has both a generated image AND real audio duration
    const voiceOverEnabledAudio = this.storyState.videoConfig?.enableVoiceOver !== false;
    const updatedSceneForAudioGate = this.storyState.scenes[update.sceneIndex];
    const sceneHasImageAudio = !!(updatedSceneForAudioGate?.generatedImageUrl);
    const sceneHasAudioAudio = !!(updatedSceneForAudioGate?.audioDuration && updatedSceneForAudioGate.audioDuration > 0);
    const isSceneReadyForVideoAudio = sceneHasImageAudio && (sceneHasAudioAudio || !voiceOverEnabledAudio);
    const sceneImageUrlAudio = updatedSceneForAudioGate?.generatedImageUrl || null;
    const sceneAudioDurationAudio: number = updatedSceneForAudioGate?.audioDuration || 0;

    return new Response(JSON.stringify({
      success: true,
      imagesCompleted: this.storyState.imagesCompleted,
      videosCompleted: this.storyState.videosCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
      isSceneReadyForVideo: isSceneReadyForVideoAudio,
      sceneImageUrl: sceneImageUrlAudio,
      sceneAudioDuration: sceneAudioDurationAudio,
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
        videosCompleted: 0,
        audioCompleted: 0,
        totalScenes: 0,
        isComplete: false,
        isCancelled: false,
      }));
    }

    const imagesAllDone = this.storyState.imagesCompleted >= this.storyState.totalScenes;
    const videosAllDone = this.storyState.videosCompleted >= this.storyState.totalScenes;
    const voiceOverEnabled = this.storyState.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || this.storyState.audioCompleted >= this.storyState.totalScenes;
    const isComplete = (imagesAllDone && audioAllDone) || (videosAllDone && audioAllDone);

    return new Response(JSON.stringify({
      imagesCompleted: this.storyState.imagesCompleted,
      videosCompleted: this.storyState.videosCompleted,
      audioCompleted: this.storyState.audioCompleted,
      totalScenes: this.storyState.totalScenes,
      isComplete,
      completionSignaled: this.storyState.completionSignaled || false,
      isCancelled: this.storyState.isCancelled || false,
      scenes: this.storyState.scenes,
      videoConfig: this.storyState.videoConfig,
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

    const videosAllDone = this.storyState.videosCompleted >= this.storyState.totalScenes;
    const imagesAllDone = this.storyState.imagesCompleted >= this.storyState.totalScenes;
    const voiceOverEnabled = this.storyState.videoConfig?.enableVoiceOver !== false;
    const audioAllDone = !voiceOverEnabled || this.storyState.audioCompleted >= this.storyState.totalScenes;

    // For two-step flow: can finalize when images + audio done
    // For auto flow: can finalize when videos + audio done
    const isComplete = (imagesAllDone && audioAllDone) || (videosAllDone && audioAllDone);

    if (!isComplete) {
      return new Response(JSON.stringify({
        success: false,
        isComplete: false,
        imagesCompleted: this.storyState.imagesCompleted,
        videosCompleted: this.storyState.videosCompleted,
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
      videosCompleted: this.storyState.videosCompleted,
      audioCompleted: this.storyState.audioCompleted,
      timeline,
    };

    // Clean up durable storage after finalization
    await this.state.storage.deleteAll();
    this.storyState = null;

    console.log(`[StoryCoordinator] Finalized and cleaned up with compiled timeline`);

    return new Response(JSON.stringify(result));
  }

  // ==================== SSE Methods ====================

  /**
   * Handle SSE connection - keeps connection open for real-time updates
   * GET /sse?storyId=xxx
   */
  private async handleSSE(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const storyId = url.searchParams.get('storyId');

    if (!storyId) {
      return new Response('Missing storyId parameter', { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    console.log(`[StoryCoordinator] SSE client connecting for story: ${storyId}`);

    // Initialize clients Set for this story if not exists
    if (!this.sseClients.has(storyId)) {
      this.sseClients.set(storyId, new Set());
    }

    // Store reference to sseClients for use in callbacks
    const sseClients = this.sseClients;
    let clientController: ReadableStreamDefaultController<Uint8Array> | undefined;
    
    const stream = new ReadableStream({
      start(controller) {
        try {
          clientController = controller;
          sseClients.get(storyId)?.add(controller);

          // Send initial connection message
          const encoder = new TextEncoder();
          const message = `data: ${JSON.stringify({ type: 'connected', storyId })}\n\n`;
          controller.enqueue(encoder.encode(message));

          console.log(`[StoryCoordinator] SSE client registered for story: ${storyId}, total: ${sseClients.get(storyId)?.size}`);
        } catch (error) {
          console.error(`[StoryCoordinator] Error starting SSE stream:`, error);
          controller.error(error);
        }
      },
      cancel(reason) {
        console.log(`[StoryCoordinator] SSE client disconnected for story: ${storyId}, reason:`, reason);
        
        if (clientController) {
          sseClients.get(storyId)?.delete(clientController);
        }

        if (sseClients.get(storyId)?.size === 0) {
          sseClients.delete(storyId);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  /**
   * Handle broadcast - send message to all SSE clients for a story
   * POST /broadcast with body { storyId, data }
   */
  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const { storyId, data } = await request.json() as { storyId: string; data: any };
      
      if (!storyId) {
        return new Response(JSON.stringify({ error: 'Missing storyId' }), { status: 400 });
      }

      this.broadcastToSSE(storyId, data);
      return new Response(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('[StoryCoordinator] Error in handleBroadcast:', error);
      return new Response(JSON.stringify({ error: 'Failed to broadcast' }), { status: 500 });
    }
  }

  /**
   * Broadcast message to all SSE clients for a story
   */
  private broadcastToSSE(storyId: string, data: any): void {
    const clients = this.sseClients.get(storyId);
    if (!clients || clients.size === 0) {
      console.log(`[StoryCoordinator] No SSE clients to broadcast for story: ${storyId}`);
      return;
    }

    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    console.log(`[StoryCoordinator] Broadcasting to ${clients.size} SSE clients for story: ${storyId}`);

    for (const controller of clients) {
      try {
        controller.enqueue(encodedMessage);
      } catch (error) {
        // Client disconnected, remove
        clients.delete(controller);
        console.log(`[StoryCoordinator] Removed disconnected SSE client for story: ${storyId}`);
      }
    }

    // Clean up empty client sets
    if (clients.size === 0) {
      this.sseClients.delete(storyId);
    }
  }
}

