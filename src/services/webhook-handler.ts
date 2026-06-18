// Webhook handler service for Replicate
import { Env } from '../types/env';
import { processFinishedPrediction } from './image-generation';
import { templateSkipsImageStep } from '../config/template-video-config';
import { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } from '../config/table-config';
import { apiLogger } from '../utils/logger';
import { trackAIUsageInternal } from './usage-tracking';
import { updateCoordinatorImage, updateCoordinatorVideo, getCoordinatorProgress } from '../utils/coordinator';
import { calcVideoDelaySeconds } from '../utils/queue-batch';
import { getTemplateConfig } from '../config/template-config';
import { isVideoMediaType } from '../utils/media-type';

/** Metadata extracted from webhook URL, passed to background work */
export interface WebhookMetadata {
    storyId: string;
    sceneIndex: number;
    type: 'image' | 'video' | 'avatar';
    userId: string;
    seriesId: string;
    jobId: string;
    model: string;
    sceneReviewRequired?: boolean;
    videoConfig?: any;
    source?: 'replicate' | 'fal';
}

/**
 * Handles incoming Replicate webhook POST requests.
 * When ctx is provided: fire-and-forget—returns 200 immediately, does upload + DO update in background via waitUntil.
 * When ctx is omitted (e.g. recover): runs processing synchronously and returns when done.
 */
export async function handleReplicateWebhook(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const storyId = url.searchParams.get('storyId');
    const sceneIndexStr = url.searchParams.get('sceneIndex');
    const type = (url.searchParams.get('type') || 'image') as 'image' | 'video' | 'avatar';
    const userId = url.searchParams.get('userId') || '';
    const rawSeriesId = url.searchParams.get('seriesId') || '';
    const seriesId = (rawSeriesId && rawSeriesId !== 'undefined' && rawSeriesId.trim() !== '') ? rawSeriesId.trim() : '';
    const jobId = url.searchParams.get('jobId') || '';
    const model = url.searchParams.get('model') || (type === 'video' ? 'bytedance/seedance-1-pro-fast' : 'black-forest-labs/flux-schnell');
    const sceneReviewRequired = url.searchParams.get('sceneReviewRequired') === 'true';

    if (!storyId || !sceneIndexStr) {
        return new Response('Missing metadata', { status: 400 });
    }

    const sceneIndex = parseInt(sceneIndexStr, 10);
    let prediction: any;
    try {
        prediction = await request.json();
    } catch {
        return new Response('Invalid JSON body', { status: 400 });
    }

    apiLogger.info(`Received ${type} completion`, { storyId, sceneIndex, status: prediction.status });

    // Idempotency: claim this prediction before we respond (quick DB insert)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { error: checkError } = await supabase
        .from('webhook_processed')
        .insert({
            prediction_id: prediction.id,
            story_id: storyId,
            scene_index: sceneIndex,
            webhook_type: type,
        });

    if (checkError?.code === '23505') {
        apiLogger.info(`Webhook already processed (idempotency)`, { predictionId: prediction.id, storyId, sceneIndex });
        return new Response('Already processed', { status: 200 });
    }

    const metadata: WebhookMetadata = { storyId, sceneIndex, type, userId, seriesId, jobId, model, sceneReviewRequired };

    // Queue path: durable processing, Replicate always gets 200; no waitUntil eviction
    if (env.WEBHOOK_QUEUE) {
        const origin = new URL(request.url).origin;
        await env.WEBHOOK_QUEUE.send({ prediction, metadata, origin });
        return new Response('OK', { status: 200 });
    }
    // Fallback (e.g. dev without queue): waitUntil or sync
    if (ctx) {
        ctx.waitUntil(processWebhookInBackground(prediction, metadata, env, new URL(request.url).origin));
        return new Response('OK', { status: 200 });
    }
    await processWebhookInBackground(prediction, metadata, env, new URL(request.url).origin);
    return new Response('OK', { status: 200 });
}

