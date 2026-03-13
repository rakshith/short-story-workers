/**
 * Unit Tests: Templates Layer (Vitest)
 * Tests template resolution, config merging, and default values
 * 
 * Run: npm run test:run -- --grep "templates"
 */

import { describe, it, expect } from 'vitest';
import { getTemplate, getAllTemplates, TEMPLATE_IDS } from '../../templates/index';
import type { VideoConfigContext } from '../../types/index';

describe('Templates Layer', () => {
  describe('Load YouTube Shorts Template', () => {
    it('should load youtube-shorts template', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      expect(template).toBeDefined();
      expect(template?.id).toBe('youtube-shorts');
    });

    it('should have correct template name', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      expect(template?.name).toBe('YouTube Shorts');
    });

    it('should have profileId', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      expect(template?.profileId).toBeDefined();
    });

    it('should have videoConfig with correct defaults', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as VideoConfigContext;
      expect(videoConfig).toBeDefined();
      expect(videoConfig?.templateId).toBe('youtube-shorts');
      expect(videoConfig?.aspectRatio).toBe('9:16');
      expect(videoConfig?.imageModel).toBeDefined();
    });
  });

  describe('Load Skeleton 3D Shorts Template', () => {
    it('should load skeleton-3d-shorts template', () => {
      const template = getTemplate(TEMPLATE_IDS.SKELETON_3D_SHORTS);
      expect(template).toBeDefined();
      expect(template?.id).toBe('skeleton-3d-shorts');
    });

    it('should use Grok image model for skeleton template', () => {
      const template = getTemplate(TEMPLATE_IDS.SKELETON_3D_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as VideoConfigContext;
      expect(videoConfig?.imageModel).toBe('xai/grok-imagine-image');
    });

    it('should have video model set', () => {
      const template = getTemplate(TEMPLATE_IDS.SKELETON_3D_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as VideoConfigContext;
      expect(videoConfig?.videoModel).toBe('minimax-video-01');
    });
  });

  describe('Load Avatar Video Template', () => {
    it('should load avatar-video template', () => {
      const template = getTemplate(TEMPLATE_IDS.AVATAR_VIDEO);
      expect(template).toBeDefined();
      expect(template?.id).toBe('avatar-video');
    });

    it('should use avatar profile', () => {
      const template = getTemplate(TEMPLATE_IDS.AVATAR_VIDEO);
      const profileId = template?.profileId || '';
      expect(profileId.includes('avatar') || profileId.includes('pipeline')).toBe(true);
    });
  });

  describe('User Config Overrides', () => {
    it('should merge user config with template defaults', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const templateDefaults = template?.defaultConfig?.videoConfig as VideoConfigContext;
      
      const userConfig: Partial<VideoConfigContext> = {
        imageModel: 'custom-image-model',
        aspectRatio: '16:9',
        voice: 'custom-voice-id',
      };
      
      const mergedConfig = {
        ...templateDefaults,
        ...userConfig,
      } as VideoConfigContext;
      
      expect(mergedConfig.imageModel).toBe('custom-image-model');
      expect(mergedConfig.aspectRatio).toBe('16:9');
      expect(mergedConfig.voice).toBe('custom-voice-id');
    });

    it('should preserve template defaults for non-overridden fields', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const templateDefaults = template?.defaultConfig?.videoConfig as VideoConfigContext;
      
      const userConfig: Partial<VideoConfigContext> = {
        imageModel: 'custom-model',
      };
      
      const mergedConfig = {
        ...templateDefaults,
        ...userConfig,
      } as VideoConfigContext;
      
      expect(mergedConfig.templateId).toBeDefined();
      expect(mergedConfig.aspectRatio).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should use template defaults when user provides empty config', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const templateDefaults = template?.defaultConfig?.videoConfig as VideoConfigContext;
      
      const userConfig: Partial<VideoConfigContext> = {};
      
      const mergedConfig = {
        ...templateDefaults,
        ...userConfig,
      } as VideoConfigContext;
      
      expect(mergedConfig.aspectRatio).toBeDefined();
      expect(mergedConfig.enableVoiceOver).toBeDefined();
      expect(mergedConfig.enableCaptions).toBeDefined();
    });
  });

  describe('Template Not Found', () => {
    it('should return undefined for unknown template', () => {
      const template = getTemplate('non-existent-template');
      expect(template).toBeUndefined();
    });
  });

  describe('Generation Options', () => {
    it('should have generationOptions with correct defaults', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const generationOptions = template?.defaultConfig?.generationOptions;
      
      expect(generationOptions).toBeDefined();
      expect(generationOptions?.enableSceneReview).toBeDefined();
      expect(generationOptions?.enableAutoVideoGeneration).toBeDefined();
      expect(generationOptions?.maxRetries).toBe(3);
      expect(generationOptions?.timeoutMs).toBe(300000);
    });
  });

  describe('Get All Templates', () => {
    it('should return array of templates', () => {
      const allTemplates = getAllTemplates();
      expect(Array.isArray(allTemplates)).toBe(true);
      expect(allTemplates.length).toBeGreaterThan(0);
    });

    it('each template should have required fields', () => {
      const allTemplates = getAllTemplates();
      
      for (const template of allTemplates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.profileId).toBeDefined();
        expect(template.defaultConfig).toBeDefined();
      }
    });
  });

  describe('VideoConfig Structure', () => {
    it('should have required fields in videoConfig', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as VideoConfigContext;
      
      expect(videoConfig?.templateId).toBeDefined();
      expect(videoConfig?.aspectRatio).toBeDefined();
      expect(videoConfig?.resolution).toBeDefined();
    });

    it('should have correct boolean fields', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as VideoConfigContext;
      
      expect(typeof videoConfig?.enableVoiceOver).toBe('boolean');
      expect(typeof videoConfig?.enableCaptions).toBe('boolean');
      expect(typeof videoConfig?.sceneReviewRequired).toBe('boolean');
    });
  });
});
