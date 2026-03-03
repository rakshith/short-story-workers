import { ScriptTemplate } from '../types';
import { YouTubeShortsTemplate } from './youtube-shorts';
import { CharacterStoryTemplate } from './character-story';
import { Skeleton3DShortsTemplate } from './skeleton-3d-shorts';
import { registry } from '../registry';

export const ScriptTemplateIds = {
    YOUTUBE_SHORTS: 'youtube-shorts',
    CHARACTER_STORY: 'character-story',
    SKELETON_3D_SHORTS: 'skeleton-3d-shorts',
} as const;

export type ScriptTemplateId = typeof ScriptTemplateIds[keyof typeof ScriptTemplateIds];

// Register default templates
registry.register(new YouTubeShortsTemplate());
registry.register(new CharacterStoryTemplate());
registry.register(new Skeleton3DShortsTemplate());

export { registry };

export const defaultTemplate = registry.get(ScriptTemplateIds.YOUTUBE_SHORTS);

export function getTemplate(id?: string): ScriptTemplate | undefined {
    if (!id) return defaultTemplate;
    return registry.get(id) || defaultTemplate;
}