/**
 * Runs in background (queue consumer or waitUntil): upload to R2, update DO, sync if complete.
 * Exported for webhook queue consumer.
 */
export async function processWebhookInBackground(prediction: any, metadata: WebhookMetadata, env: Env, origin?: string): Promise<void> {
    const { storyId, sceneIndex, type, userId, seriesId, jobId, model, sceneReviewRequired } = metadata;

    try {
        if (prediction.status !== 'succeeded') {
            console.error(`[WEBHOOK] Prediction failed: ${prediction.error}`);
            
            // Handle avatar failure
            if (type === 'avatar') {
                await handleAvatarWebhookFailure(prediction, metadata, env);
                return;
            }
            
            const id = env.STORY_COORDINATOR.idFromName(storyId);
            const coordinator = env.STORY_COORDINATOR.get(id);
            if (type === 'video') {
                await updateCoordinatorVideo(coordinator, { sceneIndex, videoError: prediction.error || 'Generation failed' });
            } else {
                await updateCoordinatorImage(coordinator, { sceneIndex, imageError: prediction.error || 'Generation failed' });
            }
            
            // Check if all scenes are accounted for (success or failure) - don't block story completion
            const { getCoordinatorProgress } = await import('../utils/coordinator');
            const progressStatus = await getCoordinatorProgress(coordinator);
            
            const allImagesDone = progressStatus.imagesCompleted >= progressStatus.totalScenes;
            const allAudioDone = progressStatus.audioCompleted >= progressStatus.totalScenes;
            const allVideosDone = progressStatus.videosCompleted >= progressStatus.totalScenes;
            const voiceOverEnabled = progressStatus.videoConfig?.enableVoiceOver !== false;
            const audioAllDone = !voiceOverEnabled || allAudioDone;
            
            // For image-only stories: images + audio must be done
            // For video stories: videos + audio must be done
            const isImageOnlyStory = progressStatus.videoConfig?.mediaType !== 'video';
            const allDone = isImageOnlyStory 
                ? (allImagesDone && audioAllDone)
                : (allVideosDone && audioAllDone);
            
            if (allDone) {
                apiLogger.info(`${type} failed but all scenes done, completing story`, { storyId, sceneIndex, error: prediction.error });
                const { syncStoryToSupabase } = await import('../queue-consumer');
                await syncStoryToSupabase({ jobId, storyId, userId }, coordinator, env);
            }
            
            return;
        }

        const folderName = SHORT_STORIES_FOLDER_NAMES["FACELess"];
        const path_name = (seriesId && seriesId !== '')
            ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${seriesId}/${storyId}`
            : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${storyId}`;

        // Handle avatar completion (single scene, no complex scene management)
        if (type === 'avatar') {
            await handleAvatarWebhookSuccess(prediction, metadata, env, origin);
            return;
        }

        let storageUrls: string[];
        if (type === 'video') {
            const { processFinishedVideoPrediction } = await import('./video-generation');
            storageUrls = await processFinishedVideoPrediction(prediction, {
                userId, seriesId, storyId,
                bucket: env.VIDEO_BUCKET,
                pathName: path_name,
            });
        } else {
            const outputFormat = prediction.input?.output_format || 'jpg';
            storageUrls = await processFinishedPrediction(prediction, {
                userId, seriesId, storyId,
                imagesBucket: env.IMAGES_BUCKET,
                pathName: path_name,
                outputFormat,
            });
        }
        const resultUrl = storageUrls[0];

        const predictTime = prediction.metrics?.predict_time || 0;
        await trackAIUsageInternal(env, {
            userId,
            teamId: undefined,
            provider: 'replicate',
            model,
            feature: type === 'video' ? 'video-generation' : 'image-generation',
            type,
            durationSeconds: predictTime,
            correlationId: storyId,
            source: 'webhook',
        });

        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);

        const status = type === 'video'
            ? await updateCoordinatorVideo(coordinator, { sceneIndex, videoUrl: resultUrl })
            : await updateCoordinatorImage(coordinator, { sceneIndex, imageUrl: resultUrl });

        apiLogger.info(`Updated ${type} in DO, isComplete: ${status.isComplete}, videosCompleted: ${status.videosCompleted}/${status.totalScenes}, audioCompleted: ${status.audioCompleted}/${status.totalScenes}`, { storyId, sceneIndex });

        // Handle auto video generation (sceneReviewRequired=false): queue video after each image completes
        // Only trigger when mediaType is 'video' — skip for image-only stories
        if (type === 'image' && !sceneReviewRequired && resultUrl) {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
            
            const { data: storyData } = await supabase
                .from('stories')
                .select('story, video_config, status')
                .eq('id', storyId)
                .single();

            const { data: jobData } = await supabase
                .from('story_jobs')
                .select('job_id, user_id, team_id')
                .eq('story_id', storyId)
                .in('status', ['processing', 'awaiting_review'])
                .single();

            const mediaType = storyData?.video_config?.mediaType;
            const templateId = storyData?.video_config?.templateId;
            const videoType = storyData?.video_config?.videoType;
            if (isVideoMediaType(mediaType) && !templateSkipsImageStep(templateId, videoType) && storyData?.video_config && jobData?.job_id) {
                const existingVideoUrl = storyData.story?.scenes?.[sceneIndex]?.generatedVideoUrl;
                if (existingVideoUrl) {
                    apiLogger.info(`Scene ${sceneIndex} already has generatedVideoUrl (manual from UI), skipping video queue`, { storyId });
                    const updateStatus = await updateCoordinatorVideo(coordinator, { sceneIndex, videoUrl: existingVideoUrl });
                    if (updateStatus.isComplete) {
                        const { syncStoryToSupabase } = await import('../queue-consumer');
                        await syncStoryToSupabase({ jobId: jobData.job_id, storyId, userId }, coordinator, env);
                    } else {
                        const { syncPartialStory } = await import('../queue-consumer');
                        await syncPartialStory({ jobId: jobData.job_id, storyId, userId }, coordinator, env);
                    }
                    return;
                }

                const videoConfig = storyData.video_config;
                const jobId = jobData.job_id;

                if (status.isSceneReadyForVideo) {
                    // Audio already done for this scene — queue video now with real audio duration
                    apiLogger.info(`Scene ${sceneIndex} image+audio both ready, queueing video (audioDuration: ${status.sceneAudioDuration}s)`, { storyId });
                    const queueMessage = {
                        jobId,
                        userId: jobData.user_id,
                        seriesId: videoConfig.seriesId,
                        storyId,
                        title: storyData.story?.title || '',
                        videoConfig,
                        sceneIndex,
                        type: 'video' as const,
                        baseUrl: origin || 'https://create-story-worker-staging.matrixrak.workers.dev',
                        teamId: jobData.team_id,
                        userTier: videoConfig.userTier,
                        priority: 3,
                        generatedImageUrl: resultUrl,
                        templateConfig: getTemplateConfig(templateId),
                        sceneDuration: (status.sceneAudioDuration && status.sceneAudioDuration > 0)
                            ? status.sceneAudioDuration
                            : undefined,
                    };
                    await env.STORY_QUEUE.send(queueMessage, {
                        delaySeconds: calcVideoDelaySeconds(sceneIndex, status.totalScenes ?? 1),
                    });
                    apiLogger.info(`Queued video for scene ${sceneIndex} with reference image and audioDuration=${status.sceneAudioDuration}s`, { storyId, imageUrl: resultUrl });
                } else {
                    // Audio not done yet — video will be queued from the audio completion path
                    apiLogger.info(`Scene ${sceneIndex} image done, audio pending — video queued when audio completes`, { storyId });
                }

                // Incrementally sync image to DB regardless of whether video was queued
                const { syncPartialStory } = await import('../queue-consumer');
                await syncPartialStory({ jobId, storyId, userId }, coordinator, env);

                // Return early — completion handled by the video webhook
                return;
            }
        }

        // Handle two-step video generation: if sceneReviewRequired is true and images + audio complete
        if (type === 'image' && sceneReviewRequired && status.isImagesCompleteForReview) {
            apiLogger.info(`Images complete for review, setting status to awaiting_review`, { storyId });
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

            // Update story to mark scene_review_required and video generation not triggered
            await supabase
                .from('stories')
                .update({ 
                    scene_review_required: true,
                    video_generation_triggered: false,
                    status: 'awaiting_review'
                })
                .eq('id', storyId);

            // Sync story to DB and update job status - syncStoryForReview handles story_jobs update
            await syncStoryForReview({ jobId, storyId, userId }, coordinator, env);
            return;
        }

        if (status.isComplete) {
            apiLogger.info(`Story is complete, triggering final sync`, { storyId });
            const { syncStoryToSupabase } = await import('../queue-consumer');
            await syncStoryToSupabase({ jobId, storyId, userId }, coordinator, env);
        } else if (type === 'video') {
            const { syncPartialStory } = await import('../queue-consumer');
            await syncPartialStory({ jobId, storyId, userId }, coordinator, env);
        } else {
            apiLogger.info(`Story not complete yet, waiting for more generations`, { storyId, videosComplete: status.videosCompleted, audioComplete: status.audioCompleted, total: status.totalScenes });
        }
    } catch (error) {
        console.error(`[WEBHOOK] Background processing error:`, error);
    }
}

