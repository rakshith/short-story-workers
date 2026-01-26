import { ScriptTemplate } from '../types';
import { YouTubeShortsTemplate } from './youtube-shorts';
import { registry } from '../registry';

export const ScriptTemplateIds = {
    YOUTUBE_SHORTS: 'youtube-shorts',
    CHARACTER_STORY: 'character-story',
} as const;

export type ScriptTemplateId = typeof ScriptTemplateIds[keyof typeof ScriptTemplateIds];

import { CharacterStoryTemplate } from './character-story';

// Register default templates
registry.register(new YouTubeShortsTemplate());
registry.register(new CharacterStoryTemplate());

export { registry };

export const defaultTemplate = registry.get(ScriptTemplateIds.YOUTUBE_SHORTS);

export function getTemplate(id?: string): ScriptTemplate | undefined {
    if (!id) return defaultTemplate;
    return registry.get(id) || defaultTemplate;
}
