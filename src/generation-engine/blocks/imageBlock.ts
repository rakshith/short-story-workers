// Image Block - generates images for scenes

import { Block, BlockInput, BlockOutput } from '../types';

export interface ImageBlockInput extends BlockInput {
  data: {
    scene: any;
    sceneIndex: number;
    totalScenes: number;
  };
}

export interface ImageBlockOutput extends BlockOutput {
  data?: {
    imageUrl: string;
    sceneIndex: number;
  };
}

export class ImageBlock implements Block {
  readonly id = 'image-gen';
  readonly capability = 'image-generation';

  async execute(input: ImageBlockInput): Promise<ImageBlockOutput> {
    const { scene, sceneIndex, totalScenes } = input.data;
    const { storyId, userId, env, videoConfig } = input.context;

    try {
      const { createImageProvider } = await import('../providers/imageProvider');
      const imageProvider = createImageProvider(env.REPLICATE_API_TOKEN);

      const baseUrl = env.APP_URL || 'https://create-story-worker.artflicks.workers.dev';
      const sceneReviewParam = videoConfig.sceneReviewRequired ? '&sceneReviewRequired=true' : '';
      const webhookUrl = `${baseUrl}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=image&userId=${userId}&jobId=${input.context.jobId}${sceneReviewParam}`;

      const result = await imageProvider.generate(
        {
          prompt: scene.imagePrompt,
          model: videoConfig.imageModel,
          aspectRatio: videoConfig.aspectRatio,
          outputFormat: videoConfig.outputFormat,
          seed: videoConfig.preset?.seed,
          videoConfig,
          characterReferenceImages: videoConfig.characterReferenceImages,
        },
        {
          replicateApiToken: env.REPLICATE_API_TOKEN,
          webhookUrl,
          userId,
          seriesId: videoConfig.seriesId || '',
          storyId,
          sceneIndex,
        }
      );

      return {
        success: true,
        data: {
          imageUrl: '',
          sceneIndex,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image generation failed',
      };
    }
  }
}
