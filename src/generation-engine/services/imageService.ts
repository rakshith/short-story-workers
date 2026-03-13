// Image Service - handles image generation logic

import Replicate from 'replicate';

export interface ImageServiceOptions {
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

export interface ImageServiceResult {
  predictionId: string;
  status: string;
}

export class ImageService {
  private replicate: Replicate;

  constructor(apiToken: string) {
    this.replicate = new Replicate({ auth: apiToken });
  }

  async generate(input: ImageGenerationInput, options: ImageServiceOptions): Promise<ImageServiceResult> {
    const { webhookUrl } = options;

    const isSkeletonTemplate = input.videoConfig.templateId === 'skeleton-3d-shorts';
    const skeletonDefault = input.videoConfig.mediaType === 'image' && (input.videoConfig.model || input.videoConfig.imageModel)
        ? (input.videoConfig.imageModel || input.videoConfig.model)
        : 'xai/grok-imagine-image';
        
    const defaultImageModel = isSkeletonTemplate ? skeletonDefault : 'black-forest-labs/flux-schnell';
    const imageModel = input.model || input.videoConfig.imageModel || defaultImageModel;

    const { getModelImageConfig, attachImageInputs } = await import('../../utils/replicate-model-config');
    const modelConfig = getModelImageConfig(imageModel);
    const parts = (input.aspectRatio || '16:9').split(':').map(Number);
    const widthRatio = parts[0] || 16;
    const heightRatio = parts[1] || 9;
    const baseSize = 1024;

    let width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
    let height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

    if (!modelConfig.ignoreWidthHeight && modelConfig.minWidth && width < modelConfig.minWidth) {
      const scaleFactor = modelConfig.minWidth / width;
      width = Math.round(width * scaleFactor);
      height = Math.round(height * scaleFactor);
    }

    const prompt = `${input.prompt}, ${input.videoConfig.preset?.stylePrompt || ''}`;

    const webhookWithModel = `${webhookUrl}&model=${encodeURIComponent(imageModel)}`;

    const inputPayload: any = {
      prompt,
      width: input.width || width,
      height: input.height || height,
      num_outputs: 1,
      output_format: input.outputFormat || 'jpg',
    };

    if (modelConfig.defaultInputs) {
      Object.assign(inputPayload, modelConfig.defaultInputs);
    }

    if (modelConfig.ignoreWidthHeight) {
      delete (inputPayload as any).width;
      delete (inputPayload as any).height;
    }

    if (input.videoConfig.templateId === 'character-story' ||
        input.videoConfig.templateId === 'skeleton-3d-shorts') {
      attachImageInputs(inputPayload, imageModel, input.characterReferenceImages);
    }

    if (input.seed !== undefined) {
      inputPayload.seed = input.seed;
    }

    const hasVersion = imageModel.includes(':');

    const predictionParams: any = {
      input: inputPayload,
      webhook: webhookWithModel,
      webhook_events_filter: ['completed'],
    };

    if (hasVersion) {
      predictionParams.version = imageModel.split(':')[1];
    } else {
      predictionParams.model = imageModel;
    }

    const prediction = await this.replicate.predictions.create(predictionParams);

    return {
      predictionId: prediction.id,
      status: prediction.status,
    };
  }

  async processCompleted(prediction: any): Promise<string[]> {
    const output = prediction.output;
    if (!output || !Array.isArray(output)) {
      throw new Error('Invalid prediction output');
    }
    return output;
  }
}

export function createImageService(apiToken: string): ImageService {
  return new ImageService(apiToken);
}
