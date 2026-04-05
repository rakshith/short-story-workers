import { ScriptTemplateIds } from '../index';
import { bodyScienceShortsTools } from '../tools/body-science-shorts-tools';
import { BaseScriptAgent } from './base-agent';

export class BodyScienceShortsAgent extends BaseScriptAgent {
    readonly templateId = ScriptTemplateIds.BODY_SCIENCE_SHORTS;

    getTools() {
        return bodyScienceShortsTools;
    }
}
