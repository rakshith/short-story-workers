// Skeleton 3D Shorts Template

import { Template } from '../types/index';
import { TEMPLATE_IDS, DEFAULT_TEMPLATE_CONFIG } from './registry';

export const skeleton3dShortsTemplate: Template = {
  id: TEMPLATE_IDS.SKELETON_3D_SHORTS,
  name: 'Skeleton 3D Shorts',
  description: '3D animated shorts using skeleton-style character references with Grok image generation',
  profileId: 'skeleton-3d-profile',
  defaultConfig: {
    ...DEFAULT_TEMPLATE_CONFIG,
    videoConfig: {
      templateId: 'skeleton-3d-shorts',
      aspectRatio: '16:9',
      resolution: '720p',
      enableVoiceOver: true,
      enableCaptions: true,
      imageModel: 'xai/grok-imagine-image',
      videoModel: 'minimax-video-01',
    },
    generationOptions: {
      enableSceneReview: true,
      enableAutoVideoGeneration: false,
      maxRetries: 3,
      timeoutMs: 300000,
    },
  },
};
