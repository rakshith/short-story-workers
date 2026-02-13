// Create story endpoint handler - Queue jobs for async processing

import { Env, QueueMessage } from '../types/env';
import { CreateStoryRequest, StoryTimeline, VideoConfig } from '../types';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';
import { parseTier, getPriorityForTier, getConcurrencyForTier } from '../config/tier-config';

/**
 * POST /create-story
 * Creates a story from an existing script and queues generation jobs
 */
export async function handleCreateStory(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
        const body: CreateStoryRequest = await request.json();

        // Validate required fields (seriesId is optional)
        if (!body.script || !body.videoConfig || !body.userId) {
            return jsonResponse(
                { error: 'Missing required fields: script, videoConfig, userId' },
                400
            );
        }

        // Parse script JSON
        let storyData: StoryTimeline;
        try {
            storyData = typeof body.script === 'string' ? JSON.parse(body.script) : body.script;
        } catch (error) {
            return jsonResponse({ error: 'Invalid script JSON format' }, 400);
        }

        if (!storyData.scenes || !Array.isArray(storyData.scenes) || storyData.scenes.length === 0) {
            return jsonResponse({ error: 'Script must contain at least one scene' }, 400);
        }

        // Parse user tier and get priority
        const userTier = parseTier(body.userTier || body.videoConfig?.userTier);
        const priority = getPriorityForTier(userTier, env);
        const maxConcurrency = getConcurrencyForTier(userTier, env);

        // UPFRONT CONCURRENCY CHECK - Prevents retry overhead
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        
        const { data: activeJobs, error: checkError } = await supabase
            .from('story_jobs')
            .select('job_id')
            .eq('user_id', body.userId)
            .eq('status', 'processing');

        if (checkError) {
            console.error('[Create Story] Failed to check concurrency:', checkError);
            // Fail-open: allow if check fails
        } else {
            const activeCount = activeJobs?.length || 0;
            if (activeCount >= maxConcurrency) {
                console.log(`[Create Story] Concurrency limit reached for user ${body.userId} (${activeCount}/${maxConcurrency})`);
                return jsonResponse({
                    error: 'Concurrency limit reached',
                    message: `You have ${activeCount} active story generations. Your tier (${userTier}) allows maximum ${maxConcurrency} concurrent jobs. Please wait for a job to complete.`,
                    activeJobs: activeCount,
                    maxConcurrency,
                    tier: userTier,
                }, 429);
            }
        }

        // Generate job ID
        const jobId = generateUUID();
        
        console.log(`[Create Story] Queuing job ${jobId} for user ${body.userId} (Tier: ${userTier}, Priority: ${priority}, Active: ${activeJobs?.length || 0}/${maxConcurrency})`);
        console.log(`[Create Story] Story: ${body.title}, Scenes: ${storyData.scenes.length}`);

        // Create initial story in database
        const createResult = await createInitialStory(body, storyData, jobId, env);
        if (createResult instanceof Response) {
            return createResult;
        }

        const storyId = createResult.id;

        // Initialize Durable Object for this story
        await initializeCoordinator(storyId, body.userId, storyData, body.videoConfig, env);

        // Queue generation jobs with tier-based priority
        await queueGenerationJobs(jobId, body, storyId, storyData, url.origin, userTier, priority, env);

        // Return job ID immediately
        return jsonResponse({
            success: true,
            jobId,
            status: 'pending',
            message: 'Story generation queued successfully. Use /status?jobId=' + jobId + ' to check progress.',
            stats: {
                totalScenes: storyData.scenes.length,
            },
        });
    } catch (error) {
        console.error('[Create Story] Error:', error);
        return jsonResponse(
            {
                error: 'Failed to queue story generation',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
}

/**
 * Creates the initial story record in the database
 */
async function createInitialStory(
    body: CreateStoryRequest,
    storyData: StoryTimeline,
    jobId: string,
    env: Env
): Promise<{ id: string } | Response> {
    try {
        const { StoryService } = await import('../services/supabase');
        const { ProjectStatus } = await import('../types');
        const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // Persist videoConfig with mediaType set from request
        const videoConfigToPersist = {
            ...body.videoConfig,
            mediaType: body.videoConfig?.mediaType ?? 'image',
        };
        const createdStory = await storyService.createStory({
            userId: body.userId,
            seriesId: body.seriesId,
            title: storyData.title,
            videoType: body.videoConfig?.videoType || 'faceless-video',
            story: storyData,
            status: ProjectStatus.PROCESSING,
            videoConfig: videoConfigToPersist,
            storyCost: body.videoConfig?.estimatedCredits,
            teamId: body.teamId,
        });
        console.log(`[Create Story] Initial story created in database with ID: ${createdStory.id}`);

        // Progress Update: Story created - 25%
        await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'processing',
            progress: 25,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            storyId: createdStory.id,
            teamId: body.teamId,
        }, env);
        console.log(`[Create Story] Progress updated to 25% - Story created`);

        return createdStory;
    } catch (error) {
        console.error(`[Create Story] Failed to create story:`, error);
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
    console.log(`[Create Story] Durable Object initialized for story ${storyId}`);
}

/**
 * Queues visual and audio generation jobs for all scenes with tier-based priority
 */
async function queueGenerationJobs(
    jobId: string,
    body: CreateStoryRequest,
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
            title: storyData.title,
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
    console.log(`[Create Story] Queued ${storyData.scenes.length} ${mediaType} generation jobs (Priority: ${priority})`);

    // Queue audio generation jobs with tier and priority
    const audioPromises = storyData.scenes.map((scene, index) => {
        const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: storyData.title,
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
    console.log(`[Create Story] Queued ${storyData.scenes.length} audio generation jobs (Priority: ${priority})`);

}
