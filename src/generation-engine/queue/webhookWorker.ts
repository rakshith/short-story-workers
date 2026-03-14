// Webhook Worker - DAG-aware Replicate webhook processing
// Reuses legacy R2 upload + DO update, adds DAG sync (partial + final)

import { createDAGExecutor } from '../workflow/dagExecutor';
import { createStorySyncService } from '../services/storySync';

export interface WebhookMetadata {
  storyId: string;
  sceneIndex: number;
  type: 'image' | 'video';
  userId: string;
  seriesId: string;
  jobId: string;
  model: string;
  sceneReviewRequired?: boolean;
}

export async function handleWebhookDAG(
  request: Request,
  env: any,
  ctx?: ExecutionContext
): Promise<Response> {
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

  console.log(`[WebhookDAG] Received ${type} completion for story ${storyId} scene ${sceneIndex}, status: ${prediction.status}`);

  // Idempotency check
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
    console.log(`[WebhookDAG] Already processed (idempotency)`, prediction.id);
    return new Response('Already processed', { status: 200 });
  }

  const metadata: WebhookMetadata = { storyId, sceneIndex, type, userId, seriesId, jobId, model, sceneReviewRequired };
  const origin = url.origin;

  // Queue path for durable processing
  if (env.WEBHOOK_QUEUE) {
    await env.WEBHOOK_QUEUE.send({ prediction, metadata, origin });
    return new Response('OK', { status: 200 });
  }

  // Fallback: process inline or via waitUntil
  if (ctx) {
    ctx.waitUntil(processWebhookDAG(prediction, metadata, env, origin));
    return new Response('OK', { status: 200 });
  }

  await processWebhookDAG(prediction, metadata, env, origin);
  return new Response('OK', { status: 200 });
}

/**
 * DAG-aware webhook processing:
 * 1. Upload result to R2 (reuses legacy services)
 * 2. Update DO state (same STORY_COORDINATOR)
 * 3. Partial sync via DAGExecutor.onNodeComplete()
 * 4. Final sync via DAGExecutor.onJobComplete() with timeline
 */
