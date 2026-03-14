// Avatar Pipeline Profile (Future)

import { Profile } from '../types/index';

export const avatarPipelineProfile: Profile = {
  id: 'avatar-pipeline',
  name: 'Avatar Pipeline',
  description: 'Avatar-based video generation pipeline (coming soon)',
  config: {
    defaultModels: {
      script: 'gpt-4o',
      image: 'black-forest-labs/flux-schnell',
      video: 'minimax-video-01',
      voice: 'eleven_multilingual_v2',
    },
    concurrency: 2,
    priority: 1,
  },
  blocks: [
    { id: 'script-gen', capability: 'script-generation' },
    { id: 'avatar-gen', capability: 'image-generation' },
    { id: 'voice-gen', capability: 'voice-generation' },
    { id: 'video-gen', capability: 'video-generation' },
  ],
};
