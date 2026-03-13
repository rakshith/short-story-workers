// Voice Block - generates voiceover for scenes

import { Block, BlockInput, BlockOutput } from '../types';

export interface VoiceBlockInput extends BlockInput {
  data: {
    scene: any;
    sceneIndex: number;
  };
}

export interface VoiceBlockOutput extends BlockOutput {
  data?: {
    audioUrl: string;
    audioDuration: number;
    captions: any[];
    sceneIndex: number;
  };
}

export class VoiceBlock implements Block {
  readonly id = 'voice-gen';
  readonly capability = 'voice-generation';

  async execute(input: VoiceBlockInput): Promise<VoiceBlockOutput> {
    const { scene, sceneIndex } = input.data;
    const { userId, env, videoConfig } = input.context;

    const narration = scene.narration?.trim();
    if (!narration) {
      return {
        success: true,
        data: {
          audioUrl: '',
          audioDuration: 0,
          captions: [],
          sceneIndex,
        },
      };
    }

    try {
      const { createVoiceProvider } = await import('../providers/voiceProvider');
      const voiceProvider = createVoiceProvider({
        elevenLabsApiKey: env.ELEVENLABS_API_KEY,
        openAiApiKey: env.OPENAI_API_KEY,
        defaultVoiceId: env.ELEVENLABS_DEFAULT_VOICE_ID,
      });

      const result = await voiceProvider.generate(
        {
          narration,
          voice: videoConfig.voice || 'alloy',
          sceneDuration: scene.duration || 5,
          speed: 1.0,
          narrationStyle: 'neutral',
          elevenLabsModel: videoConfig.audioModel,
        },
        {
          userId,
          sceneNumber: scene.sceneNumber || sceneIndex + 1,
          audioBucket: env.AUDIO_BUCKET,
        }
      );

      return {
        success: true,
        data: {
          audioUrl: result.audioUrl,
          audioDuration: result.audioDuration,
          captions: result.captions,
          sceneIndex,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Voice generation failed',
      };
    }
  }
}
