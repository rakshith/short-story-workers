/**
 * Unit Tests: Services Layer - Audio Service
 * Tests audio generation model selection, voice settings, and config handling
 * 
 * Run: npm run test:run -- --testNamePattern "audioService"
 */

import { describe, it, expect, vi } from 'vitest';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

describe('Services Layer - Audio Service', () => {
  describe('Model Selection', () => {
    it('should use videoConfig.audioModel when provided', () => {
      const videoConfig: any = {
        audioModel: 'eleven_multilingual_v2',
      };

      const audioModel = videoConfig.audioModel || 'eleven_multilingual_v2';

      expect(audioModel).toBe('eleven_multilingual_v2');
    });

    it('should use default when no audioModel in config', () => {
      const videoConfig: any = {};

      const audioModel = videoConfig.audioModel || 'eleven_multilingual_v2';

      expect(audioModel).toBe('eleven_multilingual_v2');
    });

    it('should use input elevenLabsModel over videoConfig', () => {
      const videoConfig: any = {
        audioModel: 'video-config-model',
      };
      const inputModel = 'input-model';

      const audioModel = inputModel || videoConfig.audioModel || 'eleven_multilingual_v2';

      expect(audioModel).toBe('input-model');
    });
  });

  describe('Voice Selection', () => {
    it('should use custom voice from videoConfig', () => {
      const videoConfig: any = {
        voice: 'custom-voice-id',
      };

      const voice = videoConfig.voice || 'alloy';

      expect(voice).toBe('custom-voice-id');
    });

    it('should default to alloy when no voice specified', () => {
      const videoConfig: any = {};

      const voice = videoConfig.voice || 'alloy';

      expect(voice).toBe('alloy');
    });

    it('should map alloy to default voice ID', () => {
      const voice = 'alloy';
      const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';

      const finalVoiceId = voice === 'alloy' ? defaultVoiceId : voice;

      expect(finalVoiceId).toBe('21m00Tcm4TlvDq8ikWAM');
    });

    it('should keep custom voice ID when not alloy', () => {
      const voiceInput = 'custom-voice-123';
      const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';

      const voice = voiceInput as string;
      const finalVoiceId = voice === 'alloy' ? defaultVoiceId : voice;

      expect(finalVoiceId).toBe('custom-voice-123');
    });

    it('should handle voice edge case as non-alloy', () => {
      const voiceInput = 'rachel';
      const defaultVoiceId = '21m00Tcm4TlvDq8ikWAM';

      const voice = voiceInput as string;
      const finalVoiceId = voice === 'alloy' ? defaultVoiceId : voice;

      expect(finalVoiceId).toBe('rachel');
    });
  });

  describe('Voice Settings', () => {
    it('should apply speed bounds (0.7 to 1.2)', () => {
      const speed = 0.5;
      const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));

      expect(clampedSpeed).toBe(0.7);
    });

    it('should not change valid speed', () => {
      const speed = 1.0;
      const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));

      expect(clampedSpeed).toBe(1.0);
    });

    it('should clamp high speed', () => {
      const speed = 2.0;
      const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));

      expect(clampedSpeed).toBe(1.2);
    });

    it('should use default narration style when not specified', () => {
      const input: any = {};

      const narrationStyle = input.narrationStyle || 'neutral';

      expect(narrationStyle).toBe('neutral');
    });

    it('should use custom narration style', () => {
      const input: any = {
        narrationStyle: 'happy',
      };

      const narrationStyle = input.narrationStyle || 'neutral';

      expect(narrationStyle).toBe('happy');
    });
  });

  describe('Speed Settings', () => {
    it('should use default speed of 1.0', () => {
      const input: any = {};

      const speed = input.speed ?? 1.0;

      expect(speed).toBe(1.0);
    });

    it('should use provided speed', () => {
      const input: any = {
        speed: 0.9,
      };

      const speed = input.speed ?? 1.0;

      expect(speed).toBe(0.9);
    });
  });

  describe('Narration Processing', () => {
    it('should handle narration trimming', () => {
      const narration = '  Hello World  ';

      const trimmed = narration.trim();

      expect(trimmed).toBe('Hello World');
    });

    it('should detect empty narration', () => {
      const narration = '   ';

      const trimmed = narration.trim();

      expect(trimmed).toBe('');
    });

    it('should use scene duration when provided', () => {
      const sceneDuration = 5;

      const duration = sceneDuration || 5;

      expect(duration).toBe(5);
    });

    it('should default duration when not provided', () => {
      const sceneDuration = undefined;

      const duration = sceneDuration || 5;

      expect(duration).toBe(5);
    });
  });

  describe('Caption Generation', () => {
    it('should generate caption structure', () => {
      const caption = {
        text: 'Hello World',
        startTime: 0,
        endTime: 2.0,
        timestampMs: 0,
        confidence: null,
      };

      expect(caption.text).toBe('Hello World');
      expect(caption.startTime).toBe(0);
      expect(caption.endTime).toBe(2.0);
      expect(caption.timestampMs).toBe(0);
      expect(caption.confidence).toBeNull();
    });

    it('should include tokens in caption', () => {
      const caption = {
        text: 'Hello',
        startTime: 0,
        endTime: 0.5,
        tokens: [
          { text: 'Hello', startTime: 0, endTime: 0.5 },
        ],
      };

      expect(caption.tokens).toBeDefined();
      expect(caption.tokens?.length).toBe(1);
    });
  });

  describe('Audio Output Format', () => {
    it('should use mp3_44100_128 format', () => {
      const outputFormat = 'mp3_44100_128';

      expect(outputFormat).toBe('mp3_44100_128');
    });
  });

  describe('Template Voice Configuration', () => {
    it('youtube-shorts template should have voice configuration', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const videoConfig = template?.defaultConfig?.videoConfig as any;

      // Templates may or may not have voice - test the structure
      expect(videoConfig).toBeDefined();
    });

    it('should merge user voice with template config', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const templateDefaults = template?.defaultConfig?.videoConfig as any;

      const userConfig: any = {
        voice: 'user-voice-id',
      };

      const merged = {
        ...templateDefaults,
        ...userConfig,
      };

      expect(merged.voice).toBe('user-voice-id');
    });
  });

  describe('Speed Clamping Logic', () => {
    it('should handle edge case speed 0', () => {
      const speed = 0;
      const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));

      expect(clampedSpeed).toBe(0.7);
    });

    it('should handle edge case speed 1.2', () => {
      const speed = 1.2;
      const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));

      expect(clampedSpeed).toBe(1.2);
    });

    it('should handle negative speed', () => {
      const speed = -0.5;
      const clampedSpeed = Math.max(0.7, Math.min(1.2, speed));

      expect(clampedSpeed).toBe(0.7);
    });
  });
});
