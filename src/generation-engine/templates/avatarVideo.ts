// Avatar Video Template (Future)

import { Template } from '../types/index';
import { TEMPLATE_IDS, DEFAULT_TEMPLATE_CONFIG } from './registry';

export const avatarVideoTemplate: Template = {
  id: TEMPLATE_IDS.AVATAR_VIDEO,
  name: 'Avatar Video',
  description: 'Create videos with avatar characters (coming soon)',
  profileId: 'avatar-pipeline',
  defaultConfig: {
    ...DEFAULT_TEMPLATE_CONFIG,
    videoConfig: {
      templateId: 'avatar-video',
      aspectRatio: '16:9',
      resolution: '1080p',
      enableVoiceOver: true,
      enableCaptions: true,
    },
  },
};
