import { ScriptTemplateIds } from '../index';
import { skeleton3DShortsTools } from '../tools/skeleton-3d-shorts-tools';
import { BaseScriptAgent } from './base-agent';

export class Skeleton3DShortsAgent extends BaseScriptAgent {
    readonly templateId = ScriptTemplateIds.SKELETON_3D_SHORTS;

    getTools() {
        return skeleton3DShortsTools;
    }
}
