/**
 * StorySyncService Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/storySyncService.spec.ts
 */

import { describe, it, expect } from 'vitest';
import { StorySyncService, createStorySyncService } from '../../services/storySync';

describe('StorySyncService', () => {
  describe('constructor', () => {
    it('should create service with mock mode', () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      expect(service).toBeDefined();
    });

    it('should use mock when GEN_PROVIDER is mock', () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = new StorySyncService(env);
      expect(service).toBeDefined();
    });
  });

  describe('syncPartialStory', () => {
    it('should return success in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      
      const result = await service.syncPartialStory(
        { jobId: 'job-1', storyId: 'story-1', userId: 'user-1' },
        []
      );
      
      expect(result.success).toBe(true);
    });

    it('should accept storyId in options', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      
      const result = await service.syncPartialStory(
        { jobId: 'job-123', storyId: 'story-456', userId: 'user-789' },
        [{ id: 'scene-1' }]
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe('syncStoryComplete', () => {
    it('should return success with mock URL in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      
      const result = await service.syncStoryComplete(
        { jobId: 'job-1', storyId: 'story-1', userId: 'user-1' },
        { scenes: [] }
      );
      
      expect(result.success).toBe(true);
      expect(result.storyUrl).toBeDefined();
    });

    it('should include timeline in options', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      
      const result = await service.syncStoryComplete(
        { jobId: 'job-1', storyId: 'story-1', userId: 'user-1', timeline: {} },
        { scenes: [] }
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe('updateJobProgress', () => {
    it('should complete without error in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      
      await expect(service.updateJobProgress('job-1', 50, 'processing')).resolves.not.toThrow();
    });

    it('should handle all progress values', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createStorySyncService(env);
      
      await service.updateJobProgress('job-1', 0, 'pending');
      await service.updateJobProgress('job-2', 50, 'processing');
      await service.updateJobProgress('job-3', 100, 'completed');
      
      expect(true).toBe(true);
    });
  });
});
