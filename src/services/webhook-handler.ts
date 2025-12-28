// Webhook handler service for Replicate
import { Env } from '../types/env';
import { processFinishedPrediction } from './image-generation';

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

    console.log(`[WEBHOOK] Received ${type} completion for Story: ${storyId}, Scene: ${sceneIndex}, Status: ${prediction.status}`);

    if (prediction.status !== 'succeeded') {
        console.error(`[WEBHOOK] Prediction failed: ${prediction.error}`);
        // Update Durable Object with error
        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);

        await coordinator.fetch(new Request('http://do/updateImage', {
            method: 'POST',
            body: JSON.stringify({
                sceneIndex,
                imageError: prediction.error || 'Generation failed',
            }),
        }));

        return new Response('Error handled', { status: 200 });
    }

    try {
        // 1. Process and upload to R2
        // For webhooks, we use the output format from the prediction settings if possible
        const outputFormat = prediction.input?.output_format || 'jpg';

        const storageUrls = await processFinishedPrediction(prediction, {
            userId,
            seriesId,
            storyId,
            imagesBucket: env.IMAGES_BUCKET,
            pathName: `stories/${userId}/${seriesId}/${storyId}`, // simplified path for now
            outputFormat
        });

        const resultUrl = storageUrls[0];

        // 2. Update Durable Object (Race-condition free)
        const id = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(id);

        const updateRes = await coordinator.fetch(new Request('http://do/updateImage', {
            method: 'POST',
            body: JSON.stringify({
                sceneIndex,
                imageUrl: resultUrl,
            }),
        }));

        // 3. Trigger finalization if needed
        const status = await updateRes.json() as any;
        if (status.isComplete) {
            console.log(`[WEBHOOK] Story ${storyId} is complete, triggering final sync...`);
            const { syncStoryToSupabase } = await import('../index');

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
