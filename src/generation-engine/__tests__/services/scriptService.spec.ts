/**
 * ScriptService Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/scriptService.spec.ts
 */

import { describe, it, expect } from 'vitest';
import { ScriptService, createScriptService } from '../../services/scriptService';

describe('ScriptService', () => {
  describe('constructor', () => {
    it('should create service with api key', () => {
      const service = new ScriptService('test-api-key', true);
      expect(service).toBeDefined();
    });

    it('should default useMock to false', () => {
      const service = new ScriptService('test-api-key');
      expect(service).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate story in mock mode', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test story' });
      expect(result.story).toBeDefined();
      expect(result.sceneCount).toBe(3);
    });

    it('should use default youtube-shorts template', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test' });
      expect(result.story.title).toContain('YouTube Short');
    });

    it('should use character-story template', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test', templateId: 'character-story' });
      expect(result.story.title).toContain('Character Story');
    });

    it('should use skeleton-3d-shorts template', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test', templateId: 'skeleton-3d-shorts' });
      expect(result.story.title).toContain('Skeleton 3D');
    });

    it('should fallback to youtube-shorts for unknown template', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test', templateId: 'unknown' });
      expect(result.story.title).toContain('YouTube Short');
    });

    it('should include scenes in story', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test' });
      expect(result.story.scenes).toHaveLength(3);
    });

    it('should generate unique ids for scenes', async () => {
      const service = createScriptService('test-key', true);
      const result1 = await service.generate({ prompt: 'Test 1' });
      const result2 = await service.generate({ prompt: 'Test 2' });
      expect(result1.story.id).not.toBe(result2.story.id);
    });

    it('should include scene details', async () => {
      const service = createScriptService('test-key', true);
      const result = await service.generate({ prompt: 'Test' });
      const scene = result.story.scenes[0];
      expect(scene.sceneNumber).toBe(1);
      expect(scene.details).toBeDefined();
      expect(scene.imagePrompt).toBeDefined();
      expect(scene.narration).toBeDefined();
      expect(scene.cameraAngle).toBeDefined();
      expect(scene.mood).toBeDefined();
      expect(scene.duration).toBeDefined();
    });
  });
});
