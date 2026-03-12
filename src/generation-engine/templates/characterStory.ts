// Character Story Template

import { Template } from '../types/index';
import { TEMPLATE_IDS, DEFAULT_TEMPLATE_CONFIG } from './registry';

export const characterStoryTemplate: Template = {
  id: TEMPLATE_IDS.CHARACTER_STORY,
  name: 'Character Story',
  description: 'Create cinematic stories featuring character references with full generation pipeline',
  profileId: 'cinematic-story',
  defaultConfig: {
    ...DEFAULT_TEMPLATE_CONFIG,
    videoConfig: {
      templateId: 'character-story',
      aspectRatio: '16:9',
      resolution: '720p',
      enableVoiceOver: true,
      enableCaptions: true,
      imageModel: 'black-forest-labs/flux-schnell',
      videoModel: 'minimax-video-01',
    },
  },
};
