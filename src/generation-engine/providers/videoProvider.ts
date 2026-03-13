// Video Provider - delegates to VideoService

import { VideoService, createVideoService } from '../services/videoService';

export interface VideoProviderOptions {
  replicateApiToken: string;
  webhookUrl: string;
  userId: string;
  seriesId: string;
  storyId: string;
  sceneIndex: number;
}

export interface VideoGenerationInput {
  prompt: string;
  model?: string;
  resolution?: string;
  duration?: number;
  aspectRatio?: string;
  seed?: number;
  videoConfig: any;
  referenceImageUrl?: string;
  characterReferenceImages?: string[];
}

export interface ProviderResult {
  predictionId: string;
  status: string;
}

export class VideoProvider {
  private service: VideoService;

  constructor(apiToken: string) {
    this.service = createVideoService(apiToken);
  }

  async generate(input: VideoGenerationInput, options: VideoProviderOptions): Promise<ProviderResult> {
    return this.service.generate(input, options);
  }
}

export function createVideoProvider(apiToken: string): VideoProvider {
  return new VideoProvider(apiToken);
}
