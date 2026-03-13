/**
 * EmailNotificationService Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/emailNotificationService.spec.ts
 */

import { describe, it, expect } from 'vitest';
import { EmailNotificationService, createEmailNotificationService } from '../../services/emailNotification';

describe('EmailNotificationService', () => {
  describe('constructor', () => {
    it('should create service with mock mode', () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createEmailNotificationService(env);
      expect(service).toBeDefined();
    });
  });

  describe('sendCompletionEmail', () => {
    it('should return true in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createEmailNotificationService(env);
      
      const result = await service.sendCompletionEmail({
        userId: 'user-1',
        storyId: 'story-1',
        storyTitle: 'My Story',
      });
      
      expect(result).toBe(true);
    });

    it('should accept storyUrl option', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createEmailNotificationService(env);
      
      const result = await service.sendCompletionEmail({
        userId: 'user-1',
        storyId: 'story-1',
        storyTitle: 'My Story',
        storyUrl: 'https://example.com/story',
      });
      
      expect(result).toBe(true);
    });

    it('should accept thumbnailUrl option', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createEmailNotificationService(env);
      
      const result = await service.sendCompletionEmail({
        userId: 'user-1',
        storyId: 'story-1',
        storyTitle: 'My Story',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });
      
      expect(result).toBe(true);
    });
  });

  describe('sendFailureEmail', () => {
    it('should return true in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createEmailNotificationService(env);
      
      const result = await service.sendFailureEmail({
        userId: 'user-1',
        storyTitle: 'My Failed Story',
        error: 'Generation failed',
      });
      
      expect(result).toBe(true);
    });

    it('should handle error message', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const service = createEmailNotificationService(env);
      
      const result = await service.sendFailureEmail({
        userId: 'user-1',
        storyTitle: 'My Story',
        error: 'API timeout',
      });
      
      expect(result).toBe(true);
    });
  });
});
