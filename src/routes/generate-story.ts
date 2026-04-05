// Generate and create story endpoint handler - AI script generation + story creation

import { Env } from '../types/env';
import { StoryTimeline, VideoConfig } from '../types';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';
import { parseTier, getPriorityForTier, getConcurrencyForTier } from '../config/tier-config';
import { orchestrateStoryCreation, orchestrateVideoResume } from '../services/story-orchestrator';
import { DEFAULT_SKELETON_REFERENCES } from '../script-generator';
import { estimateGenerationSeconds } from '../services/estimation';

interface GenerateStoryRequest {
    prompt: string;
    duration: number;
    videoConfig: VideoConfig;
    userId: string;
    seriesId?: string;
    teamId?: string;
    language?: string;
    model?: string;
    title?: string;
    userTier?: string;
    storyId?: string; // Existing story ID to resume video generation
    baseUrl?: string; // Base URL for webhooks (optional - derived from request if not provided)
}

/**
 * POST /generate-and-create-story
 * Generates a script from a prompt and creates a story with queued generation jobs
 * OR resumes video generation for an existing story with images
 */
export async function handleGenerateAndCreateStory(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
        const body: GenerateStoryRequest = await request.json();

        // Check if this is a resume request (storyId provided)
        if (body.storyId) {
            const baseUrl = url.origin;
            return handleResumeVideoGeneration(body, env, baseUrl);
        }

        // Validate required fields for new story (seriesId is optional)
        if (!body.prompt || !body.duration || !body.videoConfig || !body.userId) {
            return jsonResponse(
                { error: 'Missing required fields: prompt, duration, videoConfig, userId' },
                400
            );
        }

        // Parse user tier and get priority
        console.log(`[Generate Story] Raw tier values - body.userTier: ${body.userTier}, videoConfig.userTier: ${body.videoConfig.userTier}`);
        const userTier = parseTier(body.userTier || body.videoConfig.userTier);
        const priority = getPriorityForTier(userTier, env);
        const maxConcurrency = getConcurrencyForTier(userTier, env);

        // Ensure audioModel has a default value
        if (!body.videoConfig.audioModel) {
            body.videoConfig.audioModel = 'eleven_multilingual_v2';
        }

        if (body.videoConfig?.templateId === 'skeleton-3d-shorts' && (!body.videoConfig?.characterReferenceImages?.length)) {
            body.videoConfig = { ...body.videoConfig, characterReferenceImages: DEFAULT_SKELETON_REFERENCES };
        }

        // UPFRONT CONCURRENCY CHECK - Prevents retry overhead
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: activeJobs, error: checkError } = await supabase
            .from('story_jobs')
            .select('job_id')
            .eq('user_id', body.userId)
            .eq('status', 'processing');

        if (checkError) {
            console.error('[Generate Story] Failed to check concurrency:', checkError);
            // Fail-open: allow if check fails
        } else {
            const activeCount = activeJobs?.length || 0;
            if (activeCount >= maxConcurrency) {
                console.log(`[Generate Story] Concurrency limit reached for user ${body.userId} (${activeCount}/${maxConcurrency})`);
                return jsonResponse({
                    error: 'Concurrency limit reached',
                    message: `You have ${activeCount} active story generations. Your tier (${userTier}) allows maximum ${maxConcurrency} concurrent jobs. Please wait for a job to complete.`,
                    activeJobs: activeCount,
                    maxConcurrency,
                    tier: userTier,
                }, 429);
            }
        }

        // Generate job ID first
        const jobId = generateUUID();
        console.log(`[Generate Story] Job ID: ${jobId}, User: ${body.userId} (Tier: ${userTier}, Priority: ${priority}, Active: ${activeJobs?.length || 0}/${maxConcurrency})`);

        // Initialize job at 0%
        await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'processing',
            progress: 0,
            totalScenes: 0,
            imagesGenerated: 0,
            audioGenerated: 0,
            teamId: body.teamId,
        }, env);
        console.log(`[Generate Story] Job ${jobId} initialized at 0%`);

        // Generate script using AI
        const startTime = Date.now();
        const scriptResult = await generateAIScript(jobId, body, env);
        const durationSeconds = (Date.now() - startTime) / 1000;

        if (scriptResult instanceof Response) {
            return scriptResult;
        }

        const usageData = scriptResult.usage;
        const storyData = scriptResult.story;

        const estimatedDurationSeconds = estimateGenerationSeconds(
            storyData.scenes,
            body.videoConfig?.model || 'default'
        );

        // Use orchestrator for story creation
        const result = await orchestrateStoryCreation({
            jobId,
            userId: body.userId,
            storyData,
            videoConfig: body.videoConfig,
            baseUrl: url.origin,
            userTier,
            priority,
            seriesId: body.seriesId,
            teamId: body.teamId,
            title: body.title,
            usageData,
            durationSeconds,
            env,
        });

        if (!result.success) {
            return jsonResponse(
                { error: result.error || 'Failed to create story' },
                500
            );
        }

        return jsonResponse({
            success: true,
            jobId,
            message: 'Story generation started',
            storyId: result.storyId,
            generatedScript: storyData,
            estimated_duration_seconds: estimatedDurationSeconds,
            cost: result.cost,
            creditsDeducted: result.creditsDeducted,
            creditError: result.creditError,
        });
    } catch (error) {
        console.error('[Generate Story] Error:', error);
        return jsonResponse(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
            500
        );
    }
}

