// Image Provider - wraps Replicate image generation

import Replicate from 'replicate';

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
  private replicate: Replicate;

  constructor(apiToken: string) {
    this.replicate = new Replicate({ auth: apiToken });
  }

  async generate(input: ImageGenerationInput, options: ImageProviderOptions): Promise<ProviderResult> {
    const { webhookUrl } = options;

    const isSkeletonTemplate = input.videoConfig.templateId === 'skeleton-3d-shorts';
    const defaultImageModel = isSkeletonTemplate ? 'xai/grok-imagine-image' : 'black-forest-labs/flux-schnell';
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
}

export function createImageProvider(apiToken: string): ImageProvider {
  return new ImageProvider(apiToken);
}
