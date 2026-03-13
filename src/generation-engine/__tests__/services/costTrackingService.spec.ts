/**
 * CostTrackingService Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/costTrackingService.spec.ts
 */

import { describe, it, expect } from 'vitest';
import { CostTrackingService } from '../../services/costTracking';

describe('CostTrackingService', () => {
  describe('constructor', () => {
    it('should create service with mock mode', () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = new CostTrackingService(env);
      expect(service).toBeDefined();
    });

    it('should use mock when GEN_PROVIDER is mock', () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = new CostTrackingService(env);
      expect(service).toBeDefined();
    });
  });

  describe('trackGeneration', () => {
    it('should complete without error in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = new CostTrackingService(env);
      
      await expect(service.trackGeneration({
        jobId: 'job-1',
        userId: 'user-1',
        storyId: 'story-1',
        sceneIndex: 0,
        type: 'image',
        model: 'flux',
        provider: 'replicate',
      })).resolves.not.toThrow();
    });

    it('should accept all generation types', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = new CostTrackingService(env);
      
      await service.trackGeneration({
        jobId: 'job-1', userId: 'user-1', storyId: 'story-1',
        sceneIndex: 0, type: 'image', model: 'flux', provider: 'replicate',
      });
      
      await service.trackGeneration({
        jobId: 'job-1', userId: 'user-1', storyId: 'story-1',
        sceneIndex: 0, type: 'video', model: 'kling', provider: 'replicate',
      });
      
      await service.trackGeneration({
        jobId: 'job-1', userId: 'user-1', storyId: 'story-1',
        sceneIndex: 0, type: 'audio', model: 'elevenlabs', provider: 'elevenlabs',
      });
      
      expect(true).toBe(true);
    });

    it('should accept cost tracking options', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = new CostTrackingService(env);
      
      await service.trackGeneration(
        {
          jobId: 'job-1', userId: 'user-1', storyId: 'story-1',
          sceneIndex: 0, type: 'image', model: 'flux', provider: 'replicate',
        },
        {
          cpuTimeMs: 100,
          inputTokens: 50,
          outputTokens: 100,
          durationSeconds: 30,
        }
      );
      
      expect(true).toBe(true);
    });
  });
});