/**
 * Syncs story to database when awaiting review - doesn't finalize, just saves current state
 */
export async function syncStoryForReview(
    data: { jobId: string; storyId: string; userId: string },
    coordinator: any,
    env: Env
): Promise<void> {
    apiLogger.info(`Syncing story for review`, { jobId: data.jobId, storyId: data.storyId });

    try {
        const progressData = await getCoordinatorProgress(coordinator);

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // Get current story and merge with scenes from DO
        const { data: currentStory } = await supabase
            .from('stories')
            .select('story')
            .eq('id', data.storyId)
            .single();

        let updatedStory: any = null;

        if (currentStory?.story && progressData.scenes) {
            updatedStory = { ...currentStory.story };
            progressData.scenes.forEach((scene: any, idx: number) => {
                if (updatedStory.scenes[idx]) {
                    updatedStory.scenes[idx] = {
                        ...updatedStory.scenes[idx],
                        ...scene,
                    };
                }
            });

            // Update story with images - status is awaiting_review
            await supabase
                .from('stories')
                .update({
                    story: updatedStory,
                    status: 'awaiting_review',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', data.storyId);
        }

        // Update job progress to 50% (images done, waiting for review)
        await supabase
            .from('story_jobs')
            .update({
                status: 'awaiting_review',
                progress: 50,
                images_generated: progressData.imagesCompleted,
                audio_generated: progressData.audioCompleted,
                updated_at: new Date().toISOString(),
            })
            .eq('job_id', data.jobId);

        apiLogger.info(`Story synced for review (DO state preserved for Step 2)`, { jobId: data.jobId, storyId: data.storyId });
    } catch (error) {
        apiLogger.error('Error syncing story for review', error, { jobId: data.jobId });
        throw error;
    }
}

/**
 * Handle successful avatar video webhook completion
 * Routes through DO path: upload → update DO → finalize → persist compiled timeline
 */
async function handleAvatarWebhookSuccess(
    prediction: any,
    metadata: WebhookMetadata,
    env: Env,
    origin?: string
): Promise<void> {
    const { storyId, userId, jobId } = metadata;
    const sceneIndex = metadata.sceneIndex ?? 0;

    try {
        // 1. Extract video URL from prediction output
        const videoUrls = extractVideoUrls(prediction.output);
        if (videoUrls.length === 0) {
            throw new Error('No video URL in prediction output');
        }
        const videoUrl = videoUrls[0];

        // 2. Download and upload to R2
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.arrayBuffer();
        const key = `talking-avatar/${userId}/${storyId}.mp4`;
        await env.VIDEO_BUCKET.put(key, videoBlob, {
            httpMetadata: { contentType: 'video/mp4' },
        });
        const storageUrl = `https://videos.artflicks.app/${key}`;
        apiLogger.info(`Avatar video uploaded to R2`, { storyId, storageUrl });

        // 3. Track AI usage
        const predictTime = prediction.metrics?.predict_time || 0;
        await trackAIUsageInternal(env, {
            userId,
            provider: metadata.model?.includes('fal') ? 'falai' : 'replicate',
            model: metadata.model,
            feature: 'talking-avatar-generation',
            type: 'video',
            durationSeconds: predictTime,
            correlationId: storyId,
            source: 'webhook',
        });

        // 4. Route through DO (same pattern as faceless video)
        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);
        const status = await updateCoordinatorVideo(coordinator, {
            sceneIndex,
            videoUrl: storageUrl,
        });

        apiLogger.info(`Avatar video updated in DO, isComplete: ${status.isComplete}`, { storyId });

        // 5. If complete, finalize and persist compiled timeline
        if (status.isComplete) {
            const { syncStoryToSupabase } = await import('../queue-consumer');
            await syncStoryToSupabase({ jobId, storyId, userId }, coordinator, env);
        }
    } catch (error) {
        apiLogger.error(`Error processing avatar webhook`, error, { storyId, jobId });
        throw error;
    }
}

/**
 * Handle failed avatar video webhook
 * Routes through DO path: update DO with error → finalize if complete
 */
async function handleAvatarWebhookFailure(
    prediction: any,
    metadata: WebhookMetadata,
    env: Env
): Promise<void> {
    const { storyId, jobId, userId } = metadata;
    const sceneIndex = metadata.sceneIndex ?? 0;

    try {
        // 1. Update DO with error
        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);
        await updateCoordinatorVideo(coordinator, {
            sceneIndex,
            videoError: prediction.error || 'Avatar generation failed',
        });

        // 2. Check if all scenes done (single scene = always done after error)
        const { getCoordinatorProgress } = await import('../utils/coordinator');
        const progress = await getCoordinatorProgress(coordinator);
        const allDone = progress.videosCompleted >= progress.totalScenes;

        if (allDone) {
            const { syncStoryToSupabase } = await import('../queue-consumer');
            await syncStoryToSupabase({ jobId, storyId, userId }, coordinator, env);
        }

        apiLogger.info(`Avatar video generation failed`, { storyId, jobId, error: prediction.error });
    } catch (error) {
        apiLogger.error(`Error handling avatar webhook failure`, error, { storyId, jobId });
    }
}

