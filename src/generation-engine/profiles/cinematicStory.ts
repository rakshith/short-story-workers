// Cinematic Story Profile

import { Profile, ProfileConfig } from '../types/index';

export const cinematicStoryProfile: Profile = {
  id: 'cinematic-story',
  name: 'Cinematic Story',
  description: 'Full cinematic pipeline: prompt → script → scenes → images → voice → video',
  config: {
    defaultModels: {
      script: 'gpt-4o',
      image: 'black-forest-labs/flux-schnell',
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
