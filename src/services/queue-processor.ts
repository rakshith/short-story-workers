// Queue processor for async story generation

import { Env, QueueMessage } from '../types/env';
import { TemplatePipelineConfig } from '../config/template-config';
import { generateSceneAudio } from './audio-generation';
import { processorLogger } from '../utils/logger';
import { trackAIUsageInternal } from './usage-tracking';
import { getSceneFromCoordinator } from '../utils/coordinator';
import { Scene } from '../types';
import { 
  resolveProvider, 
  buildWebhookUrl, 
  buildWebhookMetadata,
  getInputFieldsForModel,
  shouldIgnoreWidthHeight,
  type ProviderType 
} from '@artflicks/model-provider';

// QueueMessage is now defined in types/env.ts to avoid circular dependencies

/**
 * Build final prompt for image or video generation
 */
function buildFinalPrompt(
  scene: Scene,
  mediaType: 'image' | 'video',
  characterAnchor?: string | null,
  templateConfig?: TemplatePipelineConfig
): string {
  const parts: string[] = [];

  // For video: use videoPrompt directly if available
  if (mediaType === 'video' && scene.videoPrompt) {
    parts.push(scene.videoPrompt);

    if (templateConfig?.includeNarrationInVideoPrompt && scene.narration) {
      parts.push(`Dialogue: ${scene.narration}`);
    }
  } else {
    // For image or video fallback: build from individual components
    if (scene.imagePrompt) {
      parts.push(scene.imagePrompt);
    }
    if (scene.cameraAngle) {
      parts.push(`${scene.cameraAngle} shot`);
    }
  }

  if (characterAnchor) {
    parts.push(characterAnchor);
  }

  return parts.filter(p => p).join(', ');
}

export interface JobStatus {
  jobId: string;
  userId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_review' | 'cancelled';
  progress: number;
  totalScenes: number;
  imagesGenerated: number;
  audioGenerated: number;
  error?: string;
  storyId?: string;
  teamId?: string | null;
  estimatedDurationSeconds?: number;
}

/**
 * Process a single scene image generation
 */
