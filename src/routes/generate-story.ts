// Generate and create story endpoint handler - AI script generation + story creation

import { Env, QueueMessage } from '../types/env';
import { StoryTimeline, VideoConfig } from '../types';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';
import { parseTier, getPriorityForTier, getConcurrencyForTier } from '../config/tier-config';
import { sendQueueBatch } from '../utils/queue-batch';
import { trackAIUsageInternal, trackAndDeductCredits } from '../services/usage-tracking';
import { templateSkipsImageStep } from '../config/template-video-config';
import { initCoordinator } from '../utils/coordinator';
import { DEFAULT_SKELETON_REFERENCES } from '../../lib/@artflicks/video-compiler/src/script-generator/templates/skeleton-3d-shorts-defaults';
import { estimateVideoGeneration } from '@artflicks/credit-tracker';
import type { CostResponse } from '@artflicks/credit-tracker';
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
            const baseUrl = new URL(request.url).origin;
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

        const estimatedDurationSeconds = estimateGenerationSeconds(
            storyData.scenes,
            body.videoConfig?.model || 'default'
        );

        // Create initial story in database
        const createResult = await createStoryRecord(jobId, body, storyData, estimatedDurationSeconds, env);

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
            estimated_duration_seconds: estimatedDurationSeconds,
            cost: createResult.cost,
            creditsDeducted: createResult.creditsDeducted,
            creditError: createResult.creditError,
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
 * Creates the story record in the database
 */
async function createStoryRecord(
    jobId: string,
    body: GenerateStoryRequest,
    storyData: StoryTimeline,
    estimatedDurationSeconds: number,
    env: Env
): Promise<{ id: string; cost: any; creditsDeducted: boolean; creditError?: string } | Response> {
    try {
        const { StoryService } = await import('../services/supabase');
        const { ProjectStatus } = await import('../types');
        const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // Persist video_config with user's raw prompt only — never the LLM-generated script.
        // Override both prompt and script so client-supplied videoConfig.script (often the generated
        // story) cannot overwrite the user's original prompt in later reads or merges.
        const videoConfigToPersist = {
            ...body.videoConfig,
            mediaType: body.videoConfig?.mediaType ?? 'image',
            prompt: body.prompt,
            script: body.prompt,
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
            estimatedDurationSeconds,
        }, env);
        console.log(`[Generate Story] Progress updated to 25% - Script & story created`);

        // Calculate actual cost using centralized pricing
        const costResponse = calculateGenerationCost(body, storyData);
        console.log(`[Generate Story] Calculated cost:`, costResponse);

        // Track and deduct credits in Cloudflare (for future autopilot support)
        let creditsDeducted = false;
        let creditError: string | undefined;
        
        if (costResponse.valid && costResponse.credits > 0) {
            const deductResult = await trackAndDeductCredits(jobId, body.userId, createdStory.id, costResponse, env);
            creditsDeducted = deductResult.deducted;
            creditError = deductResult.error;
            
            if (!deductResult.deducted) {
                console.warn(`[Generate Story] Credit deduction failed: ${deductResult.error}`);
                // Continue with generation but flag the error
            }
        }

        // Return response with cost - cast to include jobId and cost
        return {
            ...createdStory,
            jobId,
            cost: costResponse,
            creditsDeducted,
            creditError,
        } as typeof createdStory & { jobId: string; cost: typeof costResponse; creditsDeducted: boolean; creditError?: string };
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
                ? `A story with the title "${storyData?.title || 'Unknown'}" already exists`
                : errorMessage || 'Failed to create story',
            teamId: body.teamId,
        }, env);

        return jsonResponse(
            {
                error: isDuplicateTitle ? 'Duplicate story title' : 'Failed to create story',
                message: isDuplicateTitle
                    ? `A story with the title "${storyData?.title || 'Unknown'}" already exists. Please use a different prompt or modify your request.`
                    : errorMessage || 'Unknown error'
            },
            isDuplicateTitle ? 409 : 500
        );
    }
}

/**
 * Calculate generation cost using centralized pricing
 * Uses @artflicks/credit-tracker for consistent calculation across UI and Cloudflare
 */
