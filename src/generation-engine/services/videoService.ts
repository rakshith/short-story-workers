// Video Service - handles video generation logic

import Replicate from 'replicate';

export interface VideoServiceOptions {
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

export interface VideoServiceResult {
  predictionId: string;
  status: string;
}

export class VideoService {
  private replicate: Replicate;

  constructor(apiToken: string) {
    this.replicate = new Replicate({ auth: apiToken });
  }

  async generate(input: VideoGenerationInput, options: VideoServiceOptions): Promise<VideoServiceResult> {
    const { webhookUrl } = options;

    const videoModel = input.model || input.videoConfig.model || 'wan-video/wan-2.5-t2v-fast';

    const { getModelImageConfig, attachImageInputs, getNearestDuration } = await import('../../utils/replicate-model-config');
    const modelConfig = getModelImageConfig(videoModel);

    const inputPayload: any = {
      prompt: `${input.prompt} ${input.videoConfig.preset?.stylePrompt || ''}, high quality motion, cinematic`,
    };

    if (modelConfig.defaultInputs) {
      Object.assign(inputPayload, modelConfig.defaultInputs);
    }

    const isSpecialTemplate = input.videoConfig.templateId === 'character-story' ||
        input.videoConfig.templateId === 'skeleton-3d-shorts';

    if (input.referenceImageUrl) {
      attachImageInputs(inputPayload, videoModel, [input.referenceImageUrl]);
    } else if (isSpecialTemplate && input.characterReferenceImages?.length) {
      attachImageInputs(inputPayload, videoModel, input.characterReferenceImages);
    }

    if (input.duration !== undefined && input.duration > 0) {
      inputPayload.duration = getNearestDuration(input.duration, videoModel);
    }

    if (input.aspectRatio) {
      inputPayload.aspect_ratio = input.aspectRatio;
    }

    if (input.seed !== undefined) {
      inputPayload.seed = input.seed;
    }

    const hasVersion = videoModel.includes(':');

    const webhookWithModel = `${webhookUrl}&model=${encodeURIComponent(videoModel)}`;

    const predictionParams: any = {
      input: inputPayload,
      webhook: webhookWithModel,
      webhook_events_filter: ['completed'],
    };

    if (hasVersion) {
      predictionParams.version = videoModel.split(':')[1];
    } else {
      predictionParams.model = videoModel;
    }

    const prediction = await this.replicate.predictions.create(predictionParams);

    return {
      predictionId: prediction.id,
      status: prediction.status,
    };
  }
}

export function createVideoService(apiToken: string): VideoService {
  return new VideoService(apiToken);
}
