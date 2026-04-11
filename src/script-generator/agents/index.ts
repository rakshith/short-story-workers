import { LanguageModel } from 'ai';
import { ScriptGenerator, ScriptTemplateIds, ScriptGenerationContext, ScriptGenerationResult } from '../index';
import { BaseScriptAgent } from './base-agent';
import { FacelessVideoAgent } from './faceless-video-agent';
import { CharacterStoryAgent } from './character-story-agent';
import { Skeleton3DShortsAgent } from './skeleton-3d-shorts-agent';
import { BodyScienceShortsAgent } from './body-science-shorts-agent';
import { ScriptToShortsAgent } from './script-to-shorts-agent';
import { TalkingCharacter3DAgent } from './talking-character-3d-agent';

export { BaseScriptAgent } from './base-agent';
export { FacelessVideoAgent } from './faceless-video-agent';
export { CharacterStoryAgent } from './character-story-agent';
export { Skeleton3DShortsAgent } from './skeleton-3d-shorts-agent';
export { BodyScienceShortsAgent } from './body-science-shorts-agent';
export { ScriptToShortsAgent } from './script-to-shorts-agent';
export { TalkingCharacter3DAgent } from './talking-character-3d-agent';

export class ScriptAgentRouter {
    private agents: Map<string, BaseScriptAgent>;
    private defaultAgent: BaseScriptAgent;

    constructor(model: LanguageModel) {
        const generator = new ScriptGenerator(model);

        const facelessVideoAgent = new FacelessVideoAgent(generator);
        const characterAgent = new CharacterStoryAgent(generator);
        const skeleton3dAgent = new Skeleton3DShortsAgent(generator);
        const bodyScienceAgent = new BodyScienceShortsAgent(generator);
        const scriptToShortsAgent = new ScriptToShortsAgent(generator);
        const talkingCharacter3DAgent = new TalkingCharacter3DAgent(generator);

        this.agents = new Map<string, BaseScriptAgent>([
            [ScriptTemplateIds.FACELESS_VIDEO, facelessVideoAgent],
            [ScriptTemplateIds.CHARACTER_STORY, characterAgent],
            [ScriptTemplateIds.SKELETON_3D_SHORTS, skeleton3dAgent],
            [ScriptTemplateIds.BODY_SCIENCE_SHORTS, bodyScienceAgent],
            [ScriptTemplateIds.SCRIPT_TO_SHORTS, scriptToShortsAgent],
            [ScriptTemplateIds.TALKING_CHARACTER_3D, talkingCharacter3DAgent],
        ]);

        this.defaultAgent = facelessVideoAgent;
    }

    route(templateId?: string): BaseScriptAgent {
        if (!templateId) return this.defaultAgent;
        return this.agents.get(templateId) ?? this.defaultAgent;
    }

    async run(templateId: string | undefined, context: ScriptGenerationContext): Promise<ScriptGenerationResult> {
        return this.route(templateId).run(context);
    }
}
