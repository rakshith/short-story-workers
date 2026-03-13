// Video Block - generates videos from images

import { Block, BlockInput, BlockOutput } from '../types';

export interface VideoBlockInput extends BlockInput {
  data: {
    scene: any;
    sceneIndex: number;
    generatedImageUrl?: string;
  };
}

export interface VideoBlockOutput extends BlockOutput {
  data?: {
    videoUrl: string;
    sceneIndex: number;
  };
}

export class VideoBlock implements Block {
  readonly id = 'video-gen';
  readonly capability = 'video-generation';

  async execute(input: VideoBlockInput): Promise<VideoBlockOutput> {
    const { scene, sceneIndex, generatedImageUrl } = input.data;
    const { storyId, userId, env, videoConfig, providers, jobId } = input.context as any;

    try {
      let videoProvider;
      
      if (providers?.videoProvider) {
        videoProvider = providers.videoProvider;
      } else {
        const { createVideoProvider } = await import('../providers/videoProvider');
        videoProvider = createVideoProvider(env.REPLICATE_API_TOKEN);
      }

      const baseUrl = env.APP_URL || 'https://create-story-worker.artflicks.workers.dev';
      const webhookUrl = `${baseUrl}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=video&userId=${userId}&jobId=${jobId}`;

      const result = await videoProvider.generate(
        {
          prompt: scene.imagePrompt,
          model: videoConfig.videoModel,
          resolution: videoConfig.resolution,
          duration: scene.duration,
          aspectRatio: videoConfig.aspectRatio,
          seed: videoConfig.preset?.seed,
          videoConfig,
          referenceImageUrl: generatedImageUrl || scene.generatedImageUrl,
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
          videoUrl: '',
          sceneIndex,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Video generation failed',
      };
    }
  }
}
