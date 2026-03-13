// Image Provider - delegates to ImageService

import { ImageService, createImageService } from '../services/imageService';

export interface ImageProviderOptions {
  replicateApiToken: string;
  webhookUrl: string;
  userId: string;
  seriesId: string;
  storyId: string;
  sceneIndex: number;
}

export interface ImageGenerationInput {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  outputFormat?: string;
  seed?: number;
  videoConfig: any;
  characterReferenceImages?: string[];
}

export interface ProviderResult {
  predictionId: string;
  status: string;
}

export class ImageProvider {
  private service: ImageService;

  constructor(apiToken: string) {
    this.service = createImageService(apiToken);
  }

  async generate(input: ImageGenerationInput, options: ImageProviderOptions): Promise<ProviderResult> {
    return this.service.generate(input, options);
  }

  async processCompleted(prediction: unknown): Promise<string[]> {
    return this.service.processCompleted(prediction as any);
  }
}

export function createImageProvider(apiToken: string): ImageProvider {
  return new ImageProvider(apiToken);
}
