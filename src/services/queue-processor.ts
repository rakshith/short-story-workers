// Queue processor for async story generation

import { Env, QueueMessage } from '../types/env';
import { Scene, StoryTimeline } from '../types';
import { generateSceneAudio } from './audio-generation';
import { StoryService } from './supabase';
import { getModelForTier } from '../utils/model-utils';
import { ProjectStatus } from '../types';
import { processorLogger } from '../utils/logger';
import { trackImageGeneration, trackVideoGeneration, trackAudioGeneration, trackStorageWrite } from './usage-tracking';

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
    const modelToUse = scene.model || videoConfig.model;
    const selectedModel = getModelForTier(modelToUse);

    processorLogger.debug(`Image generation starting`, {
      sceneIndex,
      model: selectedModel,
      userId,
    });

    const parts = videoConfig.aspectRatio.split(':').map(Number);
    const widthRatio = parts[0] || 16;
    const heightRatio = parts[1] || 9;
    const baseSize = 1024;

    const width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
    const height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

    const prompt = `${scene.imagePrompt}, ${videoConfig.preset.stylePrompt}`;

    // Construct webhook URL with metadata
    const baseUrl = new URL(message.baseUrl || 'https://create-story-worker.artflicks.workers.dev');
    const webhookUrl = `${baseUrl.origin}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=image&userId=${userId}&seriesId=${seriesId}&jobId=${message.jobId}`;

    processorLogger.debug(`Triggering async Replicate generation`, {
      sceneIndex,
      model: selectedModel,
      webhookUrl,
    });

    const { triggerReplicateGeneration } = await import('./image-generation');
    const result = await triggerReplicateGeneration(
      {
        prompt,
        model: selectedModel,
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
        seriesId,
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

    // Track cost for image generation (cost incurred when API called)
    await trackImageGeneration(
      message.jobId,
      userId,
      storyId,
      sceneIndex,
      selectedModel,
      env
    );

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

    // Construct webhook URL with metadata
    const baseUrl = new URL(message.baseUrl || 'https://create-story-worker.artflicks.workers.dev');
    const webhookUrl = `${baseUrl.origin}/webhooks/replicate?storyId=${storyId}&sceneIndex=${sceneIndex}&type=video&userId=${userId}&seriesId=${seriesId}&jobId=${message.jobId}`;

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
        aspect_ratio: videoConfig.aspectRatio,
        seed: videoConfig.preset.seed,
        videoConfig: videoConfig,
      },
      {
        userId,
        seriesId,
        storyId,
        sceneIndex,
        replicateApiToken: env.REPLICATE_API_TOKEN,
        webhookUrl,
      }
    );

    processorLogger.info(`Video generation triggered`, {
      sceneIndex,
      predictionId: result.predictionId,
    });

    // Track cost for video generation
    await trackVideoGeneration(
      message.jobId,
      userId,
      storyId,
      sceneIndex,
      selectedModel,
      env
    );

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

    processorLogger.info(`Audio generated successfully`, {
      sceneIndex,
      audioUrl: result.audioUrl,
      captionsCount: result.captions?.length || 0,
      audioDuration: result.audioDuration,
    });

    // Track cost for audio generation
    // Determine provider based on voice or configuration
    const provider = env.ELEVENLABS_API_KEY && selectedVoice !== 'alloy' ? 'elevenlabs' : 'openai';
    await trackAudioGeneration(
      message.jobId,
      userId,
      message.storyId,
      sceneIndex,
      provider,
      selectedVoice,
      narration.length,
      env
    );

    // Track storage write for audio file
    await trackStorageWrite(
      message.jobId,
      userId,
      message.storyId,
      sceneIndex,
      'audio',
      env
    );

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