/**
 * Generates a script using AI from the prompt
 */
async function generateAIScript(
    jobId: string,
    body: GenerateStoryRequest,
    env: Env
): Promise<{ story: StoryTimeline; usage?: any } | Response> {
    console.log(`[Generate Story] Generating script from prompt: "${body.prompt.substring(0, 50)}..."`);

    const { generateScript } = await import('../services/script-generation');

    const scriptResult = await generateScript(
        {
            prompt: body.prompt,
            duration: body.duration,
            language: body.language || body.videoConfig?.language || 'en',
            model: body.model || body.videoConfig?.model || 'gpt-5.2',
            templateId: body.videoConfig?.templateId,
            mediaType: body.videoConfig?.mediaType || 'image',
            characterReferenceImages: body.videoConfig?.characterReferenceImages,
            speed: body.videoConfig?.speed,
        },
        env
    );

    if (!scriptResult.success || !scriptResult.story) {
        console.error('[Generate Story] Script generation failed:', scriptResult.error);
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
        return jsonResponse(
            { error: 'Failed to generate script', details: scriptResult.error },
            500
        );
    }

    console.log(`[Generate Story] Script generated successfully with ${scriptResult.story.scenes.length} scenes`);
    return {
        story: scriptResult.story,
        usage: scriptResult.usage
    };
}

/**
 * Handles resuming video generation for an existing story with images
 * Called when user passes storyId to continue from image generation to video generation
 */
async function handleResumeVideoGeneration(
    body: GenerateStoryRequest,
    env: Env,
    requestBaseUrl?: string
): Promise<Response> {
    const { storyId, userId } = body;

    if (!storyId || !userId) {
        return jsonResponse(
            { error: 'Missing required fields: storyId, userId' },
            400
        );
    }

    console.log(`[Generate Story] Resume video generation for story ${storyId}`);

    const userTier = parseTier(body.userTier || body.videoConfig?.userTier);
    const priority = getPriorityForTier(userTier, env);
    const webhookBaseUrl = requestBaseUrl || body.baseUrl || 'https://create-story-worker.artflicks.workers.dev';

    const result = await orchestrateVideoResume({
        storyId,
        userId,
        videoConfig: body.videoConfig,
        baseUrl: webhookBaseUrl,
        userTier,
        priority,
        teamId: body.teamId,
        title: body.title,
        env,
    });

    if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 
            : result.error?.includes('already been triggered') ? 400
            : result.error?.includes('No scenes have generated images') ? 400
            : result.error?.includes('invalid status') ? 400
            : 500;
        
        // Check if it's the "already have video" case which is actually success
        if (result.storyId && result.error === undefined) {
            return jsonResponse({
                success: true,
                storyId: result.storyId,
                message: 'All scenes already have video (including manually generated). Nothing to generate.',
            });
        }
        
        return jsonResponse(
            { error: result.error },
            statusCode
        );
    }

    return jsonResponse({
        success: true,
        storyId: result.storyId,
        message: 'Video generation started',
    });
}
