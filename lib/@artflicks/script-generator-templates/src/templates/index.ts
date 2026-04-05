import { ScriptTemplate } from '../types';
import { FacelessVideoTemplate } from './faceless-video';
import { CharacterStoryTemplate } from './character-story';
import { Skeleton3DShortsTemplate } from './skeleton-3d-shorts';
import { BodyScienceShortsTemplate } from './body-science-shorts';
import { ScriptToShortsTemplate } from './script-to-shorts';
import { registry } from '../registry';
export * from './base';
export * from './skeleton-3d-shorts-defaults';

export const ScriptTemplateIds = {
    FACELESS_VIDEO: 'faceless-video',
    CHARACTER_STORY: 'character-story',
    SKELETON_3D_SHORTS: 'skeleton-3d-shorts',
    BODY_SCIENCE_SHORTS: 'body-science-shorts',
    SCRIPT_TO_SHORTS: 'script-to-shorts',
} as const;

export type ScriptTemplateId = typeof ScriptTemplateIds[keyof typeof ScriptTemplateIds];

registry.register(new FacelessVideoTemplate());
registry.register(new CharacterStoryTemplate());
registry.register(new Skeleton3DShortsTemplate());
registry.register(new BodyScienceShortsTemplate());
registry.register(new ScriptToShortsTemplate());

export { registry };

export const defaultTemplate = registry.get(ScriptTemplateIds.FACELESS_VIDEO);

export function getTemplate(id?: string): ScriptTemplate | undefined {
    if (!id) return defaultTemplate;
    return registry.get(id) || defaultTemplate;
}