function calculateGenerationCost(body: GenerateStoryRequest, storyData: StoryTimeline): CostResponse {
    try {
        const mediaType = body.videoConfig?.mediaType; // 'image' or 'video' (UI format)
        
        // Use mediaTier from videoConfig for cost calculation
        // This is set from selectedTier in UI
        let modelTier = body.videoConfig?.mediaTier || 'basic';
        
        // Use duration from body or default to 15
        const duration = body.duration || 15;
        
        // Determine media type for estimation
        // UI sends: 'image' or 'video' (not 'ai-images' or 'ai-videos')
        const mediaTypeStr = String(mediaType || 'video');
        const isImage = (mediaTypeStr === 'ai-images' || mediaTypeStr === 'image');
        const mediaTypeForCalc: 'ai-images' | 'ai-videos' = isImage ? 'ai-images' : 'ai-videos';
        
        console.log('[Calculate Cost] Request:', { mediaType, mediaTypeStr, isImage, modelTier, duration });
        
        const result = estimateVideoGeneration({
            duration,
            modelTier,
            mediaType: mediaTypeForCalc,
            enableImmersiveAudio: body.videoConfig?.enableImmersiveAudio,
        });
        
        console.log('[Calculate Cost] Result:', result);
        
        return {
            credits: result.totalCredits,
            breakdown: result.breakdown,
            currency: 'credits',
            valid: true,
        };
    } catch (error) {
        console.error('[Generate Story] Error calculating cost:', error);
        return {
            credits: 0,
            breakdown: {},
            currency: 'credits',
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error calculating cost',
        };
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
    await initCoordinator(coordinator, {
        storyId,
        userId,
        scenes: storyData.scenes,
        totalScenes: storyData.scenes.length,
        videoConfig,
        sceneReviewRequired: videoConfig?.sceneReviewRequired || false,
    });
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
    const sceneReviewRequired = body.videoConfig?.sceneReviewRequired === true;
    const templateId = body.videoConfig?.templateId;
    const skipsImageStep = templateSkipsImageStep(templateId);
    const shouldQueueVideos = mediaType === 'image' || (mediaType === 'video' && skipsImageStep);

    // Queue visual generation jobs (images or videos based on shouldQueueVideos)
    const visualMessages: QueueMessage[] = storyData.scenes.map((scene, index) => ({
        jobId,
        userId: body.userId,
        seriesId: body.seriesId,
        storyId,
        title: storyData.title || body.title || '',
        storyData,
        videoConfig: body.videoConfig,
        sceneIndex: index,
        type: shouldQueueVideos ? mediaType : 'image' as const,
        baseUrl,
        teamId: body.teamId,
        userTier,
        priority,
    }));
    await sendQueueBatch(env.STORY_QUEUE, visualMessages);
    console.log(`[Generate Story] Queued ${storyData.scenes.length} ${shouldQueueVideos ? mediaType : 'image'} generation jobs via sendBatch (Priority: ${priority})`);

    if (mediaType === 'video' && !shouldQueueVideos) {
        if (!sceneReviewRequired) {
            console.log(`[Generate Story] Videos will be queued after image completion (sceneReviewRequired=false)`);
        } else {
            console.log(`[Generate Story] Videos will be queued after user triggers with storyId (sceneReviewRequired=true)`);
        }
    } else if (mediaType === 'video' && skipsImageStep) {
        console.log(`[Generate Story] Template uses direct text-to-video (no image step)`);
    }

    // Queue audio generation jobs with tier and priority (only if enableVoiceOver is not false)
    const enableVoiceOver = body.videoConfig?.enableVoiceOver !== false;
    
    if (enableVoiceOver) {
        const audioMessages: QueueMessage[] = storyData.scenes.map((scene, index) => ({
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: storyData.title || body.title || '',
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: index,
            type: 'audio' as const,
            baseUrl,
            teamId: body.teamId,
            userTier,
            priority,
        }));
        await sendQueueBatch(env.STORY_QUEUE, audioMessages);
        console.log(`[Generate Story] Queued ${storyData.scenes.length} audio generation jobs via sendBatch (Priority: ${priority})`);
    } else {
        console.log(`[Generate Story] Audio generation skipped (enableVoiceOver=false)`);
    }

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

    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // Fetch existing story
        const { data: story, error: storyError } = await supabase
            .from('stories')
            .select('id, story, video_config, status, video_generation_triggered')
            .eq('id', storyId)
            .single();

        if (storyError || !story) {
            return jsonResponse({ error: 'Story not found' }, 404);
        }

        // Check if video generation already triggered
        if (story.video_generation_triggered) {
            return jsonResponse(
                { error: 'Video generation has already been triggered for this story' },
                400
            );
        }

        // Check if story has scenes
        const storyData = story.story as StoryTimeline;
        if (!storyData?.scenes) {
            return jsonResponse(
                { error: 'Story has no scenes' },
                400
            );
        }

        const scenesWithImages = storyData.scenes
            .map((scene: any, index: number) => ({ scene, index }))
            .filter(({ scene }: { scene: any; index: number }) => scene.generatedImageUrl);

        const scenesNeedingVideo = scenesWithImages.filter(({ scene }: { scene: any }) => !scene.generatedVideoUrl);

        if (scenesWithImages.length === 0) {
            return jsonResponse(
                { 
                    error: 'No scenes have generated images yet. Cannot trigger video generation.',
                    totalScenes: storyData.scenes.length
                },
                400
            );
        }

        if (scenesNeedingVideo.length === 0) {
            return jsonResponse({
                success: true,
                storyId,
                message: 'All scenes already have video (including manually generated). Nothing to generate.',
                stats: { totalScenes: storyData.scenes.length, videosQueued: 0 },
            });
        }

        console.log(`[Generate Story] Found ${scenesNeedingVideo.length} scenes needing video (${scenesWithImages.length - scenesNeedingVideo.length} already have video) out of ${storyData.scenes.length}`);

        // Check if story is in a valid status (processing, completed, or awaiting_review)
        const validStatuses = ['processing', 'completed', 'awaiting_review', 'draft'];
        if (!validStatuses.includes(story.status)) {
            return jsonResponse(
                { error: `Story is in invalid status: ${story.status}. Cannot trigger video generation.` },
                400
            );
        }

        // Update story to mark video generation as triggered
        await supabase
            .from('stories')
            .update({ 
                video_generation_triggered: true,
                status: 'processing'
            })
            .eq('id', storyId);

        // Get or create job for this story
        const { data: existingJob } = await supabase
            .from('story_jobs')
            .select('job_id')
            .eq('story_id', storyId)
            .in('status', ['processing', 'awaiting_review'])
            .single();

        const jobId = existingJob?.job_id || generateUUID();

        // Create/update job
        await supabase
            .from('story_jobs')
            .upsert({
                job_id: jobId,
                user_id: userId,
                story_id: storyId,
                status: 'processing',
                progress: 50,
                total_scenes: storyData.scenes.length,
                images_generated: storyData.scenes.length,
                audio_generated: 0,
                updated_at: new Date().toISOString(),
                teamId: body.teamId,
            }, { onConflict: 'job_id' });

        // Get videoConfig
        const videoConfig = story.video_config as VideoConfig;
        
        // Initialize DO with story data - skip audio check for Step 2 (only videos needed)
        const coordinatorId = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(coordinatorId);
        
        await initCoordinator(coordinator, {
            storyId,
            userId,
            scenes: storyData.scenes,
            totalScenes: storyData.scenes.length,
            videoConfig,
            skipAudioCheck: true,
            sceneReviewRequired: false,
        });

        // The storyData.scenes already has audioUrl from Step 1
        // So we need to mark audio as completed without calling updateAudio
        // We'll use a special approach - call updateAudio with existing audio data

        // Queue video generation jobs only for scenes with generated images

        // Queue video generation jobs only for scenes with generated images
        const userTier = parseTier(body.userTier || videoConfig?.userTier);
        const priority = getPriorityForTier(userTier, env);
        
        // Use baseUrl from request or fallback to default
        const webhookBaseUrl = requestBaseUrl || body.baseUrl || 'https://create-story-worker.artflicks.workers.dev';

        const videoMessages: QueueMessage[] = scenesNeedingVideo.map(({ index, scene }) => ({
            jobId,
            userId,
            seriesId: videoConfig?.seriesId,
            storyId,
            title: storyData.title || '',
            storyData,
            videoConfig,
            sceneIndex: index,
            type: 'video' as const,
            baseUrl: webhookBaseUrl,
            teamId: body.teamId,
            userTier,
            priority,
            generatedImageUrl: scene.generatedImageUrl,
        }));
        await sendQueueBatch(env.STORY_QUEUE, videoMessages);
        
        console.log(`[Generate Story] Queued ${scenesNeedingVideo.length} video generation jobs for story ${storyId} (${scenesWithImages.length - scenesNeedingVideo.length} scenes already had video)`);

        return jsonResponse({
            success: true,
            jobId,
            storyId,
            message: 'Video generation started',
            stats: {
                totalScenes: storyData.scenes.length,
                videosQueued: scenesNeedingVideo.length,
            },
        });
    } catch (error) {
        console.error('[Generate Story] Resume error:', error);
        return jsonResponse(
            { error: 'Failed to resume video generation', details: error instanceof Error ? error.message : 'Unknown error' },
            500
        );
    }
}
