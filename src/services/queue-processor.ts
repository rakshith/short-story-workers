// Queue processor for async story generation

import { Env, QueueMessage } from '../types/env';
import { Scene, StoryTimeline } from '../types';
import { generateAndUploadImages } from './image-generation';
import { generateSceneAudio } from './audio-generation';
import { StoryService } from './supabase';
import { getModelForTier } from '../utils/model-utils';
import { generateShortStoryPath } from '../utils/storage';
import { getVideoRenderConfig, VIDEO_FPS } from '../utils/video-calculations';
import { AspectRatio, ProjectStatus } from '../types';
import { processorLogger } from '../utils/logger';

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
    const pathName = generateShortStoryPath(
      'FACELess',
      userId,
      seriesId,
      storyId,
      videoConfig.outputFormat || 'jpg'
    );

    processorLogger.debug(`Calling Replicate API`, {
      sceneIndex,
      model: selectedModel,
      width,
      height,
      promptLength: prompt.length,
    });

    const result = await processorLogger.logApiCall(
      'generateAndUploadImages',
      () => generateAndUploadImages(
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
      },
        {
          userId,
          seriesId,
          storyId: storyId,
          imagesBucket: env.IMAGES_BUCKET,
          replicateApiToken: env.REPLICATE_API_TOKEN,
          pathName,
        }
      ),
      { sceneIndex, model: selectedModel }
    );

    console.log(`[PROCESSOR] Image generation result:`, {
      sceneIndex,
      storageUrls: result.storageUrls,
      storageUrlsLength: result.storageUrls?.length,
      firstUrl: result.storageUrls[0],
    });

    processorLogger.info(`Image generated successfully`, {
      sceneIndex,
      imageUrl: result.storageUrls[0],
      model: selectedModel,
    });

    return {
      sceneIndex,
      imageUrl: result.storageUrls[0] || null,
      success: true,
    };
  } catch (error) {
    processorLogger.error(`Error generating image for scene ${sceneIndex}`, error, {
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
 * Process a single scene audio generation
 */
export async function processSceneAudio(
  message: QueueMessage,
  env: Env
): Promise<{ sceneIndex: number; audioUrl: string | null; audioDuration: number; captions: any[]; success: boolean; error?: string }> {
  const { storyData, videoConfig, userId, sceneIndex } = message;
  const scene = storyData.scenes[sceneIndex];

  if (!scene || !scene.narration) {
    return {
      sceneIndex,
      audioUrl: null,
      audioDuration: 0,
      captions: [],
      success: false,
      error: 'No narration provided',
    };
  }

  try {
    const selectedVoice = videoConfig.voice || 'alloy';

    const result = await generateSceneAudio(
      scene.narration,
      selectedVoice,
      scene.duration,
      userId,
      scene.sceneNumber,
      1.0,
      env.AUDIO_BUCKET,
      env.ELEVENLABS_API_KEY,
      env.OPENAI_API_KEY,
      env.ELEVENLABS_DEFAULT_VOICE_ID
    );

    return {
      sceneIndex,
      audioUrl: result.audioUrl,
      audioDuration: result.audioDuration,
      captions: result.captions,
      success: true,
    };
  } catch (error) {
    console.error(`[Queue Processor] Error generating audio for scene ${sceneIndex}:`, error);
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
 * Finalize story and save to database
 */
export async function finalizeStory(
  message: QueueMessage,
  imageResults: Array<{ sceneIndex: number; imageUrl: string | null; success: boolean; error?: string }>,
  audioResults: Array<{ sceneIndex: number; audioUrl: string | null; audioDuration: number; captions: any[]; success: boolean; error?: string }>,
  env: Env
): Promise<void> {
  const { storyData, videoConfig, userId, seriesId, title, storyId } = message;

  // Update scenes with generated images and audio
  const scenesWithMedia = storyData.scenes.map((scene: Scene, index: number) => {
    const imageResult = imageResults.find((r) => r.sceneIndex === index);
    const audioResult = audioResults.find((r) => r.sceneIndex === index);

    return {
      ...scene,
      generatedImageUrl: imageResult?.imageUrl || undefined,
      generationError: imageResult?.success === false ? imageResult.error : undefined,
      audioUrl: audioResult?.audioUrl || undefined,
      audioDuration: audioResult?.audioDuration || undefined,
      captions: audioResult?.captions || undefined,
      audioGenerationError: audioResult?.success === false ? audioResult.error : undefined,
    };
  });

  const finalStory: StoryTimeline = {
    ...storyData,
    scenes: scenesWithMedia,
  };

  // Calculate video config
  const aspectRatio = (videoConfig.aspectRatio as AspectRatio) || '9:16';
  const { durationInFrames } = getVideoRenderConfig(finalStory.scenes, aspectRatio, VIDEO_FPS);

  const videoConfigData = {
    aspectRatio: videoConfig.aspectRatio,
    model: videoConfig.model,
    music: videoConfig.music,
    musicVolume: videoConfig.musicVolume ? videoConfig.musicVolume / 100 : 0.5,
    preset: videoConfig.preset,
    voice: videoConfig.voice,
    outputFormat: videoConfig.outputFormat || 'jpg',
    captionStylePreset: videoConfig.captionStylePreset,
    watermark: videoConfig.watermark || {
      text: 'ArtFlicks',
      variant: 'gradient',
      show: true,
    },
    transitionPreset: videoConfig.transitionPreset || 'crossfade',
    durationInFrames,
  };

  // Save to database
  const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  await storyService.createStory({
    userId,
    seriesId,
    title,
    videoType: videoConfig?.videoType || 'faceless-video',
    story: finalStory,
    status: ProjectStatus.DRAFT,
    videoConfig: videoConfigData,
    storyCost: videoConfig.estimatedCredits,
  });
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
    }, {
      onConflict: 'job_id',
    });

  if (error) {
    console.error(`[Update Job Status] Failed to update job ${jobId}:`, error);
    throw new Error(`Failed to update job status: ${error.message}`);
  }
  
  console.log(`[Update Job Status] Successfully updated job ${jobId} with status: ${status.status}`);
}

