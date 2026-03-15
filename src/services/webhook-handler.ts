// Webhook handler service for Replicate
import { Env } from '../types/env';
import { processFinishedPrediction } from './image-generation';
import { templateSkipsImageStep } from '../config/template-video-config';
import { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } from '../config/table-config';
import { apiLogger } from '../utils/logger';
import { trackAIUsageInternal } from './usage-tracking';
import { updateCoordinatorImage, updateCoordinatorVideo, getCoordinatorProgress } from '../utils/coordinator';

/** Metadata extracted from webhook URL, passed to background work */
export interface WebhookMetadata {
    storyId: string;
    sceneIndex: number;
    type: 'image' | 'video';
    userId: string;
    seriesId: string;
    jobId: string;
    model: string;
    sceneReviewRequired?: boolean;
    videoConfig?: any;
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
    const type = (url.searchParams.get('type') || 'image') as 'image' | 'video';
    const userId = url.searchParams.get('userId') || '';
    const rawSeriesId = url.searchParams.get('seriesId') || '';
    const seriesId = (rawSeriesId && rawSeriesId !== 'undefined' && rawSeriesId.trim() !== '') ? rawSeriesId.trim() : '';
    const jobId = url.searchParams.get('jobId') || '';
    const model = url.searchParams.get('model') || (type === 'video' ? 'wan-video/wan-2.5-t2v-fast' : 'black-forest-labs/flux-schnell');
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
            const id = env.STORY_COORDINATOR.idFromName(storyId);
            const coordinator = env.STORY_COORDINATOR.get(id);
            if (type === 'video') {
                await updateCoordinatorVideo(coordinator, { sceneIndex, videoError: prediction.error || 'Generation failed' });
            } else {
                await updateCoordinatorImage(coordinator, { sceneIndex, imageError: prediction.error || 'Generation failed' });
            }
            return;
        }

        const folderName = SHORT_STORIES_FOLDER_NAMES["FACELess"];
        const path_name = (seriesId && seriesId !== '')
            ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${seriesId}/${storyId}`
            : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${storyId}`;

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
            if (mediaType === 'video' && !templateSkipsImageStep(templateId) && storyData?.video_config && jobData?.job_id) {
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
                apiLogger.info(`Auto-generating video for scene ${sceneIndex} using image: ${resultUrl}`, { storyId });
                const videoConfig = storyData.video_config;
                const jobId = jobData.job_id;
                
                // Queue video with generated image URL as reference - use dynamic origin
                const queueMessage = {
                    jobId,
                    userId: jobData.user_id,
                    seriesId: videoConfig.seriesId,
                    storyId,
                    title: storyData.story?.title || '',
                    storyData: storyData.story,
                    videoConfig,
                    sceneIndex,
                    type: 'video' as const,
                    baseUrl: origin || 'https://create-story-worker-staging.matrixrak.workers.dev',
                    teamId: jobData.team_id,
                    userTier: videoConfig.userTier,
                    priority: 3, // Default priority
                    generatedImageUrl: resultUrl, // Use the generated image!
                };
                
                await env.STORY_QUEUE.send(queueMessage);
                apiLogger.info(`Queued video generation for scene ${sceneIndex} with reference image`, { storyId, imageUrl: resultUrl });

                // Incrementally sync image to DB so it's not lost if job fails before videos complete
                const { syncPartialStory } = await import('../queue-consumer');
                await syncPartialStory({ jobId, storyId, userId }, coordinator, env);

                // Return early - don't mark complete yet, let video webhooks handle final completion
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
