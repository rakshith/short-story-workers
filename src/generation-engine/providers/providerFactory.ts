// Provider Factory - creates providers with mock support

import { ImageProvider, createImageProvider } from './imageProvider';
import { VideoProvider, createVideoProvider } from './videoProvider';
import { VoiceProvider, createVoiceProvider } from './voiceProvider';
import type { VoiceGenerationInput } from './voiceProvider';

export type ProviderType = 'image' | 'video' | 'voice';

export interface ProviderConfig {
  replicateApiToken?: string;
  elevenLabsApiKey?: string;
  openAiApiKey?: string;
  defaultVoiceId?: string;
  useMock?: boolean;
}

export class ProviderFactory {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
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

  setUseMock(useMock: boolean): void {
    this.config.useMock = useMock;
  }
}

export function createProviderFactory(config: ProviderConfig): ProviderFactory {
  return new ProviderFactory(config);
}

const MOCK_IMAGE_URL = 'https://via.placeholder.com/1024x576.png?text=Mock+Image';
const MOCK_AUDIO_URL = 'https://example.com/mock-audio.mp3';

class MockImageProvider {
  async generate(input: any, options: any) {
    console.log('[MockImageProvider] Generating image:', input.prompt);
    return {
      predictionId: `mock-prediction-${Date.now()}`,
      status: 'starting',
    };
  }

  async processCompleted(prediction: any, options: any) {
    return [MOCK_IMAGE_URL];
  }
}

class MockVideoProvider {
  async generate(input: any, options: any) {
    console.log('[MockVideoProvider] Generating video:', input.prompt);
    return {
      predictionId: `mock-prediction-${Date.now()}`,
      status: 'starting',
    };
  }
}

class MockVoiceProvider {
  async generate(input: VoiceGenerationInput, options: any) {
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

export { ImageProvider, VideoProvider, VoiceProvider };
export type { ProviderResult } from './imageProvider';
export type { ProviderResult as VideoProviderResult } from './videoProvider';
export type { VoiceGenerationInput, VoiceGenerationResult } from './voiceProvider';
