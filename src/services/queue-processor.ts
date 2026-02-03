// Queue processor for async story generation

import { Env, QueueMessage } from '../types/env';
import { generateSceneAudio } from './audio-generation';
import { getModelForTier } from '../utils/model-utils';
import { processorLogger } from '../utils/logger';
import { trackAIUsageInternal } from './usage-tracking';

// QueueMessage is now defined in types/env.ts to avoid circular dependencies

export interface JobStatus {
  jobId: string;
  userId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalScenes: number;
  imagesGenerated: number;
  audioGenerated: number;
  error?: string;
  storyId?: string;
  teamId?: string | null;
}

/**
 * Process a single scene image generation
 */
export async function processSceneImage(
  message: QueueMessage,
  env: Env
): Promise<{ sceneIndex: number; imageUrl: string | null; success: boolean; error?: string }> {
  const { storyData, videoConfig, userId, seriesId, storyId, sceneIndex } = message;
  const scene = storyData.scenes[sceneIndex];

  if (!scene) {
    return { sceneIndex, imageUrl: null, success: false, error: 'Scene not found' };
  }

  try {
    // const modelToUse = scene.model || videoConfig.model;
    // const selectedModel = getModelForTier(modelToUse);

    processorLogger.debug(`Image generation starting`, {
      sceneIndex,
      model: videoConfig.model,
      userId,
    });

    const { getModelImageConfig } = await import('../utils/replicate-model-config');
    const modelConfig = getModelImageConfig(videoConfig.model);

    const parts = videoConfig.aspectRatio.split(':').map(Number);
    const widthRatio = parts[0] || 16;
    const heightRatio = parts[1] || 9;
    const baseSize = 1024;

    let width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
    let height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

    // Check minimum width requirement (skip if model ignores width/height)
    if (!modelConfig.ignoreWidthHeight && modelConfig.minWidth && width < modelConfig.minWidth) {
      const scaleFactor = modelConfig.minWidth / width;
      width = Math.round(width * scaleFactor);
      height = Math.round(height * scaleFactor);
      processorLogger.debug(`Scaled image dimensions to meet minWidth requirement`, {
        minWidth: modelConfig.minWidth,
        newWidth: width,
        newHeight: height
      });
    }

    const prompt = `${scene.imagePrompt}, ${videoConfig.preset.stylePrompt}`;

    // Construct webhook URL with metadata (omit seriesId when not set to avoid "undefined" in path)
    const baseUrl = new URL(message.baseUrl || 'https://create-story-worker.artflicks.workers.dev');
    const webhookUrl = `${baseUrl.origin}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=image&userId=${userId}${(seriesId && seriesId.trim() !== '') ? `&seriesId=${seriesId}` : ''}&jobId=${message.jobId}`;

    processorLogger.debug(`Triggering async Replicate generation`, {
      sceneIndex,
      model: videoConfig.model,
      webhookUrl,
    });

    const { triggerReplicateGeneration } = await import('./image-generation');
    const result = await triggerReplicateGeneration(
      {
        prompt,
        model: videoConfig.model,
        width,
        height,
        num_outputs: 1,
        output_format: videoConfig.outputFormat || 'jpg',
        output_quality: 90,
        aspect_ratio: videoConfig.aspectRatio,
        seed: videoConfig.preset.seed,
        videoConfig: videoConfig,
      },
      {
        userId,
        seriesId: seriesId ?? '',
        storyId,
        sceneIndex,
        replicateApiToken: env.REPLICATE_API_TOKEN,
        webhookUrl,
      }
    );

    processorLogger.info(`Replicate generation triggered`, {
      sceneIndex,
      predictionId: result.predictionId,
    });

    // Track AI Usage for image generation
    await trackAIUsageInternal(env, {
      userId,
      teamId: message.teamId,
      provider: 'replicate',
      model: videoConfig.model,
      feature: 'image-generation',
      type: 'image',
      width,
      height,
      count: 1,
      quality: videoConfig.outputFormat || 'jpg',
      correlationId: storyId,
      source: 'api'
    });

    // We return success: true but imageUrl: null because it hasn't finished yet
    // The webhook will handle the completion.
    return {
      sceneIndex,
      imageUrl: null,
      success: true,
    };
  } catch (error) {
    processorLogger.error(`Error triggering image for scene ${sceneIndex}`, error, {
      sceneIndex,
      userId,
    });
    return {
      sceneIndex,
      imageUrl: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single scene video generation
 */
export async function processSceneVideo(
  message: QueueMessage,
  env: Env
): Promise<{ sceneIndex: number; videoUrl: string | null; success: boolean; error?: string }> {
  const { storyData, videoConfig, userId, seriesId, storyId, sceneIndex } = message;
  const scene = storyData.scenes[sceneIndex];

  if (!scene) {
    return { sceneIndex, videoUrl: null, success: false, error: 'Scene not found' };
  }

  try {
    const modelToUse = scene.model || videoConfig.model;
    const selectedModel = getModelForTier(modelToUse);

    processorLogger.debug(`Video generation starting`, {
      sceneIndex,
      model: selectedModel,
      userId,
    });

    const prompt = scene.imagePrompt;

    // Construct webhook URL with metadata (omit seriesId when not set to avoid "undefined" in path)
    const baseUrl = new URL(message.baseUrl || 'https://create-story-worker.artflicks.workers.dev');
    const webhookUrl = `${baseUrl.origin}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=video&userId=${userId}${(seriesId && seriesId.trim() !== '') ? `&seriesId=${seriesId}` : ''}&jobId=${message.jobId}`;

    processorLogger.debug(`Triggering async video generation`, {
      sceneIndex,
      model: selectedModel,
      webhookUrl,
    });

    // Use dedicated video generation service
    const { triggerVideoGeneration } = await import('./video-generation');
    const result = await triggerVideoGeneration(
      {
        prompt,
        model: selectedModel,
        width: 512,
        height: 512,
        resolution: videoConfig.resolution,
        aspect_ratio: videoConfig.aspectRatio,
        seed: videoConfig.preset.seed,
        videoConfig: videoConfig,
      },
      {
        userId: userId!,
        seriesId: seriesId ?? '',
        storyId: storyId!,
        sceneIndex,
        replicateApiToken: env.REPLICATE_API_TOKEN,
        webhookUrl,
      }
    );

    processorLogger.info(`Video generation triggered`, {
      sceneIndex,
      predictionId: result.predictionId,
    });

    // Track AI Usage for video generation
    await trackAIUsageInternal(env, {
      userId,
      teamId: message.teamId,
      provider: 'replicate',
      model: selectedModel,
      feature: 'video-generation',
      type: 'video',
      durationSeconds: 5,
      resolution: videoConfig.resolution,
      hasAudio: false,
      correlationId: storyId,
      source: 'api'
    });

    return {
      sceneIndex,
      videoUrl: null,
      success: true,
    };
  } catch (error) {
    processorLogger.error(`Error triggering video for scene ${sceneIndex}`, error, {
      sceneIndex,
      userId,
    });
    return {
      sceneIndex,
      videoUrl: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single scene audio generation
 */
export async function processSceneAudio(
  message: QueueMessage,
  env: Env
): Promise<{ sceneIndex: number; audioUrl: string | null; audioDuration: number; captions: any[]; success: boolean; error?: string }> {
  const { storyData, videoConfig, userId, sceneIndex } = message;
  const scene = storyData.scenes[sceneIndex];

  if (!scene) {
    return {
      sceneIndex,
      audioUrl: null,
      audioDuration: 0,
      captions: [],
      success: false,
      error: 'Scene not found',
    };
  }

  // Check if narration exists and is not empty/whitespace
  const narration = scene.narration?.trim();
  if (!narration) {
    processorLogger.warn(`Scene ${sceneIndex} has no narration, skipping audio generation`, {
      sceneIndex,
      sceneNumber: scene.sceneNumber,
    });
    return {
      sceneIndex,
      audioUrl: null,
      audioDuration: 0,
      captions: [],
      success: true, // Mark as success since there's nothing to generate
      error: undefined,
    };
  }

  try {
    const selectedVoice = videoConfig.voice || 'alloy';

    processorLogger.info(`Audio generation starting`, {
      sceneIndex,
      voice: selectedVoice,
      narrationLength: narration.length,
    });

    const startTime = Date.now();
    const result = await processorLogger.logApiCall(
      'generateSceneAudio',
      () => generateSceneAudio(
        narration,
        selectedVoice,
        scene.duration,
        userId,
        scene.sceneNumber,
        1.0,
        env.AUDIO_BUCKET,
        env.ELEVENLABS_API_KEY,
        env.OPENAI_API_KEY,
        env.ELEVENLABS_DEFAULT_VOICE_ID,
        undefined, // narrationStyle - use default
        videoConfig.audioModel
      ),
      { sceneIndex, voice: selectedVoice }
    );
    const latencySeconds = (Date.now() - startTime) / 1000;

    processorLogger.info(`Audio generated successfully`, {
      sceneIndex,
      audioUrl: result.audioUrl,
      captionsCount: result.captions?.length || 0,
      audioDuration: result.audioDuration,
    });

    // Track AI Usage for audio generation
    const provider = env.ELEVENLABS_API_KEY && selectedVoice !== 'alloy' ? 'elevenlabs' : 'openai';
    const audioModel = provider === 'elevenlabs' ? (videoConfig.audioModel || 'eleven_multilingual_v2') : 'tts-1';

    await trackAIUsageInternal(env, {
      userId,
      teamId: message.teamId,
      provider,
      model: audioModel,
      feature: 'audio-generation',
      type: 'audio',
      characterCount: narration.length,
      durationSeconds: latencySeconds,
      correlationId: message.storyId,
      source: 'api'
    });

    return {
      sceneIndex,
      audioUrl: result.audioUrl,
      audioDuration: result.audioDuration,
      captions: result.captions,
      success: true,
    };
  } catch (error) {
    processorLogger.error(`Error generating audio for scene ${sceneIndex}`, error, {
      sceneIndex,
      userId,
    });
    return {
      sceneIndex,
      audioUrl: null,
      audioDuration: 0,
      captions: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


/**
 * Update job status in database
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  env: Env
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase
    .from('story_jobs')
    .upsert({
      job_id: jobId,
      user_id: status.userId || null, // Will be set from message context
      status: status.status,
      progress: status.progress,
      total_scenes: status.totalScenes,
      images_generated: status.imagesGenerated,
      audio_generated: status.audioGenerated,
      error: status.error,
      story_id: status.storyId,
      updated_at: new Date().toISOString(),
      team_id: status.teamId || null,
    }, {
      onConflict: 'job_id',
    });

  if (error) {
    console.error(`[Update Job Status] Failed to update job ${jobId}:`, error);
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  console.log(`[Update Job Status] Successfully updated job ${jobId} with status: ${status.status}`);
}

