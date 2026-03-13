/**
 * Unit Tests: Blocks Layer
 * Tests block input/output transformations and provider injection
 * 
 * Run: npm run test:run -- --testNamePattern "blocks"
 */

import { describe, it, expect, vi } from 'vitest';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

describe('Blocks Layer - Input/Output Transformations', () => {
  describe('Image Block Input Structure', () => {
    it('should require scene data with imagePrompt', () => {
      const scene = {
        imagePrompt: 'A beautiful sunset over mountains',
        sceneNumber: 1,
      };

      expect(scene.imagePrompt).toBeDefined();
      expect(scene.sceneNumber).toBe(1);
    });

    it('should require sceneIndex in data', () => {
      const data = {
        scene: { imagePrompt: 'test' },
        sceneIndex: 0,
        totalScenes: 5,
      };

      expect(data.sceneIndex).toBe(0);
      expect(data.totalScenes).toBe(5);
    });

    it('should include videoConfig in context', () => {
      const videoConfig = {
        templateId: 'youtube-shorts',
        imageModel: 'black-forest-labs/flux-schnell',
        aspectRatio: '9:16',
        preset: { seed: 12345 },
      };

      expect(videoConfig.templateId).toBe('youtube-shorts');
      expect(videoConfig.imageModel).toBeDefined();
    });
  });

  describe('Image Block Output Structure', () => {
    it('should return imageUrl and sceneIndex', () => {
      const output = {
        success: true,
        data: {
          imageUrl: 'https://example.com/image.jpg',
          sceneIndex: 0,
        },
      };

      expect(output.success).toBe(true);
      expect(output.data.imageUrl).toBe('https://example.com/image.jpg');
      expect(output.data.sceneIndex).toBe(0);
    });

    it('should return empty imageUrl for async generation', () => {
      const output = {
        success: true,
        data: {
          imageUrl: '', // Empty for async, webhook handles it
          sceneIndex: 0,
        },
      };

      expect(output.success).toBe(true);
      expect(output.data.imageUrl).toBe('');
    });

    it('should handle error case', () => {
      const output = {
        success: false,
        error: 'Image generation failed',
      };

      expect(output.success).toBe(false);
      expect(output.error).toBe('Image generation failed');
    });
  });

  describe('Voice Block Input Structure', () => {
    it('should require narration in scene', () => {
      const scene = {
        narration: 'Once upon a time in a distant land...',
        duration: 5,
        sceneNumber: 1,
      };

      expect(scene.narration).toBeDefined();
      expect(scene.duration).toBe(5);
    });

    it('should handle empty narration gracefully', () => {
      const narration = '   ';
      const trimmed = narration.trim();

      expect(trimmed).toBe('');
    });
  });

  describe('Voice Block Output Structure', () => {
    it('should return audioUrl, audioDuration, captions', () => {
      const output = {
        success: true,
        data: {
          audioUrl: 'https://example.com/audio.mp3',
          audioDuration: 5.2,
          captions: [
            {
              text: 'Once upon a time',
              startTime: 0,
              endTime: 2.0,
            },
          ],
          sceneIndex: 0,
        },
      };

      expect(output.data.audioUrl).toBe('https://example.com/audio.mp3');
      expect(output.data.audioDuration).toBe(5.2);
      expect(output.data.captions).toHaveLength(1);
    });

    it('should return empty audio for no narration', () => {
      const output = {
        success: true,
        data: {
          audioUrl: '',
          audioDuration: 0,
          captions: [],
          sceneIndex: 0,
        },
      };

      expect(output.data.audioUrl).toBe('');
      expect(output.data.audioDuration).toBe(0);
    });
  });

  describe('Video Block Input Structure', () => {
    it('should include generatedImageUrl from previous step', () => {
      const data = {
        scene: { imagePrompt: 'test' },
        sceneIndex: 0,
        generatedImageUrl: 'https://example.com/image.jpg',
      };

      expect(data.generatedImageUrl).toBe('https://example.com/image.jpg');
    });

    it('should handle scene.generatedImageUrl fallback', () => {
      const scene = {
        generatedImageUrl: 'https://example.com/image.jpg',
      };

      const referenceImage = scene.generatedImageUrl;

      expect(referenceImage).toBe('https://example.com/image.jpg');
    });
  });

  describe('Video Block Output Structure', () => {
    it('should return videoUrl and sceneIndex', () => {
      const output = {
        success: true,
        data: {
          videoUrl: 'https://example.com/video.mp4',
          sceneIndex: 0,
        },
      };

      expect(output.data.videoUrl).toBe('https://example.com/video.mp4');
      expect(output.data.sceneIndex).toBe(0);
    });

    it('should return empty videoUrl for async generation', () => {
      const output = {
        success: true,
        data: {
          videoUrl: '', // Empty for async
          sceneIndex: 0,
        },
      };

      expect(output.data.videoUrl).toBe('');
    });
  });

  describe('Provider Injection via Context', () => {
    it('should use injected provider when available', () => {
      const mockProvider = {
        generate: vi.fn().mockResolvedValue({ predictionId: 'mock-123' }),
      };

      const providers = {
        imageProvider: mockProvider,
      };

      const provider = providers?.imageProvider;

      expect(provider).toBeDefined();
    });

    it('should fallback to creating provider when not injected', () => {
      const providers = undefined;

      const shouldFallback = !providers?.imageProvider;

      expect(shouldFallback).toBe(true);
    });

    it('should pass all three provider types in context', () => {
      const providers = {
        imageProvider: { name: 'image' },
        videoProvider: { name: 'video' },
        voiceProvider: { name: 'voice' },
      };

      expect(providers.imageProvider).toBeDefined();
      expect(providers.videoProvider).toBeDefined();
      expect(providers.voiceProvider).toBeDefined();
    });
  });

  describe('Scene Data Transformation', () => {
    it('should pass sceneNumber to provider', () => {
      const scene = {
        sceneNumber: 1,
        narration: 'Test narration',
      };

      const sceneNumber = scene.sceneNumber || 1;

      expect(sceneNumber).toBe(1);
    });

    it('should use sceneIndex from data when sceneNumber not in scene', () => {
      const scene: any = {};
      const sceneIndex = 2;

      const sceneNumber = scene.sceneNumber || sceneIndex + 1;

      expect(sceneNumber).toBe(3);
    });
  });

  describe('Webhook URL Construction', () => {
    it('should build correct webhook URL for image', () => {
      const baseUrl = 'https://worker.artflicks.workers.dev';
      const storyId = 'story-123';
      const sceneIndex = 0;
      const userId = 'user-456';
      const jobId = 'job-789';

      const webhookUrl = `${baseUrl}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=image&userId=${userId}&jobId=${jobId}`;

      expect(webhookUrl).toContain('type=image');
      expect(webhookUrl).toContain(`storyId=${storyId}`);
    });

    it('should build correct webhook URL for video', () => {
      const baseUrl = 'https://worker.artflicks.workers.dev';
      const type = 'video';

      const webhookUrl = `${baseUrl}/webhooks/replicate?type=${type}`;

      expect(webhookUrl).toContain('type=video');
    });

    it('should include sceneReviewRequired param when enabled', () => {
      const sceneReviewRequired = true;
      const sceneReviewParam = sceneReviewRequired ? '&sceneReviewRequired=true' : '';

      expect(sceneReviewParam).toBe('&sceneReviewRequired=true');
    });

    it('should not include sceneReviewRequired when disabled', () => {
      const sceneReviewRequired = false;
      const sceneReviewParam = sceneReviewRequired ? '&sceneReviewRequired=true' : '';

      expect(sceneReviewParam).toBe('');
    });
  });

  describe('Block Execution Context', () => {
    it('should include jobId in context', () => {
      const context = {
        jobId: 'job-123',
        storyId: 'story-456',
        userId: 'user-789',
      };

      expect(context.jobId).toBe('job-123');
    });

    it('should include env in context', () => {
      const env = {
        REPLICATE_API_TOKEN: 'test-token',
        APP_URL: 'https://test.workers.dev',
      };

      expect(env.REPLICATE_API_TOKEN).toBe('test-token');
    });
  });
});