export async function processSceneImage(
  message: QueueMessage,
  env: Env
): Promise<{ sceneIndex: number; imageUrl: string | null; success: boolean; error?: string }> {
  const { storyData, videoConfig, userId, seriesId, storyId, sceneIndex } = message;
  const scene = storyData?.scenes[sceneIndex] ?? await getSceneFromCoordinator(storyId, sceneIndex, env);

  if (!scene) {
    return { sceneIndex, imageUrl: null, success: false, error: 'Scene not found' };
  }

  try {
    const defaultImageModel = 'xai/grok-imagine-image';
    const imageModel = videoConfig.imageModel || defaultImageModel;
    
    const provider: ProviderType = videoConfig.provider || 'falai';

    processorLogger.debug(`Image generation starting`, {
      sceneIndex,
      imageModel,
      provider,
      templateId: videoConfig.templateId,
      userId,
    });

    // Build input context for generation type detection
    const imageInputContext: Record<string, unknown> = {};
    if (videoConfig.characterReferenceImages && videoConfig.characterReferenceImages.length > 0) {
      imageInputContext.reference_images = videoConfig.characterReferenceImages;
    }

    const { actualModelId, providerType } = resolveProvider(
      imageModel,
      'image',
      provider,
      undefined,
      imageInputContext
    );

    const fieldConfig = getInputFieldsForModel(actualModelId, providerType);

    const parts = videoConfig.aspectRatio.split(':').map(Number);
    const widthRatio = parts[0] || 16;
    const heightRatio = parts[1] || 9;
    const baseSize = 1024;

    let width = Math.round((widthRatio / Math.max(widthRatio, heightRatio)) * baseSize);
    let height = Math.round((heightRatio / Math.max(widthRatio, heightRatio)) * baseSize);

    if (!shouldIgnoreWidthHeight(actualModelId, providerType) && fieldConfig.minWidth && width < fieldConfig.minWidth) {
      const scaleFactor = fieldConfig.minWidth / width;
      width = Math.round(width * scaleFactor);
      height = Math.round(height * scaleFactor);
      processorLogger.debug(`Scaled image dimensions to meet minWidth requirement`, {
        minWidth: fieldConfig.minWidth,
        newWidth: width,
        newHeight: height
      });
    }

    const prompt = buildFinalPrompt(scene, 'image', storyData?.characterAnchor);

    const baseUrl = new URL(message.baseUrl || 'https://create-story-worker.artflicks.workers.dev');
    const webhookMetadata = buildWebhookMetadata({
      storyId,
      sceneIndex,
      type: 'image',
      userId,
      jobId: message.jobId,
      model: actualModelId,
      seriesId: seriesId && seriesId.trim() !== '' ? seriesId : undefined,
      sceneReviewRequired: videoConfig.sceneReviewRequired,
    });
    const webhookUrl = buildWebhookUrl(providerType, baseUrl.origin, webhookMetadata);

    processorLogger.debug(`Triggering async generation`, {
      sceneIndex,
      actualModelId,
      providerType,
      webhookUrl,
    });

    const { triggerImageGeneration } = await import('./image-generation');
    const apiKey = providerType === 'falai' ? env.FAL_API_KEY : env.REPLICATE_API_TOKEN;
    const result = await triggerImageGeneration(
      {
        prompt,
        model: actualModelId,
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
        provider: providerType,
        apiKey,
        webhookUrl,
      }
    );

    processorLogger.info(`Generation triggered`, {
      sceneIndex,
      predictionId: result.predictionId,
      provider: providerType,
    });

    await trackAIUsageInternal(env, {
      userId,
      teamId: message.teamId,
      provider: providerType,
      model: actualModelId,
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
  const scene = storyData?.scenes[sceneIndex] ?? await getSceneFromCoordinator(storyId, sceneIndex, env);

  if (!scene) {
    return { sceneIndex, videoUrl: null, success: false, error: 'Scene not found' };
  }

  try {
    const selectedModel = scene.model || videoConfig.model || message.templateConfig?.videoModel;
    
    const provider: ProviderType = videoConfig.provider || 'falai';

    processorLogger.debug(`Video generation starting`, {
      sceneIndex,
      model: selectedModel,
      provider,
      userId,
    });

    // Build input context for generation type detection
    const videoInputContext: Record<string, unknown> = {};
    if (message.generatedImageUrl) {
      videoInputContext.image_url = message.generatedImageUrl;
    }
    if (videoConfig.characterReferenceImages && videoConfig.characterReferenceImages.length > 0) {
      videoInputContext.reference_images = videoConfig.characterReferenceImages;
    }

    const { actualModelId, providerType } = resolveProvider(
      selectedModel,
      'video',
      provider,
      undefined,
      videoInputContext
    );

    const prompt = buildFinalPrompt(scene, 'video', storyData?.characterAnchor, message.templateConfig);
    processorLogger.debug(`Video prompt for scene ${sceneIndex}`, {
      sceneIndex,
      prompt: prompt.substring(0, 100),
    });

    const baseUrl = new URL(message.baseUrl || 'https://create-story-worker.artflicks.workers.dev');
    const webhookMetadata = buildWebhookMetadata({
      storyId,
      sceneIndex,
      type: 'video',
      userId,
      jobId: message.jobId,
      model: actualModelId,
      seriesId: seriesId && seriesId.trim() !== '' ? seriesId : undefined,
    });
    const webhookUrl = buildWebhookUrl(providerType, baseUrl.origin, webhookMetadata);

    processorLogger.debug(`Triggering async video generation`, {
      sceneIndex,
      actualModelId,
      providerType,
      webhookUrl,
    });

    const { triggerVideoGeneration } = await import('./video-generation');
    const apiKey = providerType === 'falai' ? env.FAL_API_KEY : env.REPLICATE_API_TOKEN;
    const result = await triggerVideoGeneration(
      {
        prompt,
        model: actualModelId,
        width: 512,
        height: 512,
        resolution: videoConfig.resolution,
        duration: scene.videoDuration ?? scene.duration,
        aspect_ratio: videoConfig.aspectRatio,
        seed: videoConfig.preset.seed,
        videoConfig: videoConfig,
        referenceImageUrl: message.generatedImageUrl,
        templateConfig: message.templateConfig,
      },
      {
        userId: userId!,
        seriesId: seriesId ?? '',
        storyId: storyId!,
        sceneIndex,
        provider: providerType,
        apiKey,
        webhookUrl,
      }
    );

    processorLogger.info(`Video generation triggered`, {
      sceneIndex,
      predictionId: result.predictionId,
      provider: providerType,
    });

    await trackAIUsageInternal(env, {
      userId,
      teamId: message.teamId,
      provider: providerType,
      model: actualModelId,
      feature: 'video-generation',
      type: 'video',
      durationSeconds: scene.duration ?? 5,
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
  const { storyData, videoConfig, userId, storyId, sceneIndex } = message;
  const scene = storyData?.scenes[sceneIndex] ?? await getSceneFromCoordinator(storyId, sceneIndex, env);

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
      estimated_duration_seconds: status.estimatedDurationSeconds,
    }, {
      onConflict: 'job_id',
    });

  if (error) {
    console.error(`[Update Job Status] Failed to update job ${jobId}:`, error);
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  console.log(`[Update Job Status] Successfully updated job ${jobId} with status: ${status.status}`);
}

