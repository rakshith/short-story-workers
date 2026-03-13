// Voice Provider - delegates to AudioService

import { AudioService, AudioGenerationInput, AudioServiceResult, createAudioService } from '../services/audioService';

export interface VoiceProviderOptions {
  elevenLabsApiKey: string;
  openAiApiKey: string;
  defaultVoiceId?: string;
}

export interface VoiceGenerationInput extends AudioGenerationInput {}

export interface VoiceGenerationResult extends AudioServiceResult {}

export class VoiceProvider {
  private service: AudioService;

  constructor(options: VoiceProviderOptions) {
    this.service = createAudioService({
      elevenLabsApiKey: options.elevenLabsApiKey,
      openAiApiKey: options.openAiApiKey,
      defaultVoiceId: options.defaultVoiceId,
    });
  }

  async generate(
    input: VoiceGenerationInput,
    options: {
      userId: string;
      sceneNumber: number;
      audioBucket: any;
    }
  ): Promise<VoiceGenerationResult> {
    return this.service.generate(input, options);
  }
}

export function createVoiceProvider(options: VoiceProviderOptions): VoiceProvider {
  return new VoiceProvider(options);
}
