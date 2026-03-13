// Image Webhook Handler - processes image generation webhooks from Replicate

export interface ImageWebhookMetadata {
  storyId: string;
  sceneIndex: number;
  userId: string;
  seriesId: string;
  jobId: string;
  model: string;
  sceneReviewRequired?: boolean;
}

export async function handleImageWebhook(
  prediction: any,
  metadata: ImageWebhookMetadata,
  env: any,
  origin?: string
): Promise<{ resultUrl: string; status: any }> {
  const { storyId, sceneIndex, userId, seriesId, jobId, model, sceneReviewRequired } = metadata;

  const id = env.STORY_COORDINATOR.idFromName(storyId);
  const coordinator = env.STORY_COORDINATOR.get(id);

  if (prediction.status !== 'succeeded') {
    console.error(`[ImageWebhook] Prediction failed: ${prediction.error}`);
    const body = { sceneIndex, imageError: prediction.error || 'Generation failed' };
    await coordinator.fetch(new Request('http://do/updateImage', { method: 'POST', body: JSON.stringify(body) }));
    throw new Error(`Image generation failed: ${prediction.error}`);
  }

  const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } = await import('../../config/table-config');
  const folderName = SHORT_STORIES_FOLDER_NAMES["FACELess"];
  const pathName = (seriesId && seriesId !== '')
    ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${seriesId}/${storyId}`
    : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${storyId}`;

  const { processFinishedPrediction } = await import('../../services/image-generation');
  const outputFormat = prediction.input?.output_format || 'jpg';
  const storageUrls = await processFinishedPrediction(prediction, {
    userId, seriesId, storyId,
    imagesBucket: env.IMAGES_BUCKET,
    pathName,
    outputFormat,
  });
  const resultUrl = storageUrls[0];

  const predictTime = prediction.metrics?.predict_time || 0;
  const { trackAIUsageInternal } = await import('../../services/usage-tracking');
  await trackAIUsageInternal(env, {
    userId,
    teamId: undefined,
    provider: 'replicate',
    model,
    feature: 'image-generation',
    type: 'image',
    durationSeconds: predictTime,
    correlationId: storyId,
    source: 'webhook',
  });

  const body = { sceneIndex, imageUrl: resultUrl };
  const updateRes = await coordinator.fetch(new Request('http://do/updateImage', { method: 'POST', body: JSON.stringify(body) }));
  const status = await updateRes.json() as any;

  console.log(`[ImageWebhook] Updated in DO, isComplete: ${status.isComplete}, images: ${status.imagesCompleted}/${status.totalScenes}`);

  return { resultUrl, status };
}

export async function processImageWebhook(
  prediction: any,
  metadata: ImageWebhookMetadata,
  env: any,
  origin?: string
): Promise<void> {
  const { storyId, sceneIndex, userId, seriesId, jobId, sceneReviewRequired } = metadata;

  const { resultUrl, status } = await handleImageWebhook(prediction, metadata, env, origin);

  const { createDAGExecutor } = await import('../workflow/dagExecutor');
  const dagExecutor = createDAGExecutor({
    env,
    message: {
      jobId,
      storyId,
      userId,
      templateId: '',
      videoConfig: status.videoConfig || {},
      seriesId,
    },
  });

  if (sceneReviewRequired && status.isImagesCompleteForReview) {
    console.log(`[ImageWebhook] Images complete for review, transitioning to awaiting_review`);

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
  }
}
