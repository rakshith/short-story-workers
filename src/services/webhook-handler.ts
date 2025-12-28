// Webhook handler service for Replicate
import { Env } from '../types/env';
import { processFinishedPrediction } from './image-generation';
import { FOLDER_NAMES } from '../config/table-config';
import { apiLogger } from '../utils/logger';

/**
 * Handles incoming Replicate webhook POST requests
 */
export async function handleReplicateWebhook(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Extract custom metadata from query params (we'll pass these in the webhook URL)
    const storyId = url.searchParams.get('storyId');
    const sceneIndexStr = url.searchParams.get('sceneIndex');
    const type = url.searchParams.get('type') || 'image';
    const userId = url.searchParams.get('userId') || '';
    const seriesId = url.searchParams.get('seriesId') || '';

    if (!storyId || !sceneIndexStr) {
        return new Response('Missing metadata', { status: 400 });
    }

    const sceneIndex = parseInt(sceneIndexStr, 10);
    const prediction = await request.json() as any;

    apiLogger.info(`Received ${type} completion`, { storyId, sceneIndex, status: prediction.status });

    if (prediction.status !== 'succeeded') {
        console.error(`[WEBHOOK] Prediction failed: ${prediction.error}`);
        // Update Durable Object with error
        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);

        const body: any = { sceneIndex };
        if (type === 'video') {
            body.videoError = prediction.error || 'Generation failed';
        } else {
            body.imageError = prediction.error || 'Generation failed';
        }

        const errorEndpoint = type === 'video' ? 'http://do/updateVideo' : 'http://do/updateImage';
        await coordinator.fetch(new Request(errorEndpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        }));

        return new Response('Error handled', { status: 200 });
    }

    try {
        // 1. Process and upload to R2 - use dedicated service based on type
        let storageUrls: string[];

        if (type === 'video') {
            const { processFinishedVideoPrediction } = await import('./video-generation');
            storageUrls = await processFinishedVideoPrediction(prediction, {
                userId,
                seriesId,
                storyId,
                bucket: env.VIDEO_BUCKET,
                pathName: `${FOLDER_NAMES.SHORT_STORIES}/${userId}/${seriesId}/${storyId}`,
            });
        } else {
            const outputFormat = prediction.input?.output_format || 'jpg';
            storageUrls = await processFinishedPrediction(prediction, {
                userId,
                seriesId,
                storyId,
                imagesBucket: env.IMAGES_BUCKET,
                pathName: `${FOLDER_NAMES.SHORT_STORIES}/${userId}/${seriesId}/${storyId}`,
                outputFormat
            });
        }

        const resultUrl = storageUrls[0];

        // 2. Update Durable Object (Race-condition free) - use separate endpoints
        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);

        const endpoint = type === 'video' ? 'http://do/updateVideo' : 'http://do/updateImage';
        const body: any = { sceneIndex };
        if (type === 'video') {
            body.videoUrl = resultUrl;
        } else {
            body.imageUrl = resultUrl;
        }

        const updateRes = await coordinator.fetch(new Request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        }));

        // 3. Trigger finalization if needed
        const status = await updateRes.json() as any;
        if (status.isComplete) {
            apiLogger.info(`Story is complete, triggering final sync`, { storyId });
            const { syncStoryToSupabase } = await import('../queue-consumer');

            // We need jobId for the final sync. Let's ensure it's in the query params.
            const jobId = url.searchParams.get('jobId') || '';

            await syncStoryToSupabase({
                jobId,
                storyId,
                userId
            }, coordinator, env);
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error(`[WEBHOOK] Processing error:`, error);
        return new Response('Processing failed', { status: 500 });
    }
}
