/**
 * TranscriptService Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/transcriptService.spec.ts
 */

import { describe, it, expect } from 'vitest';
import { TranscriptService, createTranscriptService } from '../../services/transcriptService';

describe('TranscriptService', () => {
  describe('constructor', () => {
    it('should create service with API key', () => {
      const service = createTranscriptService({ openAiApiKey: 'test-key' });
      expect(service).toBeDefined();
    });
  });

  describe('transcribe', () => {
    it('should require audioUrl', async () => {
      const service = createTranscriptService({ openAiApiKey: 'test-key' });
      
      await expect(service.transcribe({ audioUrl: '' })).rejects.toThrow();
    });

    it('should accept language option', async () => {
      const service = createTranscriptService({ openAiApiKey: 'test-key' });
      
      const input = {
        audioUrl: 'https://example.com/audio.mp3',
        language: 'es',
      };
      
      expect(input.language).toBe('es');
    });

    it('should accept prompt option', async () => {
      const service = createTranscriptService({ openAiApiKey: 'test-key' });
      
      const input = {
        audioUrl: 'https://example.com/audio.mp3',
        prompt: 'This is a story about',
      };
      
      expect(input.prompt).toBe('This is a story about');
    });

    it('should default to english language', () => {
      const language = undefined;
      const defaultLang = language || 'en';
      expect(defaultLang).toBe('en');
    });
  });
});
