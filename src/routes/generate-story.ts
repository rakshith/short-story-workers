// Generate and create story endpoint handler - AI script generation + story creation

import { Env, QueueMessage } from '../types/env';
import { StoryTimeline, VideoConfig } from '../types';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';
import { parseTier, getPriorityForTier, getConcurrencyForTier } from '../config/tier-config';
import { trackAIUsageInternal } from '../services/usage-tracking';

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
}

/**
 * POST /generate-and-create-story
 * Generates a script from a prompt and creates a story with queued generation jobs
 */
export async function handleGenerateAndCreateStory(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
        const body: GenerateStoryRequest = await request.json();

        // Validate required fields (seriesId is optional)
        if (!body.prompt || !body.duration || !body.videoConfig || !body.userId) {
            return jsonResponse(
                { error: 'Missing required fields: prompt, duration, videoConfig, userId' },
                400
            );
        }

        // Parse user tier and get priority
        console.log(`[Generate Story] Raw tier values - body.userTier: ${body.userTier}, videoConfig.userTier: ${body.videoConfig?.userTier}`);
        const userTier = parseTier(body.userTier || body.videoConfig?.userTier);
        const priority = getPriorityForTier(userTier, env);
        const maxConcurrency = getConcurrencyForTier(userTier, env);

        // Ensure audioModel has a default value
        if (!body.videoConfig.audioModel) {
            body.videoConfig.audioModel = 'eleven_multilingual_v2';
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
        const initResult = await initializeJob(jobId, body, env);
        if (initResult) return initResult;

        // Generate script using AI
        const startTime = Date.now();
        const scriptResult = await generateAIScript(jobId, body, env);
        const durationSeconds = (Date.now() - startTime) / 1000;

        if (scriptResult instanceof Response) {
            return scriptResult;
        }

        const usageData = scriptResult.usage;
        const storyData = scriptResult.story;

        // Create initial story in database
        const createResult = await createStoryRecord(jobId, body, storyData, env);

        if (createResult instanceof Response) {
            // Track with jobId if story creation failed (still incurred cost)
            if (usageData) {
                await trackAIUsageInternal(env, {
                    userId: body.userId,
                    teamId: body.teamId,
                    provider: 'openai',
                    model: body.model || body.videoConfig?.model || 'gpt-5.2',
                    feature: 'script-generation',
                    type: 'text',
                    inputTokens: usageData.promptTokens,
                    outputTokens: usageData.outputTokens,
                    totalTokens: usageData.totalTokens,
                    durationSeconds,
                    correlationId: jobId,
                    source: 'api'
                });
            }
            return createResult;
        }

        const storyId = createResult.id;

        // Track script generation with storyId so all costs for this story can be queried together
        if (usageData) {
            await trackAIUsageInternal(env, {
                userId: body.userId,
                teamId: body.teamId,
                provider: 'openai',
                model: body.model || body.videoConfig?.model || 'gpt-5.2',
                feature: 'script-generation',
                type: 'text',
                inputTokens: usageData.promptTokens,
                outputTokens: usageData.outputTokens,
                totalTokens: usageData.totalTokens,
                durationSeconds,
                correlationId: storyId,
                source: 'api'
            });
        }

        // Initialize Durable Object for this story
        await initializeCoordinator(storyId, body.userId, storyData, body.videoConfig, env);

        // Queue generation jobs with tier-based priority
        await queueGenerationJobs(jobId, body, storyId, storyData, url.origin, userTier, priority, env);

        return jsonResponse({
            success: true,
            jobId,
            message: 'Story generation started',
            storyId,
            generatedScript: storyData,
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
 * Initializes the job in the database at 0% progress
 */
async function initializeJob(
    jobId: string,
    body: GenerateStoryRequest,
    env: Env
): Promise<Response | null> {
    try {
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
        return null;
    } catch (error) {
        console.error(`[Generate Story] Failed to create job ${jobId} in database:`, error);
        return jsonResponse(
            {
                error: 'Failed to initialize job',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
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

    // Restore import
    const { generateScript } = await import('../services/script-generation');

    const scriptResult = await generateScript(
        {
            prompt: body.prompt,
            duration: body.duration,
            language: body.language || body.videoConfig?.language || 'en',
            model: body.model || body.videoConfig?.model || 'gpt-5.2',
            templateId: body.videoConfig?.templateId,
            characterReferenceImages: body.videoConfig?.characterReferenceImages
        },
        env.OPENAI_API_KEY
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
 * Creates the story record in the database
 */
async function createStoryRecord(
    jobId: string,
    body: GenerateStoryRequest,
    storyData: StoryTimeline,
    env: Env
): Promise<{ id: string } | Response> {
    try {
        const { StoryService } = await import('../services/supabase');
        const { ProjectStatus } = await import('../types');
        const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const createdStory = await storyService.createStory({
            userId: body.userId,
            seriesId: body.seriesId,
            title: storyData.title,
            videoType: body.videoConfig?.videoType || 'faceless-video',
            story: storyData,
            status: ProjectStatus.PROCESSING,
            videoConfig: body.videoConfig,
            storyCost: body.videoConfig?.estimatedCredits,
            teamId: body.teamId,
        });
        console.log(`[Generate Story] Initial story created in database with ID: ${createdStory.id}`);

        // Progress Update: Script generated & story created - 25%
        await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: ProjectStatus.PROCESSING,
            progress: 25,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            storyId: createdStory.id,
            teamId: body.teamId,
        }, env);
        console.log(`[Generate Story] Progress updated to 25% - Script & story created`);

        return createdStory;
    } catch (error) {
        console.error(`[Generate Story] Failed to create story:`, error);

        // Check if it's a duplicate title error
        const errorMessage = error instanceof Error ? error.message : '';
        const isDuplicateTitle = errorMessage.includes('unique_user_story_title');

        await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'failed',
            progress: 0,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: isDuplicateTitle
                ? `A story with the title "${storyData.title}" already exists`
                : errorMessage || 'Failed to create story',
            teamId: body.teamId,
        }, env);

        return jsonResponse(
            {
                error: isDuplicateTitle ? 'Duplicate story title' : 'Failed to create story',
                message: isDuplicateTitle
                    ? `A story with the title "${storyData.title}" already exists. Please use a different prompt or modify your request.`
                    : errorMessage || 'Unknown error'
            },
            isDuplicateTitle ? 409 : 500
        );
    }
}

/**
 * Initializes the Durable Object coordinator for a story
 */
async function initializeCoordinator(
    storyId: string,
    userId: string,
    storyData: StoryTimeline,
    videoConfig: VideoConfig,
    env: Env
): Promise<void> {
    const coordinatorId = env.STORY_COORDINATOR.idFromName(storyId);
    const coordinator = env.STORY_COORDINATOR.get(coordinatorId);
    await coordinator.fetch(new Request('http://do/init', {
        method: 'POST',
        body: JSON.stringify({
            storyId,
            userId,
            scenes: storyData.scenes,
            totalScenes: storyData.scenes.length,
            videoConfig,
        }),
    }));
    console.log(`[Generate Story] Durable Object initialized for story ${storyId}`);
}

/**
 * Queues visual and audio generation jobs for all scenes with tier-based priority
 */
async function queueGenerationJobs(
    jobId: string,
    body: GenerateStoryRequest,
    storyId: string,
    storyData: StoryTimeline,
    baseUrl: string,
    userTier: string,
    priority: number,
    env: Env
): Promise<void> {
    const mediaType = body.videoConfig?.mediaType === 'video' ? 'video' : 'image';

    // Queue visual generation jobs with tier and priority
    const visualPromises = storyData.scenes.map((scene, index) => {
        const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: storyData.title || body.title || '',
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: index,
            type: mediaType,
            baseUrl,
            teamId: body.teamId,
            userTier,
            priority,
        };
        return env.STORY_QUEUE.send(message);
    });
    await Promise.all(visualPromises);
    console.log(`[Generate Story] Queued ${storyData.scenes.length} ${mediaType} generation jobs (Priority: ${priority})`);

    // Queue audio generation jobs with tier and priority
    const audioPromises = storyData.scenes.map((scene, index) => {
        const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: storyData.title || body.title || '',
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: index,
            type: 'audio',
            baseUrl,
            teamId: body.teamId,
            userTier,
            priority,
        };
        return env.STORY_QUEUE.send(message);
    });
    await Promise.all(audioPromises);
    console.log(`[Generate Story] Queued ${storyData.scenes.length} audio generation jobs (Priority: ${priority})`);

}
