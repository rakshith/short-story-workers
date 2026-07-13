// Faceless Video workflow definition
// Wraps the existing story orchestrator pipeline into the workflow registry
// Handles both: (1) create from existing script, (2) generate script + create

import { Env } from '../types/env';
import { StoryTimeline, VideoConfig } from '../types';
import { WorkflowDefinition } from './registry';
import { orchestrateStoryCreation, orchestrateVideoResume } from '../services/story-orchestrator';
import { generateScript } from '../services/script-generation';
import { updateJobStatus } from '../services/queue-processor';
import { Logger } from '../utils/logger';
import { resolveWorkflow } from '../utils/workflow-resolver';

const workflowLogger = new Logger('faceless-video');

export const facelessVideoDefinition: WorkflowDefinition = {
    id: 'faceless-video',
    name: 'Faceless Video',

    validate: (body: any) => {
        // Resume request
        if (body.storyId) {
            if (!body.userId) return 'userId is required';
            return null;
        }
        // New story from existing script
        if (body.script) {
            if (!body.videoConfig || !body.userId) {
                return 'Missing required fields: script, videoConfig, userId';
            }
            return null;
        }
        // New story with AI script generation
        if (!body.prompt || !body.duration || !body.videoConfig || !body.userId) {
            return 'Missing required fields: prompt, duration, videoConfig, userId';
        }
        return null;
    },

    execute: async (body, { jobId, resolved, baseUrl, env }) => {
        // ─── Resume path ──────────────────────────────────────────────
        if (body.storyId) {
            workflowLogger.info('Resume path', { jobId, userId: body.userId, storyId: body.storyId });
            return handleResume(body, resolved, baseUrl, env);
        }

        // ─── New story from existing script ───────────────────────────
        if (body.script) {
            workflowLogger.info('Script-to-video path', { jobId, userId: body.userId });
            return handleCreateFromScript(body, jobId, resolved, baseUrl, env);
        }

        // ─── New story with AI script generation ──────────────────────
        workflowLogger.info('Idea-to-video path', { jobId, userId: body.userId, prompt: body.prompt?.substring(0, 50) });
        return handleGenerateAndCreate(body, jobId, resolved, baseUrl, env);
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleResume(
    body: any,
    resolved: { tier: string; priority: number },
    baseUrl: string,
    env: Env
) {
    const result = await orchestrateVideoResume({
        storyId: body.storyId,
        userId: body.userId,
        videoConfig: body.videoConfig,
        baseUrl,
        userTier: resolved.tier,
        priority: resolved.priority,
        teamId: body.teamId,
        title: body.title,
        env,
    });

    if (!result.success) {
        return { success: false, error: result.error, storyId: result.storyId };
    }
    return { success: true, storyId: result.storyId };
}

async function handleCreateFromScript(
    body: any,
    jobId: string,
    resolved: { tier: string; priority: number },
    baseUrl: string,
    env: Env
) {
    // Always process script through script-to-shorts agent
    const scriptResult = await generateScript(
        {
            prompt: body.script,
            duration: body.duration || 15,
            language: body.language || body.videoConfig?.language || 'en',
            model: body.model || body.videoConfig?.model || 'gpt-5.2',
            templateId: 'script-to-shorts',
            mediaType: (body.videoConfig?.mediaType === 'ai-videos' ? 'video' : 'image') as any,
            characterReferenceImages: body.videoConfig?.characterReferenceImages,
            speed: body.videoConfig?.speed,
            stylePrompt: body.videoConfig?.preset?.stylePrompt,
        },
        env
    );

    if (!scriptResult.success || !scriptResult.story) {
        return { success: false, error: scriptResult.error || 'Failed to process script' };
    }

    const storyData = scriptResult.story;

    if (!storyData.scenes || !Array.isArray(storyData.scenes) || storyData.scenes.length === 0) {
        return { success: false, error: 'Script must contain at least one scene' };
    }

    // Update job with correct scene count
    await updateJobStatus(jobId, {
        jobId,
        userId: body.userId,
        status: 'processing',
        progress: 0,
        totalScenes: storyData.scenes.length,
        imagesGenerated: 0,
        audioGenerated: 0,
        teamId: body.teamId,
    }, env);

    const result = await orchestrateStoryCreation({
        jobId,
        userId: body.userId,
        storyData,
        videoConfig: body.videoConfig,
        baseUrl,
        userTier: resolved.tier,
        priority: resolved.priority,
        seriesId: body.seriesId,
        teamId: body.teamId,
        title: body.title,
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
}

async function handleGenerateAndCreate(
    body: any,
    jobId: string,
    resolved: { tier: string; priority: number },
    baseUrl: string,
    env: Env
) {
    // Ensure audioModel has a default
    if (!body.videoConfig.audioModel) {
        body.videoConfig.audioModel = 'eleven_multilingual_v2';
    }

    // Generate script using AI
    const scriptStart = Date.now();
    const scriptResult = await generateScript(
        {
            prompt: body.prompt,
            duration: body.duration,
            language: body.language || body.videoConfig?.language || 'en',
            model: body.model || body.videoConfig?.model || 'gpt-5.2',
            templateId: body.videoConfig?.templateId,
            mediaType: (body.videoConfig?.mediaType === 'ai-videos' ? 'video' : 'image') as any,
            characterReferenceImages: body.videoConfig?.characterReferenceImages,
            speed: body.videoConfig?.speed,
            stylePrompt: body.videoConfig?.preset?.stylePrompt,
        },
        env
    );
    const scriptDurationSeconds = Math.round((Date.now() - scriptStart) / 1000);

    if (!scriptResult.success || !scriptResult.story) {
        await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'failed',
            progress: 0,
            totalScenes: 0,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: scriptResult.error || 'Failed to generate script',
            teamId: body.teamId,
        }, env);
        return { success: false, error: scriptResult.error || 'Failed to generate script' };
    }

    const storyData = scriptResult.story;

    const result = await orchestrateStoryCreation({
        jobId,
        userId: body.userId,
        storyData,
        videoConfig: body.videoConfig,
        baseUrl,
        userTier: resolved.tier,
        priority: resolved.priority,
        seriesId: body.seriesId,
        teamId: body.teamId,
        title: body.title,
        usageData: scriptResult.usage,
        durationSeconds: scriptDurationSeconds,
        env,
        templateConfig: (scriptResult as any).templateConfig,
    });

    return {
        success: result.success,
        storyId: result.storyId,
        error: result.error,
        cost: result.cost,
        creditsDeducted: result.creditsDeducted,
        creditError: result.creditError,
    };
}
