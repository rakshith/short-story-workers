// Character Video workflow definition
// Wraps the existing story orchestrator pipeline into the workflow registry
// Handles both: (1) create from user script with hints, (2) resume video generation

import { Env } from '../types/env';
import { StoryTimeline, VideoConfig } from '../types';
import { WorkflowDefinition } from './registry';
import { orchestrateStoryCreation, orchestrateVideoResume } from '../services/story-orchestrator';
import { generateScript } from '../services/script-generation';
import { updateJobStatus } from '../services/queue-processor';
import { estimateDurationFromText } from '../services/script-parser';
import { DEFAULT_SKELETON_REFERENCES } from '../script-generator';
import { isImageMediaType } from '../utils/media-type';

export const characterVideoDefinition: WorkflowDefinition = {
    id: 'character-video',
    name: 'Character Video',

    validate: (body: any) => {
        // Resume request
        if (body.storyId) {
            if (!body.userId) return 'userId is required';
            return null;
        }
        // New story from script
        if (!body.prompt || !body.videoConfig || !body.userId) {
            return 'Missing required fields: prompt, videoConfig, userId';
        }
        return null;
    },

    execute: async (body, { jobId, resolved, baseUrl, env }) => {
        // ─── Resume path ──────────────────────────────────────────────
        if (body.storyId) {
            return handleResume(body, resolved, baseUrl, env);
        }

        // ─── New story from user script ───────────────────────────────
        return handleScriptToVideo(body, jobId, resolved, baseUrl, env);
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

async function handleScriptToVideo(
    body: any,
    jobId: string,
    resolved: { tier: string; priority: number },
    baseUrl: string,
    env: Env
) {
    // Estimate duration from text if not provided
    const estimatedDuration = body.duration || estimateDurationFromText(body.prompt);

    let minSceneDuration = 3;
    let maxSceneDuration = 6;

    if (isImageMediaType(body.videoConfig?.mediaType)) {
        minSceneDuration = 4;
        maxSceneDuration = 6;
    } else {
        const model = body.videoConfig?.model?.toLowerCase() || '';
        if (model.includes('veo')) {
            minSceneDuration = 4;
            maxSceneDuration = 8;
        } else {
            minSceneDuration = 5;
            maxSceneDuration = 8;
        }
    }

    // Auto-inject skeleton references if needed
    if (body.videoConfig?.templateId === 'skeleton-3d-shorts' && (!body.videoConfig?.characterReferenceImages?.length)) {
        body.videoConfig = { ...body.videoConfig, characterReferenceImages: DEFAULT_SKELETON_REFERENCES };
    }

    // Generate script from text using template-aware router
    const scriptResult = await generateScript(
        {
            prompt: body.prompt,
            duration: estimatedDuration,
            language: body.language || body.videoConfig?.language || 'en',
            templateId: body.videoConfig?.templateId,
            mediaType: body.videoConfig?.mediaType || 'image',
            characterReferenceImages: body.videoConfig?.characterReferenceImages,
        },
        env,
    );

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

    // Update videoConfig with the prompt for persistence
    const videoConfigWithPrompt = {
        ...body.videoConfig,
        prompt: body.prompt,
        script: body.prompt,
    };

    const result = await orchestrateStoryCreation({
        jobId,
        userId: body.userId,
        storyData,
        videoConfig: videoConfigWithPrompt,
        baseUrl,
        userTier: resolved.tier,
        priority: resolved.priority,
        seriesId: body.seriesId,
        teamId: body.teamId,
        title: body.title,
        usageData: scriptResult.usage,
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
