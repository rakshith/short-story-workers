import { ScriptTemplate } from '../types';
import { FacelessVideoTemplate } from './faceless-video';
import { CharacterStoryTemplate } from './character-story';
import { Skeleton3DShortsTemplate } from './skeleton-3d-shorts';
import { BodyScienceShortsTemplate } from './body-science-shorts';
import { ScriptToShortsTemplate } from './script-to-shorts';
import { ScreenplayGeneratorTemplate } from './screenplay-generator';
import { registry } from '../registry';
export * from './base';
export * from './skeleton-3d-shorts-defaults';

export const ScriptTemplateIds = {
    FACELESS_VIDEO: 'faceless-video',
    CHARACTER_STORY: 'character-story',
    SKELETON_3D_SHORTS: 'skeleton-3d-shorts',
    BODY_SCIENCE_SHORTS: 'body-science-shorts',
    SCRIPT_TO_SHORTS: 'script-to-shorts',
    SCREENPLAY_GENERATOR: 'screenplay-generator',
} as const;

export type ScriptTemplateId = typeof ScriptTemplateIds[keyof typeof ScriptTemplateIds];

let templatesInitialized = false;

function initializeTemplates() {
    if (templatesInitialized) return;
    
    registry.register(new FacelessVideoTemplate());
    registry.register(new CharacterStoryTemplate());
    registry.register(new Skeleton3DShortsTemplate());
    registry.register(new BodyScienceShortsTemplate());
    registry.register(new ScriptToShortsTemplate());
    registry.register(new ScreenplayGeneratorTemplate());
    
    templatesInitialized = true;
}

export { registry };

import { z } from 'zod';

export const defaultTemplate: ScriptTemplate = {
    manifest: {
        id: 'faceless-video',
        name: 'Faceless Video',
        version: '1.0.0',
        description: 'Default template',
    },
    getSystemPrompt: () => '',
    getSchema: () => z.any(),
};

export function getTemplate(id?: string): ScriptTemplate | undefined {
    initializeTemplates();
    
    if (!id) {
        const dt = registry.get(ScriptTemplateIds.FACELESS_VIDEO);
        return dt || defaultTemplate;
    }
    return registry.get(id);
}