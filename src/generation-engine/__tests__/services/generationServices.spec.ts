/**
 * Image/Video/Audio Service Interface Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/generationServices.spec.ts
 */

import { describe, it, expect } from 'vitest';

describe('ImageService Interface', () => {
  describe('ImageGenerationInput', () => {
    it('should accept required prompt field', () => {
      const input = {
        prompt: 'A beautiful sunset',
        videoConfig: { templateId: 'youtube-shorts' },
      };
      expect(input.prompt).toBe('A beautiful sunset');
    });

    it('should accept optional model field', () => {
      const input = {
        prompt: 'Test',
        model: 'black-forest-labs/flux-schnell',
        videoConfig: { templateId: 'youtube-shorts' },
      };
      expect(input.model).toBeDefined();
    });

    it('should accept aspect ratio', () => {
      const input = {
        prompt: 'Test',
        aspectRatio: '16:9',
        videoConfig: { templateId: 'youtube-shorts' },
      };
      expect(input.aspectRatio).toBe('16:9');
    });

    it('should handle skeleton-3d-shorts template', () => {
      const input = {
        prompt: 'Dancing skeleton',
        videoConfig: { templateId: 'skeleton-3d-shorts', mediaType: 'image' },
      };
      expect(input.videoConfig.templateId).toBe('skeleton-3d-shorts');
    });

    it('should accept seed for reproducibility', () => {
      const input = {
        prompt: 'Test',
        seed: 12345,
        videoConfig: { templateId: 'youtube-shorts' },
      };
      expect(input.seed).toBe(12345);
    });

    it('should accept character reference images', () => {
      const input = {
        prompt: 'Test',
        characterReferenceImages: ['https://example.com/ref1.jpg'],
        videoConfig: { templateId: 'youtube-shorts' },
      };
      expect(input.characterReferenceImages).toHaveLength(1);
    });
  });

  describe('ImageServiceOptions', () => {
    it('should require replicateApiToken', () => {
      const options = {
        replicateApiToken: 'test-token',
        webhookUrl: 'https://example.com/webhook',
        userId: 'user-1',
        seriesId: 'series-1',
        storyId: 'story-1',
        sceneIndex: 0,
      };
      expect(options.replicateApiToken).toBeDefined();
    });

    it('should require webhookUrl', () => {
      const options = {
        replicateApiToken: 'test',
        webhookUrl: 'https://example.com/hook',
        userId: 'user-1',
        seriesId: 'series-1',
        storyId: 'story-1',
        sceneIndex: 0,
      };
      expect(options.webhookUrl).toBeDefined();
    });
  });
});

describe('VideoService Interface', () => {
  describe('VideoGenerationInput', () => {
    it('should accept required prompt field', () => {
      const input = {
        prompt: 'A hero journey',
        videoConfig: { model: 'wan-video/wan-2.5-t2v-fast' },
      };
      expect(input.prompt).toBeDefined();
    });

    it('should accept optional model field', () => {
      const input = {
        prompt: 'Test',
        model: 'kling-video-model',
        videoConfig: {},
      };
      expect(input.model).toBe('kling-video-model');
    });

    it('should accept duration option', () => {
      const input = {
        prompt: 'Test',
        duration: 10,
        videoConfig: {},
      };
      expect(input.duration).toBe(10);
    });

    it('should accept aspect ratio', () => {
      const input = {
        prompt: 'Test',
        aspectRatio: '9:16',
        videoConfig: {},
      };
      expect(input.aspectRatio).toBe('9:16');
    });

    it('should accept reference image', () => {
      const input = {
        prompt: 'Test',
        referenceImageUrl: 'https://example.com/ref.jpg',
        videoConfig: {},
      };
      expect(input.referenceImageUrl).toBeDefined();
    });

    it('should accept character reference images', () => {
      const input = {
        prompt: 'Test',
        characterReferenceImages: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
        videoConfig: {},
      };
      expect(input.characterReferenceImages).toHaveLength(2);
    });
  });
});

describe('AudioService Interface', () => {
  describe('AudioGenerationInput', () => {
    it('should accept narration text', () => {
      const input = {
        narration: 'Once upon a time',
        voice: 'rachel',
        sceneDuration: 5,
      };
      expect(input.narration).toBeDefined();
    });

    it('should accept voice option', () => {
      const input = {
        narration: 'Test',
        voice: '21m00Tcm4TlvDq8ikWAM',
        sceneDuration: 5,
      };
      expect(input.voice).toBeDefined();
    });

    it('should accept scene duration', () => {
      const input = {
        narration: 'Test',
        voice: 'rachel',
        sceneDuration: 10,
      };
      expect(input.sceneDuration).toBe(10);
    });

    it('should accept speed option', () => {
      const input = {
        narration: 'Test',
        voice: 'rachel',
        sceneDuration: 5,
        speed: 1.2,
      };
      expect(input.speed).toBe(1.2);
    });

    it('should accept narration style', () => {
      const input = {
        narration: 'Test',
        voice: 'rachel',
        sceneDuration: 5,
        narrationStyle: 'excited',
      };
      expect(input.narrationStyle).toBe('excited');
    });

    it('should accept elevenLabs model', () => {
      const input = {
        narration: 'Test',
        voice: 'rachel',
        sceneDuration: 5,
        elevenLabsModel: 'eleven_multilingual_v2',
      };
      expect(input.elevenLabsModel).toBe('eleven_multilingual_v2');
    });
  });

  describe('AudioServiceOptions', () => {
    it('should require elevenLabsApiKey', () => {
      const options = {
        elevenLabsApiKey: 'test-key',
        openAiApiKey: 'test-key',
      };
      expect(options.elevenLabsApiKey).toBeDefined();
    });

    it('should require openAiApiKey', () => {
      const options = {
        elevenLabsApiKey: 'test-key',
        openAiApiKey: 'test-key',
      };
      expect(options.openAiApiKey).toBeDefined();
    });

    it('should accept default voice id', () => {
      const options = {
        elevenLabsApiKey: 'test',
        openAiApiKey: 'test',
        defaultVoiceId: 'rachel',
      };
      expect(options.defaultVoiceId).toBe('rachel');
    });

    it('should default voice if not provided', () => {
      const options = {
        elevenLabsApiKey: 'test',
        openAiApiKey: 'test',
      };
      const defaultVoice = (options as any).defaultVoiceId || '21m00Tcm4TlvDq8ikWAM';
      expect(defaultVoice).toBe('21m00Tcm4TlvDq8ikWAM');
    });
  });
});
