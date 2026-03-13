// Template exports and auto-registration

import { templateRegistry } from './registry';
import { characterStoryTemplate } from './characterStory';
import { youtubeShortTemplate } from './youtubeShort';
import { skeleton3dShortsTemplate } from './skeleton3dShorts';
import { avatarVideoTemplate } from './avatarVideo';

templateRegistry.register(characterStoryTemplate);
templateRegistry.register(youtubeShortTemplate);
templateRegistry.register(skeleton3dShortsTemplate);
templateRegistry.register(avatarVideoTemplate);

export {  getTemplate, getAllTemplates } from './registry';
;
;
;
;
export { TEMPLATE_IDS } from './registry';
export type { Template } from '../types/index';
