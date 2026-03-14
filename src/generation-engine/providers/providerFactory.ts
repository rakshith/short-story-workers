// Provider Factory - creates providers with mock support and model router integration

import { ImageProvider, createImageProvider } from './imageProvider';
import { VideoProvider, createVideoProvider } from './videoProvider';
import { VoiceProvider, createVoiceProvider } from './voiceProvider';
import type { VoiceGenerationInput } from './voiceProvider';
import { ModelRouter, ModelCapability } from '../router/modelRouter';

export type ProviderType = 'image' | 'video' | 'voice';

export interface ProviderConfig {
  replicateApiToken?: string;
  elevenLabsApiKey?: string;
  openAiApiKey?: string;
  defaultVoiceId?: string;
  useMock?: boolean;
  modelRouter?: ModelRouter;
}

class ProviderFactory {
  private config: ProviderConfig;
  private router?: ModelRouter;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.router = config.modelRouter;
  }

  getImageProvider(): ImageProvider | MockImageProvider {
    if (this.config.useMock) {
      return new MockImageProvider();
    }
    if (!this.config.replicateApiToken) {
      throw new Error('REPLICATE_API_TOKEN is required for image generation');
    }
    return createImageProvider(this.config.replicateApiToken);
  }

  getVideoProvider(): VideoProvider | MockVideoProvider {
    if (this.config.useMock) {
      return new MockVideoProvider();
    }
    if (!this.config.replicateApiToken) {
      throw new Error('REPLICATE_API_TOKEN is required for video generation');
    }
    return createVideoProvider(this.config.replicateApiToken);
  }

  getVoiceProvider(): VoiceProvider | MockVoiceProvider {
    if (this.config.useMock) {
      return new MockVoiceProvider();
    }
    if (!this.config.elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY is required for voice generation');
    }
    return createVoiceProvider({
      elevenLabsApiKey: this.config.elevenLabsApiKey,
      openAiApiKey: this.config.openAiApiKey || '',
      defaultVoiceId: this.config.defaultVoiceId,
    });
  }

  /**
   * Select the best available model for a given capability using the ModelRouter.
   * Falls back to whatever default the provider uses if no router is configured.
   */
  selectModel(capability: ModelCapability, preference?: 'lowest-cost' | 'fastest'): string | undefined {
    if (!this.router) return undefined;
    try {
      return this.router.selectModel(capability, preference);
    } catch {
      return undefined;
    }
  }

  /**
   * Report a successful model call to the router for circuit breaker tracking.
   */
  reportSuccess(modelId: string): void {
    this.router?.recordSuccess(modelId);
  }

  /**
   * Report a failed model call to the router for circuit breaker tracking.
   */
  reportFailure(modelId: string): void {
    this.router?.recordFailure(modelId);
  }

  getRouter(): ModelRouter | undefined {
    return this.router;
  }

  setUseMock(useMock: boolean): void {
    this.config.useMock = useMock;
  }
}

function createProviderFactory(config: ProviderConfig): ProviderFactory {
  return new ProviderFactory(config);
}

const MOCK_IMAGE_URL = 'https://via.placeholder.com/1024x576.png?text=Mock+Image';
const MOCK_AUDIO_URL = 'https://example.com/mock-audio.mp3';

class MockImageProvider {
  async generate(input: Record<string, unknown>, options: Record<string, unknown>) {
    console.log('[MockImageProvider] Generating image:', (input as { prompt?: string }).prompt);
    return {
      predictionId: `mock-prediction-${Date.now()}`,
      status: 'starting',
    };
  }

  async processCompleted(prediction: unknown, options: Record<string, unknown>) {
    return [MOCK_IMAGE_URL];
  }
}

class MockVideoProvider {
  async generate(input: Record<string, unknown>, options: Record<string, unknown>) {
    console.log('[MockVideoProvider] Generating video:', (input as { prompt?: string }).prompt);
    return {
      predictionId: `mock-prediction-${Date.now()}`,
      status: 'starting',
    };
  }
}

class MockVoiceProvider {
  async generate(input: VoiceGenerationInput, options: Record<string, unknown>) {
    console.log('[MockVoiceProvider] Generating voice:', input.narration);
    return {
      audioUrl: MOCK_AUDIO_URL,
      audioDuration: input.sceneDuration,
      captions: [
        {
          text: input.narration.substring(0, 50),
          startTime: 0,
          endTime: input.sceneDuration,
          timestampMs: 0,
          confidence: 1,
        },
      ],
    };
  }
}

;
export type { ProviderResult } from './imageProvider';
export type { ProviderResult as VideoProviderResult } from './videoProvider';
export type { VoiceGenerationInput, VoiceGenerationResult } from './voiceProvider';
