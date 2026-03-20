import { LanguageModel } from 'ai';
import { ScriptGenerator } from '../index';
import { ScriptTemplateIds } from '../templates';
import { ScriptGenerationContext, ScriptGenerationResult } from '../types';
import { BaseScriptAgent } from './base-agent';
import { YouTubeShortsAgent } from './youtube-shorts-agent';
import { CharacterStoryAgent } from './character-story-agent';
import { Skeleton3DShortsAgent } from './skeleton-3d-shorts-agent';
import { BodyScienceShortsAgent } from './body-science-shorts-agent';

export { BaseScriptAgent } from './base-agent';
export { YouTubeShortsAgent } from './youtube-shorts-agent';
export { CharacterStoryAgent } from './character-story-agent';
export { Skeleton3DShortsAgent } from './skeleton-3d-shorts-agent';
export { BodyScienceShortsAgent } from './body-science-shorts-agent';

export class ScriptAgentRouter {
    private agents: Map<string, BaseScriptAgent>;
    private defaultAgent: BaseScriptAgent;

    constructor(model: LanguageModel) {
        const generator = new ScriptGenerator(model);

        const youtubeAgent = new YouTubeShortsAgent(generator);
        const characterAgent = new CharacterStoryAgent(generator);
        const skeleton3dAgent = new Skeleton3DShortsAgent(generator);
        const bodyScienceAgent = new BodyScienceShortsAgent(generator);

        this.agents = new Map<string, BaseScriptAgent>([
            [ScriptTemplateIds.YOUTUBE_SHORTS, youtubeAgent],
            [ScriptTemplateIds.CHARACTER_STORY, characterAgent],
            [ScriptTemplateIds.SKELETON_3D_SHORTS, skeleton3dAgent],
            [ScriptTemplateIds.BODY_SCIENCE_SHORTS, bodyScienceAgent],
        ]);

        this.defaultAgent = youtubeAgent;
    }

    route(templateId?: string): BaseScriptAgent {
        if (!templateId) return this.defaultAgent;
        return this.agents.get(templateId) ?? this.defaultAgent;
    }

    async run(templateId: string | undefined, context: ScriptGenerationContext): Promise<ScriptGenerationResult> {
        return this.route(templateId).run(context);
    }
}
