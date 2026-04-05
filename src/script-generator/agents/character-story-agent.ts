import { ScriptTemplateIds } from '../templates';
import { characterStoryTools } from '../tools/character-story-tools';
import { BaseScriptAgent } from './base-agent';

export class CharacterStoryAgent extends BaseScriptAgent {
    readonly templateId = ScriptTemplateIds.CHARACTER_STORY;

    getTools() {
        return characterStoryTools;
    }
}
