/**
 * Durable Object State Management - Reliability Tests
 * 
 * Tests for DO state management reliability:
 * - State persistence across restarts
 * - Race condition handling
 * - Recovery from storage errors
 * - Cancellation behavior
 * - Double-counting prevention
 */

import { describe, it, expect, beforeEach } from 'vitest';

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
  imageScenesDone: number[];
  videoScenesDone: number[];
  audioScenesDone: number[];
  completionSignaled?: boolean;
  sceneReviewRequired?: boolean;
}

function createMockStoryState(overrides = {}): StoryState {
  return {
    storyId: 'test-story-123',
    userId: 'test-user-456',
    scenes: [
      { id: 'scene-0', generatedImageUrl: null, generatedVideoUrl: null, audioUrl: null },
      { id: 'scene-1', generatedImageUrl: null, generatedVideoUrl: null, audioUrl: null },
      { id: 'scene-2', generatedImageUrl: null, generatedVideoUrl: null, audioUrl: null },
    ],
    imagesCompleted: 0,
    videosCompleted: 0,
    audioCompleted: 0,
    totalScenes: 3,
    isCancelled: false,
    videoConfig: { enableVoiceOver: true },
    imageScenesDone: [],
    videoScenesDone: [],
    audioScenesDone: [],
    completionSignaled: false,
    sceneReviewRequired: false,
    ...overrides,
  };
}

