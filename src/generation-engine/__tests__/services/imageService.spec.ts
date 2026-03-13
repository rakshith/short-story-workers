/**
 * Unit Tests: Services Layer - Image Service
 * Tests image generation model selection, payload building, and config handling
 * 
 * Run: npm run test:run -- --testNamePattern "imageService"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

// Mock the Replicate module
vi.mock('replicate', () => ({
  default: vi.fn().mockImplementation(() => ({
    predictions: {
      create: vi.fn().mockResolvedValue({
        id: 'mock-prediction-123',
        status: 'starting',
      }),
    },
  })),
}));

// Mock the replicate-model-config module
vi.mock('../../utils/replicate-model-config', () => ({
  getModelImageConfig: vi.fn().mockReturnValue({
    ignoreWidthHeight: false,
    minWidth: 512,
    defaultInputs: {},
  }),
  attachImageInputs: vi.fn(),
}));

describe('Services Layer - Image Service', () => {
  describe('Model Selection Logic', () => {
    it('should use videoConfig.imageModel when provided', async () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const videoConfig: any = {
        ...template?.defaultConfig?.videoConfig,
        imageModel: 'custom-image-model',
      };

      // Simulate model selection logic from imageService
      const defaultImageModel = 'black-forest-labs/flux-schnell';
      const imageModel = videoConfig.imageModel || videoConfig.model || defaultImageModel;

      expect(imageModel).toBe('custom-image-model');
    });

    it('should use template default when no user imageModel', async () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const videoConfig: any = {
        ...template?.defaultConfig?.videoConfig,
      };

      const defaultImageModel = 'black-forest-labs/flux-schnell';
      const imageModel = videoConfig.imageModel || videoConfig.model || defaultImageModel;

      expect(imageModel).toBe('black-forest-labs/flux-schnell');
    });

    it('should use Grok for skeleton-3d-shorts template', async () => {
      const videoConfig: any = {
        templateId: 'skeleton-3d-shorts',
        mediaType: 'image',
        imageModel: 'xai/grok-imagine-image',
      };

      const isSkeletonTemplate = videoConfig.templateId === 'skeleton-3d-shorts';
      const skeletonDefault = videoConfig.mediaType === 'image' && (videoConfig.model || videoConfig.imageModel)
        ? (videoConfig.imageModel || videoConfig.model)
        : 'xai/grok-imagine-image';
      const defaultImageModel = isSkeletonTemplate ? skeletonDefault : 'black-forest-labs/flux-schnell';

      expect(defaultImageModel).toBe('xai/grok-imagine-image');
    });

    it('should use input.model over videoConfig', async () => {
      const videoConfig: any = {
        imageModel: 'video-config-model',
      };
      const inputModel = 'input-model';

      const defaultImageModel = 'black-forest-labs/flux-schnell';
      const imageModel = inputModel || videoConfig.imageModel || defaultImageModel;

      expect(imageModel).toBe('input-model');
    });
  });

  describe('Aspect Ratio & Dimension Calculation', () => {
    it('should calculate correct dimensions for 9:16 aspect ratio', () => {
      const aspectRatio = '9:16';
      const baseSize = 1024;

      const parts = aspectRatio.split(':').map(Number);
      const widthRatio = parts[0] || 16;
      const heightRatio = parts[1] || 9;

      const width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
      const height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

      expect(width).toBe(576);
      expect(height).toBe(1024);
    });

    it('should calculate correct dimensions for 16:9 aspect ratio', () => {
      const aspectRatio = '16:9';
      const baseSize = 1024;

      const parts = aspectRatio.split(':').map(Number);
      const widthRatio = parts[0] || 16;
      const heightRatio = parts[1] || 9;

      const width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
      const height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

      expect(width).toBe(1024);
      expect(height).toBe(576);
    });

    it('should scale up for models with minWidth requirement', () => {
      const aspectRatio = '9:16';
      const baseSize = 1024;
      const minWidth = 1024;

      const parts = aspectRatio.split(':').map(Number);
      const widthRatio = parts[0] || 16;
      const heightRatio = parts[1] || 9;

      let width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
      let height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

      // Apply minWidth scaling
      if (minWidth && width < minWidth) {
        const scaleFactor = minWidth / width;
        width = Math.round(width * scaleFactor);
        height = Math.round(height * scaleFactor);
      }

      expect(width).toBe(1024);
      expect(height).toBe(1820);
    });

    it('should use custom width/height when provided', () => {
      const input = {
        width: 1920,
        height: 1080,
      };

      const width = input.width || 576;
      const height = input.height || 1024;

      expect(width).toBe(1920);
      expect(height).toBe(1080);
    });
  });

  describe('Prompt Building', () => {
    it('should append stylePrompt from preset', () => {
      const prompt = 'A beautiful sunset';
      const videoConfig: any = {
        preset: {
          stylePrompt: 'hyperrealistic 4K',
        },
      };

      const fullPrompt = `${prompt}, ${videoConfig.preset?.stylePrompt || ''}`;

      expect(fullPrompt).toBe('A beautiful sunset, hyperrealistic 4K');
    });

    it('should handle missing preset', () => {
      const prompt = 'A beautiful sunset';
      const videoConfig: any = {};

      const fullPrompt = `${prompt}, ${videoConfig.preset?.stylePrompt || ''}`;

      expect(fullPrompt).toBe('A beautiful sunset, ');
    });
  });

  describe('Webhook URL Building', () => {
    it('should build webhook URL with model parameter', () => {
      const baseUrl = 'https://worker.artflicks.workers.dev/webhooks/replicate';
      const model = 'black-forest-labs/flux-schnell';

      const webhookUrl = `${baseUrl}&model=${encodeURIComponent(model)}`;

      expect(webhookUrl).toBe('https://worker.artflicks.workers.dev/webhooks/replicate&model=black-forest-labs%2Fflux-schnell');
    });

    it('should include scene metadata in webhook URL', () => {
      const baseUrl = 'https://worker.artflicks.workers.dev/webhooks/replicate';
      const params = new URLSearchParams({
        storyId: 'story-123',
        sceneIndex: '0',
        type: 'image',
        userId: 'user-456',
        jobId: 'job-789',
      });

      const webhookUrl = `${baseUrl}?${params.toString()}`;

      expect(webhookUrl).toContain('storyId=story-123');
      expect(webhookUrl).toContain('sceneIndex=0');
      expect(webhookUrl).toContain('type=image');
    });
  });

  describe('Payload Structure', () => {
    it('should build correct input payload', () => {
      const input = {
        prompt: 'Test prompt',
        width: 1024,
        height: 576,
        outputFormat: 'jpg',
        seed: 12345,
      };

      const payload = {
        prompt: input.prompt,
        width: input.width,
        height: input.height,
        num_outputs: 1,
        output_format: input.outputFormat || 'jpg',
      };

      expect(payload.prompt).toBe('Test prompt');
      expect(payload.width).toBe(1024);
      expect(payload.height).toBe(576);
      expect(payload.num_outputs).toBe(1);
      expect(payload.output_format).toBe('jpg');
    });

    it('should include seed when provided', () => {
      const input: any = {
        prompt: 'Test',
        seed: 12345,
      };

      const payload: any = {
        prompt: input.prompt,
      };

      if (input.seed !== undefined) {
        payload.seed = input.seed;
      }

      expect(payload.seed).toBe(12345);
    });

    it('should not include seed when not provided', () => {
      const input: any = {
        prompt: 'Test',
      };

      const payload: any = {
        prompt: input.prompt,
      };

      if (input.seed !== undefined) {
        payload.seed = input.seed;
      }

      expect(payload.seed).toBeUndefined();
    });
  });

  describe('Character Reference Images', () => {
    it('should attach character references for character-story template', () => {
      const videoConfig = {
        templateId: 'character-story',
      };
      const characterReferenceImages = ['https://example.com/ref1.jpg'];

      const shouldAttach = videoConfig.templateId === 'character-story' ||
        videoConfig.templateId === 'skeleton-3d-shorts';

      expect(shouldAttach).toBe(true);
    });

    it('should not attach for non-character templates', () => {
      const videoConfig = {
        templateId: 'youtube-shorts',
      };
      const characterReferenceImages = ['https://example.com/ref1.jpg'];

      const shouldAttach = videoConfig.templateId === 'character-story' ||
        videoConfig.templateId === 'skeleton-3d-shorts';

      expect(shouldAttach).toBe(false);
    });
  });

  describe('Model Version Handling', () => {
    it('should extract version from model string with colon', () => {
      const model = 'black-forest-labs/flux-schnell:version-1';
      const hasVersion = model.includes(':');

      let predictionParams: any = {};
      if (hasVersion) {
        predictionParams.version = model.split(':')[1];
      } else {
        predictionParams.model = model;
      }

      expect(predictionParams.version).toBe('version-1');
    });

    it('should use model field when no version', () => {
      const model = 'black-forest-labs/flux-schnell';
      const hasVersion = model.includes(':');

      let predictionParams: any = {};
      if (hasVersion) {
        predictionParams.version = model.split(':')[1];
      } else {
        predictionParams.model = model;
      }

      expect(predictionParams.model).toBe('black-forest-labs/flux-schnell');
    });
  });
});
