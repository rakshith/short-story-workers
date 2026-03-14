// YouTube Short Profile

import { Profile } from '../types/index';

export const youtubeShortProfile: Profile = {
  id: 'youtube-short',
  name: 'YouTube Short',
  description: 'Quick short-form video generation for social media platforms',
  config: {
    defaultModels: {
      script: 'gpt-4o',
      image: 'black-forest-labs/flux-schnell',
      video: 'wan-video/wan-2.5-t2v-fast',
      voice: 'eleven_multilingual_v2',
    },
    concurrency: 5,
    priority: 2,
  },
  blocks: [
    { id: 'script-gen', capability: 'script-generation' },
    { id: 'image-gen', capability: 'image-generation' },
    { id: 'voice-gen', capability: 'voice-generation' },
    { id: 'video-gen', capability: 'video-generation' },
  ],
};
