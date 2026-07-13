// AI UGC Ads Workflow Config — Configuration for the AI UGC Ads agent pipeline
// Defines which agents are used and how scenes are structured

import { WorkflowConfig } from './workflow-config.types';

const MAX_SHOWCASE_ITEMS = 20;

export const aiUgcAdsConfig: WorkflowConfig = {
  id: 'ai-ugc-ads',
  name: 'AI UGC Ads',

  agents: {
    vision: { enabled: true },
    classification: { enabled: true },
    scenePlanning: { enabled: true },
    avatar: { enabled: true, model: 'kling-avatar-v2' },
    generation: { enabled: true },
    composition: { enabled: true },
  },

  scenes: {
    hook:    { duration: 5, sceneKind: 'hook',    mediaSource: 'avatar' },
    feature: { duration: 6, sceneKind: 'feature', mediaSource: 'user-uploaded' },
    proof:   { duration: 5, sceneKind: 'proof',   mediaSource: 'user-uploaded' },
    cta:     { duration: 5, sceneKind: 'cta',     mediaSource: 'avatar' },
  },

  validate: (body: any) => {
    if (!body?.userId || typeof body.userId !== 'string') {
      return 'userId is required';
    }
    if (!body?.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return 'title is required and must be non-empty';
    }
    if (!body?.videoConfig || typeof body.videoConfig !== 'object') {
      return 'videoConfig is required';
    }
    if (!body.videoConfig.avatarImageUrl || typeof body.videoConfig.avatarImageUrl !== 'string') {
      return 'videoConfig.avatarImageUrl is required';
    }
    if (!body?.showcase || typeof body.showcase !== 'object') {
      return 'showcase is required';
    }
    if (!Array.isArray(body.showcase.items) || body.showcase.items.length === 0) {
      return 'showcase.items must be a non-empty array';
    }
    if (body.showcase.items.length > MAX_SHOWCASE_ITEMS) {
      return `showcase.items must have at most ${MAX_SHOWCASE_ITEMS} items`;
    }
    for (let i = 0; i < body.showcase.items.length; i++) {
      const item = body.showcase.items[i];
      if (!item.url || typeof item.url !== 'string') {
        return `showcase.items[${i}].url is required`;
      }
      if (!['video', 'image'].includes(item.type)) {
        return `showcase.items[${i}].type must be "video" or "image"`;
      }
    }
    return null;
  },
};
