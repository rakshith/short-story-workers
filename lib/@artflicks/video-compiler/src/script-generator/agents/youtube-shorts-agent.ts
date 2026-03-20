import { ScriptTemplateIds } from '../templates';
import { youtubeShortsTols } from '../tools/youtube-shorts-tools';
import { BaseScriptAgent } from './base-agent';

export class YouTubeShortsAgent extends BaseScriptAgent {
    readonly templateId = ScriptTemplateIds.YOUTUBE_SHORTS;

    getTools() {
        return youtubeShortsTols;
    }
}
