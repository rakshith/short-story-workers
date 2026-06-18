// Talking Avatar workflow definition
// Wraps the existing talking avatar pipeline into the workflow registry

import { Env } from '../types/env';
import { WorkflowDefinition } from './registry';
import { executeTalkingAvatarPipeline } from '../services/talking-avatar-pipeline';

export const talkingAvatarDefinition: WorkflowDefinition = {
    id: 'talking-avatar',
    name: 'Talking Avatar',

    validate: (body: any) => {
        const vc = body.videoConfig;
        if (!vc?.avatarImageUrl || !vc?.model || !body.userId) {
            return 'Missing required fields: videoConfig.avatarImageUrl, videoConfig.model, userId';
        }
        if (!body.prompt?.trim() && !vc?.audioUrl) {
            return 'Either prompt (script) or videoConfig.audioUrl is required';
        }
        if (body.prompt?.trim() && !vc?.voice) {
            return 'voice is required when script is provided';
        }
        if (body.duration < 5) {
            return 'Duration must be at least 5 seconds';
        }
        if (!['standard', 'pro'].includes(vc.model)) {
            return 'videoConfig.model must be "standard" or "pro"';
        }
        return null;
    },

    execute: async (body, { jobId, resolved, baseUrl, env }) => {
        const vc = body.videoConfig;

        // Generate title from speech text using script generation template
        let title = body.title || 'Talking Avatar';
        let finalMotionInstructions = vc.motionInstructions || '';

        const shouldEnhance = vc.enhanceWithAI === true && vc.motionInstructions?.trim();

        if (body.prompt?.trim()) {
            try {
                const { generateScript } = await import('../services/script-generation');
                const titleResult = await generateScript({
                    prompt: body.prompt,
                    duration: body.duration || 5,
                    templateId: 'talking-avatar',
                    ...(shouldEnhance && { motionInstructions: vc.motionInstructions }),
                }, env);
                if (titleResult.success && titleResult.story?.title) {
                    title = titleResult.story.title;
                }
                if (shouldEnhance && titleResult.success && titleResult.enhancedMotionInstructions) {
                    finalMotionInstructions = titleResult.enhancedMotionInstructions;
                    console.log('[Talking Avatar] Motion instructions enhanced via AI');
                }
            } catch (err) {
                console.warn('[Talking Avatar] Title generation failed, using default:', err);
            }
        }

        const result = await executeTalkingAvatarPipeline({
            jobId,
            avatarImageUrl: vc.avatarImageUrl,
            script: body.prompt || '',
            voice: vc.voice || '',
            audioModel: vc.audioModel || 'eleven_multilingual_v2',
            duration: body.duration,
            language: vc.language || 'en',
            aspectRatio: vc.aspectRatio || '9:16',
            model: vc.model,
            userId: body.userId,
            seriesId: body.seriesId,
            teamId: body.teamId,
            title,
            userTier: resolved.tier,
            priority: resolved.priority,
            baseUrl,
            audioUrl: vc.audioUrl,
            backgroundMusic: vc.music,
            musicVolume: vc.musicVolume,
            motionInstructions: finalMotionInstructions,
            enhanceWithAI: vc.enhanceWithAI,
            enableCaptions: vc.enableCaptions,
            videoConfig: vc,
            env,
        });

        return {
            success: result.success,
            storyId: result.storyId,
            error: result.error,
            cost: result.cost,
            creditsDeducted: result.creditsDeducted,
            creditError: result.creditError,
        };
    },
};
