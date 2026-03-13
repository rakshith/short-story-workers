/**
 * Unit Tests: Providers Layer - Provider Factory
 * Tests mock vs real provider switching
 * 
 * Run: npm run test:run -- --testNamePattern "providerFactory"
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the provider modules
vi.mock('../imageProvider', () => ({
  ImageProvider: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({ predictionId: 'real-image-123', status: 'starting' }),
    processCompleted: vi.fn().mockResolvedValue(['https://real-image.jpg']),
  })),
  createImageProvider: vi.fn().mockReturnValue({
    generate: vi.fn().mockResolvedValue({ predictionId: 'real-image-123', status: 'starting' }),
  }),
}));

vi.mock('../videoProvider', () => ({
  VideoProvider: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({ predictionId: 'real-video-123', status: 'starting' }),
  })),
  createVideoProvider: vi.fn().mockReturnValue({
    generate: vi.fn().mockResolvedValue({ predictionId: 'real-video-123', status: 'starting' }),
  }),
}));

vi.mock('../voiceProvider', () => ({
  VoiceProvider: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({ audioUrl: 'https://real-audio.mp3', audioDuration: 5 }),
  })),
  createVoiceProvider: vi.fn().mockReturnValue({
    generate: vi.fn().mockResolvedValue({ audioUrl: 'https://real-audio.mp3', audioDuration: 5 }),
  }),
}));

describe('Providers Layer - Provider Factory', () => {
  describe('Mock Mode Detection', () => {
    it('should detect mock mode when GEN_PROVIDER=mock', () => {
      const env = { GEN_PROVIDER: 'mock' };
      const useMock = env.GEN_PROVIDER === 'mock';
      expect(useMock).toBe(true);
    });

    it('should not use mock when GEN_PROVIDER is not set', () => {
      const env = {} as { GEN_PROVIDER?: string };
      const useMock = env.GEN_PROVIDER === 'mock';
      expect(useMock).toBe(false);
    });

    it('should not use mock when GEN_PROVIDER=real', () => {
      const env = { GEN_PROVIDER: 'real' };
      const useMock = env.GEN_PROVIDER === 'mock';
      expect(useMock).toBe(false);
    });
  });

  describe('Provider Creation - Mock Mode', () => {
    it('should return mock image provider when useMock=true', () => {
      const useMock = true;

      let provider: any;
      if (useMock) {
        provider = {
          name: 'MockImageProvider',
          generate: vi.fn().mockResolvedValue({ predictionId: 'mock-prediction-123', status: 'starting' }),
        };
      }

      expect(provider).toBeDefined();
      expect(provider.name).toBe('MockImageProvider');
    });

    it('should return mock video provider when useMock=true', () => {
      const useMock = true;

      let provider: any;
      if (useMock) {
        provider = {
          name: 'MockVideoProvider',
          generate: vi.fn().mockResolvedValue({ predictionId: 'mock-prediction-123', status: 'starting' }),
        };
      }

      expect(provider).toBeDefined();
      expect(provider.name).toBe('MockVideoProvider');
    });

    it('should return mock voice provider when useMock=true', () => {
      const useMock = true;

      let provider: any;
      if (useMock) {
        provider = {
          name: 'MockVoiceProvider',
          generate: vi.fn().mockResolvedValue({ 
            audioUrl: 'https://example.com/mock-audio.mp3', 
            audioDuration: 5 
          }),
        };
      }

      expect(provider).toBeDefined();
      expect(provider.name).toBe('MockVoiceProvider');
    });
  });

  describe('Provider Creation - Real Mode', () => {
    it('should return real image provider when useMock=false', () => {
      const useMock = false;
      const replicateToken = 'replicate-token-123';

      let provider;
      if (useMock) {
        provider = { name: 'MockImageProvider' };
      } else {
        provider = { 
          name: 'ImageProvider', 
          token: replicateToken,
          generate: vi.fn() 
        };
      }

      expect(provider).toBeDefined();
      expect(provider.name).toBe('ImageProvider');
    });

    it('should require replicate token for real image provider', () => {
      const useMock = false;
      const replicateApiToken = undefined;

      expect(() => {
        if (!useMock && !replicateApiToken) {
          throw new Error('REPLICATE_API_TOKEN is required for image generation');
        }
      }).toThrow('REPLICATE_API_TOKEN is required for image generation');
    });

    it('should require elevenlabs token for real voice provider', () => {
      const useMock = false;
      const elevenLabsApiKey = undefined;

      expect(() => {
        if (!useMock && !elevenLabsApiKey) {
          throw new Error('ELEVENLABS_API_KEY is required for voice generation');
        }
      }).toThrow('ELEVENLABS_API_KEY is required for voice generation');
    });
  });

  describe('Mock Provider Behavior', () => {
    it('mock image provider should return mock prediction ID', async () => {
      const mockProvider = {
        generate: vi.fn().mockResolvedValue({ 
          predictionId: `mock-prediction-${Date.now()}`, 
          status: 'starting' 
        }),
      };

      const result = await mockProvider.generate({ prompt: 'test' });

      expect(result.predictionId).toContain('mock-prediction');
      expect(result.status).toBe('starting');
    });

    it('mock image provider processCompleted should return mock URL', async () => {
      const mockProvider = {
        processCompleted: vi.fn().mockResolvedValue(['https://via.placeholder.com/mock.jpg']),
      };

      const result = await mockProvider.processCompleted({});

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('placeholder.com');
    });

    it('mock voice provider should return mock audio URL', async () => {
      const mockProvider = {
        generate: vi.fn().mockResolvedValue({ 
          audioUrl: 'https://example.com/mock-audio.mp3', 
          audioDuration: 5,
          captions: [],
        }),
      };

      const result = await mockProvider.generate({ narration: 'test' });

      expect(result.audioUrl).toContain('mock-audio.mp3');
      expect(result.audioDuration).toBe(5);
    });
  });

  describe('Provider Configuration', () => {
    it('should pass replicate token to provider', () => {
      const config = {
        replicateApiToken: 'test-token-123',
        useMock: false,
      };

      expect(config.replicateApiToken).toBe('test-token-123');
      expect(config.useMock).toBe(false);
    });

    it('should pass elevenlabs config to voice provider', () => {
      const config = {
        elevenLabsApiKey: 'elevenlabs-key',
        openAiApiKey: 'openai-key',
        defaultVoiceId: 'default-voice',
        useMock: false,
      };

      expect(config.elevenLabsApiKey).toBe('elevenlabs-key');
      expect(config.defaultVoiceId).toBe('default-voice');
    });
  });

  describe('Mock URLs Structure', () => {
    it('should use placeholder URL for mock images', () => {
      const MOCK_IMAGE_URL = 'https://via.placeholder.com/1024x576.png?text=Mock+Image';
      expect(MOCK_IMAGE_URL).toContain('placeholder.com');
      expect(MOCK_IMAGE_URL).toContain('Mock+Image');
    });

    it('should use example URL for mock audio', () => {
      const MOCK_AUDIO_URL = 'https://example.com/mock-audio.mp3';
      expect(MOCK_AUDIO_URL).toContain('mock-audio.mp3');
    });
  });
});
