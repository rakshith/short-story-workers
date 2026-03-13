// Template Registry for Generation Engine

import { Template, TemplateConfig } from '../types';

class TemplateRegistry {
  private templates: Map<string, Template> = new Map();

  register(template: Template): void {
    if (this.templates.has(template.id)) {
      console.warn(`[TemplateRegistry] Template ${template.id} already registered, overwriting`);
    }
    this.templates.set(template.id, template);
  }

  get(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getAll(): Template[] {
    return Array.from(this.templates.values());
  }

  list(): string[] {
    return Array.from(this.templates.keys());
  }
}

export const templateRegistry = new TemplateRegistry();

function registerTemplate(template: Template): void {
  templateRegistry.register(template);
}

export function getTemplate(id: string): Template | undefined {
  return templateRegistry.get(id);
}

export function getAllTemplates(): Template[] {
  return templateRegistry.getAll();
}

export const TEMPLATE_IDS = {
  CHARACTER_STORY: 'character-story',
  YOUTUBE_SHORTS: 'youtube-shorts',
  SKELETON_3D_SHORTS: 'skeleton-3d-shorts',
  AVATAR_VIDEO: 'avatar-video',
} as const;

export type TemplateId = typeof TEMPLATE_IDS[keyof typeof TEMPLATE_IDS];

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  videoConfig: {},
  generationOptions: {
    enableSceneReview: false,
    enableAutoVideoGeneration: true,
    maxRetries: 3,
    timeoutMs: 300000,
  },
};
