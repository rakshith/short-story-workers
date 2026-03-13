// Video Webhook Handler - processes video generation webhooks from Replicate

export interface VideoWebhookMetadata {
  storyId: string;
  sceneIndex: number;
  userId: string;
  seriesId: string;
  jobId: string;
  model: string;
}

export async function handleVideoWebhook(
  prediction: any,
  metadata: VideoWebhookMetadata,
  env: any,
  origin?: string
): Promise<{ resultUrl: string; status: any }> {
  const { storyId, sceneIndex, userId, seriesId, jobId, model } = metadata;

  const id = env.STORY_COORDINATOR.idFromName(storyId);
  const coordinator = env.STORY_COORDINATOR.get(id);

  if (prediction.status !== 'succeeded') {
    console.error(`[VideoWebhook] Prediction failed: ${prediction.error}`);
    const body = { sceneIndex, videoError: prediction.error || 'Generation failed' };
    await coordinator.fetch(new Request('http://do/updateVideo', { method: 'POST', body: JSON.stringify(body) }));
    throw new Error(`Video generation failed: ${prediction.error}`);
  }

  const { FOLDER_NAMES, SHORT_STORIES_FOLDER_NAMES } = await import('../../config/table-config');
  const folderName = SHORT_STORIES_FOLDER_NAMES["FACELess"];
  const pathName = (seriesId && seriesId !== '')
    ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${seriesId}/${storyId}`
    : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/${userId}/${storyId}`;

  const { processFinishedVideoPrediction } = await import('../../services/video-generation');
  const storageUrls = await processFinishedVideoPrediction(prediction, {
    userId, seriesId, storyId,
    bucket: env.VIDEO_BUCKET,
    pathName,
  });
  const resultUrl = storageUrls[0];

  const predictTime = prediction.metrics?.predict_time || 0;
  const { trackAIUsageInternal } = await import('../../services/usage-tracking');
  await trackAIUsageInternal(env, {
    userId,
    teamId: undefined,
    provider: 'replicate',
    model,
    feature: 'video-generation',
    type: 'video',
    durationSeconds: predictTime,
    correlationId: storyId,
    source: 'webhook',
  });

  const body = { sceneIndex, videoUrl: resultUrl };
  const updateRes = await coordinator.fetch(new Request('http://do/updateVideo', { method: 'POST', body: JSON.stringify(body) }));
  const status = await updateRes.json() as any;

  console.log(`[VideoWebhook] Updated in DO, isComplete: ${status.isComplete}, videos: ${status.videosCompleted}/${status.totalScenes}`);

  return { resultUrl, status };
}

export async function processVideoWebhook(
  prediction: any,
  metadata: VideoWebhookMetadata,
  env: any,
  origin?: string
): Promise<void> {
  const { storyId, sceneIndex, userId, seriesId, jobId } = metadata;

  const { resultUrl, status } = await handleVideoWebhook(prediction, metadata, env, origin);

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

  await dagExecutor.onNodeComplete(status.scenes, {
    imagesCompleted: status.imagesCompleted,
    audioCompleted: status.audioCompleted,
    videosCompleted: status.videosCompleted,
    totalScenes: status.totalScenes,
  });
}
