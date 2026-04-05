import { ScriptTemplateIds } from '../index';
import { facelessVideoTools } from '../tools/faceless-video-tools';
import { BaseScriptAgent } from './base-agent';

export class FacelessVideoAgent extends BaseScriptAgent {
    readonly templateId = ScriptTemplateIds.FACELESS_VIDEO;

    getTools() {
        return facelessVideoTools;
    }
}