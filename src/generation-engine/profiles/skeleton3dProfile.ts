// Skeleton 3D Profile

import { Profile } from '../types/index';

export const skeleton3dProfile: Profile = {
  id: 'skeleton-3d-profile',
  name: 'Skeleton 3D',
  description: '3D animated shorts using skeleton-style character references with Grok image generation',
  config: {
    defaultModels: {
      script: 'gpt-4o',
      image: 'xai/grok-imagine-image',
      video: 'minimax-video-01',
      voice: 'eleven_multilingual_v2',
    },
    concurrency: 3,
    priority: 1,
  },
  blocks: [
    { id: 'script-gen', capability: 'script-generation' },
    { id: 'scene-parse', capability: 'scene-parsing' },
    { id: 'image-gen', capability: 'image-generation' },
    { id: 'voice-gen', capability: 'voice-generation' },
    { id: 'video-gen', capability: 'video-generation' },
  ],
};
