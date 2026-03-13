// YouTube Shorts Template

import { Template } from '../types/index';
import { TEMPLATE_IDS, DEFAULT_TEMPLATE_CONFIG } from './registry';

export const youtubeShortTemplate: Template = {
  id: TEMPLATE_IDS.YOUTUBE_SHORTS,
  name: 'YouTube Shorts',
  description: 'Quick short-form video generation for social media',
  profileId: 'youtube-short',
  defaultConfig: {
    ...DEFAULT_TEMPLATE_CONFIG,
    videoConfig: {
      templateId: 'youtube-shorts',
      aspectRatio: '9:16',
      resolution: '720p',
      enableVoiceOver: true,
      enableCaptions: true,
      imageModel: 'black-forest-labs/flux-schnell',
      videoModel: 'wan-video/wan-2.5-t2v-fast',
      sceneReviewRequired: false,
    },
  },
};