/**
 * Extract video URLs from Replicate/FAL output
 */
function extractVideoUrls(output: any): string[] {
    if (!output) return [];
    if (Array.isArray(output)) {
        return output.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item?.url) return item.url;
            if (item?.href) return item.href;
            return String(item);
        });
    }
    if (typeof output === 'string') return [output];
    if (output?.url) return [output.url];
    if (output?.video?.url) return [output.video.url];
    return [];
}

/**
 * Handle incoming FAL.ai webhook POST requests.
 * FAL payloads differ from Replicate: statuses are COMPLETED/OK/completed/success/succeeded,
 * video URL is at result.data.video.url or payload.video.url.
 */
export async function handleFALWebhook(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const storyId = url.searchParams.get('storyId');
    const type = (url.searchParams.get('type') || 'avatar') as 'avatar';
    const userId = url.searchParams.get('userId') || '';
    const jobId = url.searchParams.get('jobId') || '';
    const model = url.searchParams.get('model') || 'fal-ai/kling-video/ai-avatar/v2/standard';

    if (!storyId) {
        return new Response('Missing storyId', { status: 400 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response('Invalid JSON body', { status: 400 });
    }

    apiLogger.info(`Received FAL webhook`, { storyId, type, status: body?.status || body?.state });

    // Determine FAL status
    const status = getFALStatus(body);
    if (status === 'pending' || status === 'in_progress') {
        // Not done yet, skip
        return new Response('OK', { status: 200 });
    }

    // Idempotency: claim this request before we respond
    const requestId = body.request_id || body.requestId || `fal-${storyId}-${jobId}`;
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { error: checkError } = await supabase
        .from('webhook_processed')
        .insert({
            prediction_id: requestId,
            story_id: storyId,
            scene_index: 0,
            webhook_type: type,
        });

    if (checkError?.code === '23505') {
        apiLogger.info(`FAL webhook already processed (idempotency)`, { requestId, storyId });
        return new Response('Already processed', { status: 200 });
    }

    const metadata: WebhookMetadata = {
        storyId,
        sceneIndex: 0,
        type,
        userId,
        seriesId: '',
        jobId,
        model,
        source: 'fal',
    };

    // Queue path for durable processing
    if (env.WEBHOOK_QUEUE) {
        await env.WEBHOOK_QUEUE.send({ prediction: body, metadata, origin: url.origin });
        return new Response('OK', { status: 200 });
    }
    // Fallback
    if (ctx) {
        ctx.waitUntil(processFALWebhookInBackground(body, metadata, env, url.origin));
        return new Response('OK', { status: 200 });
    }
    await processFALWebhookInBackground(body, metadata, env, url.origin);
    return new Response('OK', { status: 200 });
}

/**
 * Determine FAL webhook status from the payload.
 * FAL has multiple status formats across different model types.
 */
function getFALStatus(body: any): 'success' | 'failed' | 'pending' | 'in_progress' {
    if (!body) return 'pending';

    // Check top-level status/state
    const s = (body.status || body.state || '').toString().toLowerCase();
    if (['completed', 'ok', 'success', 'succeeded', 'done'].includes(s)) return 'success';
    if (['failed', 'error', 'cancelled', 'canceled'].includes(s)) return 'failed';
    if (['in_progress', 'in queue', 'processing', 'queued'].includes(s)) return 'in_progress';

    // Check result.status
    const rs = (body.result?.status || body.result?.state || '').toString().toLowerCase();
    if (['completed', 'ok', 'success', 'succeeded'].includes(rs)) return 'success';
    if (['failed', 'error'].includes(rs)) return 'failed';

    // Check payload.status
    const ps = (body.payload?.status || body.payload?.state || '').toString().toLowerCase();
    if (['completed', 'ok', 'success', 'succeeded'].includes(ps)) return 'success';
    if (['failed', 'error'].includes(ps)) return 'failed';

    // If there's a result.data or payload with video URL, treat as success
    if (body.result?.data?.video?.url || body.payload?.video?.url || body.data?.video?.url) {
        return 'success';
    }

    // If there's an error field, it failed
    if (body.error || body.detail) return 'failed';

    return 'pending';
}

/**
 * Extract video URL from FAL payload (4-layer fallback)
 */
function extractFALVideoUrl(body: any): string | null {
    if (!body) return null;

    // Layer 1: Direct on body
    if (body.video?.url) return body.video.url;
    if (body.videos?.[0]?.url) return body.videos[0].url;
    if (body.image?.url) return body.image.url;
    if (body.images?.[0]?.url) return body.images[0].url;

    // Layer 2: Wrapped in result.data
    if (body.result?.data?.video?.url) return body.result.data.video.url;
    if (body.result?.data?.videos?.[0]?.url) return body.result.data.videos[0].url;
    if (body.result?.data?.image?.url) return body.result.data.image.url;

    // Layer 3: Wrapped in data
    if (body.data?.video?.url) return body.data.video.url;
    if (body.data?.videos?.[0]?.url) return body.data.videos[0].url;

    // Layer 4: Wrapped in payload
    if (body.payload?.video?.url) return body.payload.video.url;
    if (body.payload?.videos?.[0]?.url) return body.payload.videos[0].url;

    return null;
}

/**
 * Extract error message from FAL payload
 */
function extractFALError(body: any): string {
    if (body.error) return String(body.error);
    if (body.detail) {
        if (Array.isArray(body.detail) && body.detail.length > 0) {
            return body.detail[0].msg || body.detail[0].message || JSON.stringify(body.detail[0]);
        }
        if (typeof body.detail === 'string') {
            const errorType = body.error_type ? `${body.error_type}: ` : '';
            return `${errorType}${body.detail}`;
        }
    }
    if (body.result?.detail) {
        if (Array.isArray(body.result.detail) && body.result.detail.length > 0) {
            return body.result.detail[0].msg || body.result.detail[0].message || JSON.stringify(body.result.detail[0]);
        }
        if (typeof body.result.detail === 'string') return body.result.detail;
    }
    if (body.payload?.error) return String(body.payload.error);
    return 'Unknown FAL error';
}

/**
 * Process FAL webhook in background (queue consumer or waitUntil)
 * Reuses the existing avatar success/failure handlers for DB updates + SSE
 */
export async function processFALWebhookInBackground(body: any, metadata: WebhookMetadata, env: Env, origin?: string): Promise<void> {
    const { storyId, jobId } = metadata;

    try {
        const status = getFALStatus(body);

        if (status === 'failed') {
            const error = extractFALError(body);
            apiLogger.error(`FAL webhook: generation failed`, { storyId, error });
            await handleAvatarWebhookFailure({ error }, metadata, env);
            return;
        }

        if (status !== 'success') {
            apiLogger.info(`FAL webhook: unhandled status`, { storyId, status });
            return;
        }

        // Extract video URL
        const videoUrl = extractFALVideoUrl(body);
        if (!videoUrl) {
            apiLogger.error(`FAL webhook: no video URL found`, { storyId, bodyKeys: Object.keys(body) });
            await handleAvatarWebhookFailure({ error: 'No video URL in FAL response' }, metadata, env);
            return;
        }

        // Build a prediction-like object for handleAvatarWebhookSuccess
        const prediction = {
            output: videoUrl,
            status: 'succeeded',
            metrics: { predict_time: body.metrics?.inference_time || 0 },
        };

        await handleAvatarWebhookSuccess(prediction, metadata, env, origin);
    } catch (error) {
        console.error(`[FAL WEBHOOK] Background processing error:`, error);
    }
}

/**
 * Recover a missed webhook by prediction ID: fetch from Replicate API and process as if webhook fired.
 * Use when Replicate succeeded but never called the webhook (e.g. network/timeout).
 */
export async function handleReplicateWebhookRecover(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }
    let body: { predictionId?: string };
    try {
        body = await request.json() as { predictionId?: string };
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const predictionId = body.predictionId?.trim();
    if (!predictionId) {
        return new Response(JSON.stringify({ error: 'Missing predictionId in body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const token = env.REPLICATE_API_TOKEN;
    if (!token) {
        return new Response(JSON.stringify({ error: 'REPLICATE_API_TOKEN not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const getUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
    const getRes = await fetch(getUrl, { headers: { Authorization: `Token ${token}` } });
    if (!getRes.ok) {
        const text = await getRes.text();
        return new Response(JSON.stringify({ error: 'Replicate API error', status: getRes.status, details: text }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
    const prediction = await getRes.json() as any;

    if (prediction.status !== 'succeeded') {
        return new Response(JSON.stringify({ error: 'Prediction not succeeded', status: prediction.status, predictionId }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const webhookUrl = prediction.webhook;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
        return new Response(JSON.stringify({ error: 'Prediction has no webhook URL' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Replay as if Replicate called the webhook (same URL + body)
    const fakeRequest = new Request(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(prediction),
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await handleReplicateWebhook(fakeRequest, env);
    const status = result.status;
    const resultText = await result.text();
    return new Response(JSON.stringify({ ok: status === 200, status, message: resultText }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
