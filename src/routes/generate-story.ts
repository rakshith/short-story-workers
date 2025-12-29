// Generate and create story endpoint handler - AI script generation + story creation

import { Env, QueueMessage } from '../types/env';
import { StoryTimeline, VideoConfig } from '../types';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';

interface GenerateStoryRequest {
    prompt: string;
    duration: number;
    videoConfig: VideoConfig;
    userId: string;
    seriesId: string;
    teamId?: string;
    language?: string;
    model?: string;
    title?: string;
}

/**
 * POST /generate-and-create-story
 * Generates a script from a prompt and creates a story with queued generation jobs
 */
export async function handleGenerateAndCreateStory(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
        const body: GenerateStoryRequest = await request.json();

        // Validate required fields
        if (!body.prompt || !body.duration || !body.videoConfig || !body.userId || !body.seriesId) {
            return jsonResponse(
                { error: 'Missing required fields: prompt, duration, videoConfig, userId, seriesId' },
                400
            );
        }

        // Generate job ID first
        const jobId = generateUUID();
        console.log(`[Generate Story] Job ID: ${jobId}, User: ${body.userId}`);

        // Initialize job at 0%
        const initResult = await initializeJob(jobId, body, env);
        if (initResult) return initResult;

        // Generate script using AI
        const scriptResult = await generateAIScript(jobId, body, env);
        if (scriptResult instanceof Response) {
            return scriptResult;
        }

        const storyData = scriptResult.story;

        // Create initial story in database
        const createResult = await createStoryRecord(jobId, body, storyData, env);
        if (createResult instanceof Response) {
            return createResult;
        }

        const storyId = createResult.id;

        // Initialize Durable Object for this story
        await initializeCoordinator(storyId, body.userId, storyData, env);

        // Queue generation jobs
        await queueGenerationJobs(jobId, body, storyId, storyData, url.origin, env);

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
): Promise<{ story: StoryTimeline } | Response> {
    console.log(`[Generate Story] Generating script from prompt: "${body.prompt.substring(0, 50)}..."`);

    const { generateScript } = await import('../services/script-generation');
    const scriptResult = await generateScript(
        {
            prompt: body.prompt,
            duration: body.duration,
            language: body.language || body.videoConfig?.language || 'en',
            model: body.model || body.videoConfig?.model || 'gpt-5.2',
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
    return { story: scriptResult.story };
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
        await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'failed',
            progress: 0,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: error instanceof Error ? error.message : 'Failed to create story',
            teamId: body.teamId,
        }, env);
        return jsonResponse(
            {
                error: 'Failed to create story',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            500
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
        }),
    }));
    console.log(`[Generate Story] Durable Object initialized for story ${storyId}`);
}

/**
 * Queues visual and audio generation jobs for all scenes
 */
async function queueGenerationJobs(
    jobId: string,
    body: GenerateStoryRequest,
    storyId: string,
    storyData: StoryTimeline,
    baseUrl: string,
    env: Env
): Promise<void> {
    const mediaType = body.videoConfig?.mediaType === 'video' ? 'video' : 'image';

    // Queue visual generation jobs
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
        };
        return env.STORY_QUEUE.send(message);
    });
    await Promise.all(visualPromises);
    console.log(`[Generate Story] Queued ${storyData.scenes.length} ${mediaType} generation jobs`);

    // Queue audio generation jobs
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
        };
        return env.STORY_QUEUE.send(message);
    });
    await Promise.all(audioPromises);
    console.log(`[Generate Story] Queued ${storyData.scenes.length} audio generation jobs`);
}