async function processWebhookDAG(
  prediction: any,
  metadata: WebhookMetadata,
  env: any,
  origin?: string
): Promise<void> {
  const { storyId, sceneIndex, type, userId, seriesId, jobId, model, sceneReviewRequired } = metadata;

  try {
    const id = env.STORY_COORDINATOR.idFromName(storyId);
    const coordinator = env.STORY_COORDINATOR.get(id);

    // Handle failed predictions
    if (prediction.status !== 'succeeded') {
      console.error(`[WebhookDAG] Prediction failed: ${prediction.error}`);
      const body: any = { sceneIndex };
      if (type === 'video') {
        body.videoError = prediction.error || 'Generation failed';
      } else {
        body.imageError = prediction.error || 'Generation failed';
      }
      const endpoint = type === 'video' ? 'http://do/updateVideo' : 'http://do/updateImage';
      await coordinator.fetch(new Request(endpoint, { method: 'POST', body: JSON.stringify(body) }));
      return;
    }

    // 1. Upload to R2 (reuse legacy upload services)
    const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } = await import('../../config/table-config');
    const folderName = SHORT_STORIES_FOLDER_NAMES["FACELess"];
    const pathName = (seriesId && seriesId !== '')
      ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${seriesId}/${storyId}`
      : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${storyId}`;

    let resultUrl: string;
    if (type === 'video') {
      const { processFinishedVideoPrediction } = await import('../../services/video-generation');
      const storageUrls = await processFinishedVideoPrediction(prediction, {
        userId, seriesId, storyId,
        bucket: env.VIDEO_BUCKET,
        pathName,
      });
      resultUrl = storageUrls[0];
    } else {
      const { processFinishedPrediction } = await import('../../services/image-generation');
      const outputFormat = prediction.input?.output_format || 'jpg';
      const storageUrls = await processFinishedPrediction(prediction, {
        userId, seriesId, storyId,
        imagesBucket: env.IMAGES_BUCKET,
        pathName,
        outputFormat,
      });
      resultUrl = storageUrls[0];
    }

    // 2. Track AI usage
    const predictTime = prediction.metrics?.predict_time || 0;
    const { trackAIUsageInternal } = await import('../../services/usage-tracking');
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

    // 3. Update DO state
    const endpoint = type === 'video' ? 'http://do/updateVideo' : 'http://do/updateImage';
    const body: any = { sceneIndex };
    if (type === 'video') body.videoUrl = resultUrl;
    else body.imageUrl = resultUrl;

    const updateRes = await coordinator.fetch(new Request(endpoint, { method: 'POST', body: JSON.stringify(body) }));
    const status = await updateRes.json() as any;

    console.log(`[WebhookDAG] Updated ${type} in DO, isComplete: ${status.isComplete}, images: ${status.imagesCompleted}/${status.totalScenes}, videos: ${status.videosCompleted}/${status.totalScenes}, audio: ${status.audioCompleted}/${status.totalScenes}`);

    const dagExecutor = createDAGExecutor({
      env,
      message: {
        jobId,
        storyId,
        userId,
        templateId: (status.videoConfig?.templateId as string) || '',
        videoConfig: status.videoConfig || {},
        seriesId,
      },
    });

    // 4. Handle scene review mode (images + audio done → awaiting_review)
    if (type === 'image' && sceneReviewRequired && status.isImagesCompleteForReview) {
      console.log(`[WebhookDAG] Images complete for review, transitioning to awaiting_review`);

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      await supabase
        .from('stories')
        .update({
          scene_review_required: true,
          video_generation_triggered: false,
          status: 'awaiting_review',
        })
        .eq('id', storyId);

      // Sync current state to DB (without finalizing DO)
      const progressRes = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
      const progressData = await progressRes.json() as any;

      if (progressData.scenes) {
        const storySyncService = createStorySyncService(env);
        await storySyncService.syncPartialStory(
          { jobId, storyId, userId },
          progressData.scenes
        );
      }

      await supabase
        .from('story_jobs')
        .update({
          status: 'awaiting_review',
          progress: 50,
          images_generated: status.imagesCompleted,
          audio_generated: status.audioCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId);

      return;
    }

    // 5. Partial sync for image/video completions (non-review mode)
    if ((type === 'image' || type === 'video') && resultUrl) {
      const progressRes = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
      const progressData = await progressRes.json() as any;

      if (progressData.scenes) {
        await dagExecutor.onNodeComplete(progressData.scenes, {
          imagesCompleted: status.imagesCompleted,
          audioCompleted: status.audioCompleted,
          videosCompleted: status.videosCompleted,
          totalScenes: status.totalScenes,
        }, type === 'video' ? 'video-generation' : 'image-generation');
      }
    }

    // 6. Final sync when all generations complete
    if (status.isComplete) {
      console.log(`[WebhookDAG] Story complete, triggering final sync`);

      const finalRes = await coordinator.fetch(new Request('http://do/finalize', { method: 'POST' }));
      const finalData = await finalRes.json() as any;

      if (finalData.isComplete && finalData.scenes) {
        await dagExecutor.onJobComplete(
          { title: finalData.title, scenes: finalData.scenes },
          finalData.timeline
        );
      }
    } else {
      console.log(`[WebhookDAG] Story not complete yet, images: ${status.imagesCompleted}/${status.totalScenes}, videos: ${status.videosCompleted}/${status.totalScenes}`);
    }
  } catch (error) {
    console.error(`[WebhookDAG] Background processing error:`, error);
  }
}

/**
 * DAG-aware webhook queue consumer
 */
export async function handleWebhookQueueDAG(batch: any, env: any): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { prediction, metadata, origin } = message.body;
      console.log(`[WebhookDAG] Processing webhook queue: ${metadata.type} - storyId: ${metadata.storyId}, scene: ${metadata.sceneIndex}`);
      await processWebhookDAG(prediction, metadata, env, origin);
      message.ack();
    } catch (error) {
      console.error('[WebhookDAG] Queue processing error:', error);
      message.retry();
    }
  }
}
