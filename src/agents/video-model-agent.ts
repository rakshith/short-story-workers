// Video Model Agent — Generates video using Wan 2.7 or Seedance models
// Replaces Kling Avatar v2 for physical products with better quality and lip-sync
// Uses FAL provider for async video generation via webhook

import { BaseAgent } from './base-agent';
import { Env } from '../types/env';
import { sanitizePrompt } from '../utils/prompt-sanitizer';

export interface VideoModelAgentInput {
  imageUrl: string;           // Composite image (avatar holding product)
  audioUrl: string;           // ElevenLabs TTS audio URL
  aspectRatio: string;
  resolution: string;         // '720p' | '1080p' from ModelPlan
  sceneDuration: number;      // Scene duration in seconds — sent as video duration to model
  // Video model selection from decision tree
  videoModel: string;         // FAL endpoint (e.g., 'fal-ai/wan/v2.7/image-to-video')
  videoVariant: string;       // 'default' | 'mini' | 'fast' | 'standard'
  videoModelKey: string;      // Key from decision tree (e.g., 'wan-2.7-720p')
  audioInput: 'driving_audio' | 'native';
  audioParam: 'audio_url' | 'audio_urls';
  audioArray?: boolean;
  generateAudio?: boolean;
  // Scene context
  userId: string;
  jobId: string;
  storyId: string;
  sceneIndex: number;
  baseUrl: string;
  // AI Director creative fields
  shotDescription?: string;
  cameraStyle?: string;
  prompt?: string;            // Additional prompt for video generation
}

export interface VideoModelAgentOutput {
  success: boolean;
  provider: string;
  model: string;
  predictionId?: string;
  error?: string;
}

export class VideoModelAgent extends BaseAgent<VideoModelAgentInput, VideoModelAgentOutput> {
  readonly name = 'VideoModelAgent';

  async execute(input: VideoModelAgentInput): Promise<VideoModelAgentOutput> {
    this.log(`Generating video for scene ${input.sceneIndex}, model: ${input.videoModelKey} (${input.videoModel})`);

    const origin = new URL(input.baseUrl).origin;

    const { ModelProviderFactory, PROVIDER_NAMES, isProviderConfigured } = await import('@artflicks/model-provider');

    const falAvailable = isProviderConfigured(PROVIDER_NAMES.FALAI, this.env);

    if (!falAvailable) {
      return { success: false, provider: '', model: '', error: 'FAL provider not available for video generation' };
    }

    try {
      const falProvider = ModelProviderFactory.createProvider(PROVIDER_NAMES.FALAI, { apiKey: this.env.FAL_API_KEY });

      if (!falProvider.generateVideoAsync) {
        return { success: false, provider: '', model: '', error: 'FAL provider does not support async video generation' };
      }

      // Build input based on model type
      const videoInput = this.buildVideoInput(input);

      const resolvedDuration = typeof videoInput.duration === 'number' ? videoInput.duration : input.sceneDuration;
      const drivingAudioAttached = Boolean(videoInput.audio_url || videoInput.audio_urls);
      this.log(`Submitting video generation: model=${input.videoModel}, resolution=${input.resolution}, duration=${resolvedDuration}s, drivingAudio=${drivingAudioAttached ? 'on' : 'off'}, audioParam=${input.audioParam}`);

      const result = await falProvider.generateVideoAsync(input.videoModel, videoInput, {
        webhookUrl: origin,
        webhookMetadata: {
          storyId: input.storyId,
          sceneIndex: String(input.sceneIndex),
          type: 'video',
          userId: input.userId,
          jobId: input.jobId,
          model: input.videoModelKey,
        },
        webhookEvents: ['completed'],
      });

      this.log(`FAL submission succeeded: ${result.predictionId}`);
      return { success: true, provider: 'falai', model: input.videoModel, predictionId: result.predictionId };
    } catch (err) {
      this.error(`Video generation failed:`, err);
      return { success: false, provider: 'falai', model: input.videoModel, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Build video input based on model type.
   * Wan 2.7: image-to-video with audio_url (single string)
   * Seedance: reference-to-video with audio_urls (array) + generate_audio: false
   *
   * Always sends: resolution, duration (clamped to model limits), aspect_ratio
   */
  private buildVideoInput(input: VideoModelAgentInput): Record<string, unknown> {
    // Clamp duration to valid model range (min 4s for Seedance, 3s for Wan 2.7; max 15s)
    const minDuration = input.videoModel.includes('seedance') ? 4 : 3;
    const normalizedDuration = Math.ceil(Number.isFinite(input.sceneDuration) ? input.sceneDuration : minDuration);
    const duration = Math.min(15, Math.max(minDuration, normalizedDuration));

    const baseInput: Record<string, unknown> = {
      image_url: input.imageUrl,
      resolution: input.resolution,
      duration,
      aspect_ratio: input.aspectRatio,
      // Sanitized prompt — text/typography stripped
      ...(input.prompt && { prompt: sanitizePrompt(input.prompt) }),
    };

    // Add audio input based on model type
    if (input.audioInput === 'driving_audio' && input.audioUrl) {
      if (input.audioArray) {
        // Seedance: expects audio_urls as array
        baseInput.audio_urls = [input.audioUrl];
      } else {
        // Wan 2.7: expects audio_url as single string
        baseInput.audio_url = input.audioUrl;
      }
    }

    // For Seedance: disable native audio when using driving_audio
    if (input.generateAudio === false) {
      baseInput.generate_audio = false;
    }

    this.log(`Video params: resolution=${input.resolution}, duration=${duration}s, aspect=${input.aspectRatio}`);
    return baseInput;
  }
}