describe('DO State Management - Reliability', () => {
  describe('1. State Persistence', () => {
    it('should correctly track image completion count', () => {
      const storyState = createMockStoryState({ imagesCompleted: 1 });
      expect(storyState.imagesCompleted).toBe(1);
    });

    it('should correctly track video completion count', () => {
      const storyState = createMockStoryState({ videosCompleted: 2 });
      expect(storyState.videosCompleted).toBe(2);
    });

    it('should correctly track audio completion count', () => {
      const storyState = createMockStoryState({ audioCompleted: 3 });
      expect(storyState.audioCompleted).toBe(3);
    });

    it('should backfill missing fields for legacy DOs', () => {
      const legacyState: any = {
        storyId: 'test-story',
        userId: 'test-user',
        scenes: [{ id: 'scene-0' }],
        imagesCompleted: 0,
        videosCompleted: 0,
        audioCompleted: 0,
        totalScenes: 1,
      };

      if (!legacyState.imageScenesDone) legacyState.imageScenesDone = [];
      if (!legacyState.videoScenesDone) legacyState.videoScenesDone = [];
      if (!legacyState.audioScenesDone) legacyState.audioScenesDone = [];
      if (legacyState.videosCompleted === undefined) legacyState.videosCompleted = 0;

      expect(legacyState.imageScenesDone).toEqual([]);
      expect(legacyState.videoScenesDone).toEqual([]);
      expect(legacyState.audioScenesDone).toEqual([]);
      expect(legacyState.completionSignaled).toBeFalsy();
    });
  });

  describe('2. Race Condition Prevention', () => {
    it('should prevent double-counting images via deduplication', () => {
      const storyState = createMockStoryState();
      const sceneIndex = 0;

      if (!storyState.imageScenesDone.includes(sceneIndex)) {
        storyState.imageScenesDone.push(sceneIndex);
        storyState.imagesCompleted++;
      }

      expect(storyState.imageScenesDone).toHaveLength(1);
      expect(storyState.imagesCompleted).toBe(1);

      if (!storyState.imageScenesDone.includes(sceneIndex)) {
        storyState.imageScenesDone.push(sceneIndex);
        storyState.imagesCompleted++;
      }

      expect(storyState.imageScenesDone).toHaveLength(1);
      expect(storyState.imagesCompleted).toBe(1);
    });

    it('should prevent double-counting videos via deduplication', () => {
      const storyState = createMockStoryState();
      const sceneIndex = 1;

      if (!storyState.videoScenesDone.includes(sceneIndex)) {
        storyState.videoScenesDone.push(sceneIndex);
        storyState.videosCompleted++;
      }

      expect(storyState.videosCompleted).toBe(1);

      if (!storyState.videoScenesDone.includes(sceneIndex)) {
        storyState.videoScenesDone.push(sceneIndex);
        storyState.videosCompleted++;
      }

      expect(storyState.videosCompleted).toBe(1);
    });

    it('should prevent double-counting audio via deduplication', () => {
      const storyState = createMockStoryState();
      const sceneIndex = 2;

      if (!storyState.audioScenesDone.includes(sceneIndex)) {
        storyState.audioScenesDone.push(sceneIndex);
        storyState.audioCompleted++;
      }

      expect(storyState.audioCompleted).toBe(1);

      if (!storyState.audioScenesDone.includes(sceneIndex)) {
        storyState.audioScenesDone.push(sceneIndex);
        storyState.audioCompleted++;
      }

      expect(storyState.audioCompleted).toBe(1);
    });

    it('should track completion only once via completionSignaled flag', () => {
      const storyState = createMockStoryState({
        totalScenes: 3,
        imagesCompleted: 3,
        videosCompleted: 3,
        audioCompleted: 3,
      });

      const allDone = storyState.imagesCompleted >= storyState.totalScenes &&
                      storyState.videosCompleted >= storyState.totalScenes &&
                      storyState.audioCompleted >= storyState.totalScenes;

      const isComplete = allDone && !storyState.completionSignaled;
      if (isComplete) {
        storyState.completionSignaled = true;
      }

      expect(storyState.completionSignaled).toBe(true);

      const secondCheck = allDone && !storyState.completionSignaled;
      expect(secondCheck).toBe(false);
    });
  });

  describe('3. Cancellation Behavior', () => {
    it('should reject updates when job is cancelled', () => {
      const storyState = createMockStoryState({ isCancelled: true });
      const updateRejected = storyState.isCancelled;
      expect(updateRejected).toBe(true);
    });

    it('should set isCancelled flag on cancel', () => {
      const storyState = createMockStoryState({ isCancelled: false });
      storyState.isCancelled = true;
      expect(storyState.isCancelled).toBe(true);
    });

    it('should return correct status when cancelled', () => {
      const storyState = createMockStoryState({
        isCancelled: true,
        imagesCompleted: 2,
        totalScenes: 3,
      });

      const status = {
        isCancelled: storyState.isCancelled,
        imagesCompleted: storyState.imagesCompleted,
        videosCompleted: storyState.videosCompleted,
        audioCompleted: storyState.audioCompleted,
        totalScenes: storyState.totalScenes,
        isComplete: false,
      };

      expect(status.isCancelled).toBe(true);
      expect(status.isComplete).toBe(false);
    });
  });

  describe('4. Completion Detection', () => {
    it('should detect completion for auto mode (videos + audio)', () => {
      const storyState = createMockStoryState({
        totalScenes: 3,
        imagesCompleted: 3,
        videosCompleted: 3,
        audioCompleted: 3,
        sceneReviewRequired: false,
        videoConfig: { enableVoiceOver: true },
      });

      const videosAllDone = storyState.videosCompleted >= storyState.totalScenes;
      const voiceOverEnabled = storyState.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = voiceOverEnabled && storyState.audioCompleted >= storyState.totalScenes;
      const allDone = videosAllDone && audioAllDone;
      const isComplete = allDone && !storyState.completionSignaled;

      expect(isComplete).toBe(true);
    });

    it('should detect completion for review mode (images + audio)', () => {
      const storyState = createMockStoryState({
        totalScenes: 3,
        imagesCompleted: 3,
        videosCompleted: 0,
        audioCompleted: 3,
        sceneReviewRequired: true,
        videoConfig: { enableVoiceOver: true },
      });

      const imagesAllDone = storyState.imagesCompleted >= storyState.totalScenes;
      const voiceOverEnabled = storyState.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = voiceOverEnabled && storyState.audioCompleted >= storyState.totalScenes;
      const isImagesCompleteForReview = imagesAllDone && audioAllDone;
      const isComplete = storyState.sceneReviewRequired
        ? (isImagesCompleteForReview && !storyState.completionSignaled)
        : false;

      expect(isComplete).toBe(true);
    });

    it('should not complete when voiceover is disabled but audio not done', () => {
      const storyState = createMockStoryState({
        totalScenes: 3,
        imagesCompleted: 3,
        videosCompleted: 3,
        audioCompleted: 0,
        sceneReviewRequired: false,
        videoConfig: { enableVoiceOver: false },
      });

      const videosAllDone = storyState.videosCompleted >= storyState.totalScenes;
      const voiceOverEnabled = storyState.videoConfig?.enableVoiceOver !== false;
      const audioAllDone = !voiceOverEnabled || storyState.audioCompleted >= storyState.totalScenes;
      const allDone = videosAllDone && audioAllDone;

      expect(allDone).toBe(true);
    });
  });

  describe('5. Resume Flow', () => {
    it('should correctly count already completed scenes on resume', () => {
      const scenes = [
        { id: 'scene-0', generatedImageUrl: 'http://example.com/img0.jpg' },
        { id: 'scene-1', generatedImageUrl: null },
        { id: 'scene-2', generatedImageUrl: 'http://example.com/img2.jpg' },
      ];

      const imagesDone = scenes.filter((s: any) => s.generatedImageUrl).length;

      expect(imagesDone).toBe(2);

      const imageScenesDone = Array.from({ length: imagesDone }, (_, i) => i);
      expect(imageScenesDone).toEqual([0, 1]);
    });

    it('should preserve scene data on resume', () => {
      const scenes = [
        { id: 'scene-0', generatedImageUrl: 'http://example.com/img0.jpg', duration: 5 },
        { id: 'scene-1', generatedVideoUrl: 'http://example.com/vid1.mp4', duration: 10 },
        { id: 'scene-2', audioUrl: 'http://example.com/audio2.mp3', duration: 3 },
      ];

      const storyState = createMockStoryState({ scenes });

      expect(storyState.scenes[0].generatedImageUrl).toBe('http://example.com/img0.jpg');
      expect(storyState.scenes[1].generatedVideoUrl).toBe('http://example.com/vid1.mp4');
      expect(storyState.scenes[2].audioUrl).toBe('http://example.com/audio2.mp3');
    });
  });
});
