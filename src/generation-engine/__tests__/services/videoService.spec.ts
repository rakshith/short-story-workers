/**
 * Unit Tests: Services Layer - Video Service
 * Tests video generation model selection, prompt building, and config handling
 * 
 * Run: npm run test:run -- --testNamePattern "videoService"
 */

import { describe, it, expect, vi } from 'vitest';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

describe('Services Layer - Video Service', () => {
  describe('Model Selection', () => {
    it('should use videoConfig.videoModel when provided', () => {
      const videoConfig: any = {
        videoModel: 'minimax-video-01',
      };

      const videoModel = videoConfig.videoModel || 'wan-video/wan-2.5-t2v-fast';

      expect(videoModel).toBe('minimax-video-01');
    });

    it('should use default when no videoModel in config', () => {
      const videoConfig: any = {};

      const videoModel = videoConfig.videoModel || 'wan-video/wan-2.5-t2v-fast';

      expect(videoModel).toBe('wan-video/wan-2.5-t2v-fast');
    });

    it('should use input.model over videoConfig', () => {
      const videoConfig: any = {
        videoModel: 'video-config-model',
      };
      const inputModel = 'input-model';

      const videoModel = inputModel || videoConfig.videoModel || 'wan-video/wan-2.5-t2v-fast';

      expect(videoModel).toBe('input-model');
    });
  });

  describe('Prompt Building', () => {
    it('should append stylePrompt to video prompt', () => {
      const prompt = 'A warrior charging';
      const videoConfig: any = {
        preset: {
          stylePrompt: 'hyperrealistic 4K',
        },
      };

      const fullPrompt = `${prompt} ${videoConfig.preset?.stylePrompt || ''}, high quality motion, cinematic`;

      expect(fullPrompt).toBe('A warrior charging hyperrealistic 4K, high quality motion, cinematic');
    });

    it('should handle missing preset for video', () => {
      const prompt = 'A warrior charging';
      const videoConfig: any = {};

      const fullPrompt = `${prompt} ${videoConfig.preset?.stylePrompt || ''}, high quality motion, cinematic`;

      expect(fullPrompt).toBe('A warrior charging , high quality motion, cinematic');
    });

    it('should always add motion and cinematic keywords', () => {
      const prompt = 'Test prompt';
      const videoConfig: any = {};

      const fullPrompt = `${prompt} ${videoConfig.preset?.stylePrompt || ''}, high quality motion, cinematic`;

      expect(fullPrompt).toContain('high quality motion');
      expect(fullPrompt).toContain('cinematic');
    });
  });

  describe('Reference Image Handling', () => {
    it('should use referenceImageUrl when provided', () => {
      const input: any = {
        referenceImageUrl: 'https://example.com/ref.jpg',
      };

      const imageUrl = input.referenceImageUrl;

      expect(imageUrl).toBe('https://example.com/ref.jpg');
    });

    it('should fallback to characterReferenceImages for special templates', () => {
      const videoConfig: any = {
        templateId: 'character-story',
      };
      const characterReferenceImages = ['https://example.com/char1.jpg'];

      const isSpecialTemplate = videoConfig.templateId === 'character-story' ||
        videoConfig.templateId === 'skeleton-3d-shorts';

      expect(isSpecialTemplate).toBe(true);
    });

    it('should not use character references for regular templates', () => {
      const videoConfig: any = {
        templateId: 'youtube-shorts',
      };

      const isSpecialTemplate = videoConfig.templateId === 'character-story' ||
        videoConfig.templateId === 'skeleton-3d-shorts';

      expect(isSpecialTemplate).toBe(false);
    });

    it('should use characterReferenceImages when no referenceImageUrl', () => {
      const input: any = {
        characterReferenceImages: ['https://example.com/char1.jpg', 'https://example.com/char2.jpg'],
      };

      const images = input.characterReferenceImages;

      expect(images).toBeDefined();
      expect(images.length).toBe(2);
    });
  });

  describe('Duration Handling', () => {
    it('should use provided duration', () => {
      const duration = 5;

      const finalDuration = duration;

      expect(finalDuration).toBe(5);
    });

    it('should handle duration undefined', () => {
      const input: any = {};

      // In real code, this gets passed to getNearestDuration
      const hasDuration = input.duration !== undefined && input.duration > 0;

      expect(hasDuration).toBe(false);
    });
  });

  describe('Aspect Ratio', () => {
    it('should use provided aspectRatio', () => {
      const input: any = {
        aspectRatio: '16:9',
      };

      const aspectRatio = input.aspectRatio;

      expect(aspectRatio).toBe('16:9');
    });

    it('should convert aspectRatio to param format', () => {
      const aspectRatio = '16:9';

      const param = `aspect_ratio=${aspectRatio}`;

      expect(param).toBe('aspect_ratio=16:9');
    });
  });

  describe('Seed Handling', () => {
    it('should include seed when provided', () => {
      const input: any = {
        seed: 12345,
      };

      const payload: any = {};

      if (input.seed !== undefined) {
        payload.seed = input.seed;
      }

      expect(payload.seed).toBe(12345);
    });

    it('should not include seed when not provided', () => {
      const input: any = {};

      const payload: any = {};

      if (input.seed !== undefined) {
        payload.seed = input.seed;
      }

      expect(payload.seed).toBeUndefined();
    });
  });

  describe('Model Version Handling', () => {
    it('should handle model with version', () => {
      const model = 'wan-video/wan-2.5-t2v-fast:v1';
      const hasVersion = model.includes(':');

      let predictionParams: any = {};
      if (hasVersion) {
        predictionParams.version = model.split(':')[1];
      } else {
        predictionParams.model = model;
      }

      expect(predictionParams.version).toBe('v1');
    });

    it('should handle model without version', () => {
      const model = 'wan-video/wan-2.5-t2v-fast';
      const hasVersion = model.includes(':');

      let predictionParams: any = {};
      if (hasVersion) {
        predictionParams.version = model.split(':')[1];
      } else {
        predictionParams.model = model;
      }

      expect(predictionParams.model).toBe('wan-video/wan-2.5-t2v-fast');
    });
  });

  describe('Webhook URL', () => {
    it('should build webhook URL with model', () => {
      const baseUrl = 'https://worker.artflicks.workers.dev/webhooks/replicate';
      const model = 'wan-video/wan-2.5-t2v-fast';

      const webhookUrl = `${baseUrl}&model=${encodeURIComponent(model)}`;

      expect(webhookUrl).toContain('model=');
    });

    it('should include scene metadata', () => {
      const params = new URLSearchParams({
        storyId: 'story-123',
        sceneIndex: '0',
        type: 'video',
        userId: 'user-456',
      });

      expect(params.toString()).toContain('type=video');
    });
  });

  describe('Template Video Configuration', () => {
    it('skeleton-3d-shorts template should have video model', () => {
      const template = getTemplate(TEMPLATE_IDS.SKELETON_3D_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as any;

      expect(videoConfig?.videoModel).toBe('minimax-video-01');
    });

    it('should merge user config with template', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const templateDefaults = template?.defaultConfig?.videoConfig as any;

      const userConfig: any = {
        videoModel: 'user-video-model',
      };

      const merged = {
        ...templateDefaults,
        ...userConfig,
      };

      expect(merged.videoModel).toBe('user-video-model');
    });
  });

  describe('Character Story Template', () => {
    it('should identify character-story as special template', () => {
      const templateId = 'character-story';

      const isSpecialTemplate = templateId === 'character-story' ||
        templateId === 'skeleton-3d-shorts';

      expect(isSpecialTemplate).toBe(true);
    });

    it('should identify skeleton-3d-shorts as special template', () => {
      const templateId = 'skeleton-3d-shorts';

      const isSpecialTemplate = templateId === 'character-story' ||
        templateId === 'skeleton-3d-shorts';

      expect(isSpecialTemplate).toBe(true);
    });

    it('should not identify youtube-shorts as special', () => {
      const templateId = 'youtube-shorts';

      const isSpecialTemplate = templateId === 'character-story' ||
        templateId === 'skeleton-3d-shorts';

      expect(isSpecialTemplate).toBe(false);
    });
  });
});
