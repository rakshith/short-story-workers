// Create story endpoint handler - Queue jobs for async processing

import { Env } from '../types/env';
import { CreateStoryRequest, StoryTimeline } from '../types';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';
import { parseTier, getPriorityForTier, getConcurrencyForTier, getConcurrencyWindowForTier } from '../config/tier-config';
import { orchestrateStoryCreation } from '../services/story-orchestrator';

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
        const windowMinutes = getConcurrencyWindowForTier(userTier, env);

        // UPFRONT CONCURRENCY CHECK - Prevents retry overhead (within time window)
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        
        const windowCutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
        const { data: activeJobs, error: checkError } = await supabase
            .from('story_jobs')
            .select('job_id')
            .eq('user_id', body.userId)
            .eq('status', 'processing')
            .gte('created_at', windowCutoff);

        if (checkError) {
            console.error('[Create Story] Failed to check concurrency:', checkError);
            // Fail-open: allow if check fails
        } else {
            const activeCount = activeJobs?.length || 0;
            if (activeCount >= maxConcurrency) {
                console.log(`[Create Story] Concurrency limit reached for user ${body.userId} (${activeCount}/${maxConcurrency}) within ${windowMinutes} min window`);
                return jsonResponse({
                    error: 'Concurrency limit reached',
                    message: `You have ${activeCount} active story generations in the last ${windowMinutes} minutes. Your tier (${userTier}) allows maximum ${maxConcurrency} concurrent jobs. Please wait for a job to complete.`,
                    activeJobs: activeCount,
                    maxConcurrency,
                    tier: userTier,
                    windowMinutes,
                }, 429);
            }
        }

        // Generate job ID
        const jobId = generateUUID();
        
        console.log(`[Create Story] Queuing job ${jobId} for user ${body.userId} (Tier: ${userTier}, Priority: ${priority}, Active: ${activeJobs?.length || 0}/${maxConcurrency})`);
        console.log(`[Create Story] Story: ${body.title}, Scenes: ${storyData.scenes.length}`);

        // Initialize job at 0%
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
            env,
        });

        if (!result.success) {
            return jsonResponse(
                { error: result.error || 'Failed to create story' },
                500
            );
        }

        // Return job ID immediately
        return jsonResponse({
            success: true,
            jobId,
            storyId: result.storyId,
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
