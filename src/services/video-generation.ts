// Video generation service using Replicate SDK

import { R2Bucket } from '@cloudflare/workers-types';
import Replicate from 'replicate';
import { generateUUID } from '../utils/storage';
import { VideoConfig } from '../types';
import { ScriptTemplateIds } from '@artflicks/video-compiler';
import { attachImageInputs, getNearestDuration, getModelImageConfig } from '../utils/replicate-model-config';

export interface VideoGenerationParams {
    prompt: string;
    model: string;
    width: number;
    height: number;
    resolution: string;
    /** Scene duration in seconds (5 or 10 for video). Passed to the video model when supported. */
    duration?: number;
    aspect_ratio?: string;
    seed?: number;
    videoConfig: VideoConfig;
}

export interface VideoGenerationResult {
    predictionId: string;
    status: string;
}

/**
 * Trigger async video generation via Replicate
 */
export async function triggerVideoGeneration(
    params: VideoGenerationParams,
    options: {
        userId: string;
        seriesId: string;
        storyId: string;
        sceneIndex: number;
        replicateApiToken: string;
        webhookUrl: string;
    }
): Promise<VideoGenerationResult> {
    const { replicateApiToken, webhookUrl } = options;

    // Initialize Replicate client
    const replicate = new Replicate({
        auth: replicateApiToken,
    });

    // Prepare input for Replicate video models
    const input: any = {
        prompt: `${params.prompt} ${params.videoConfig?.preset?.stylePrompt || ''}, high quality motion, cinematic`,
    };

    const modelConfig = getModelImageConfig(params.model);
    if (modelConfig.defaultInputs) {
        Object.assign(input, modelConfig.defaultInputs);
    }

    if (params.videoConfig.templateId === ScriptTemplateIds.CHARACTER_STORY) {
        // Attach image inputs based on model type only in CHARACTER_STORY
        attachImageInputs(input, params.model, params.videoConfig?.characterReferenceImages);
    }

    // Scene duration — snap to model-allowed values (e.g. Veo: 4, 6, 8) when applicable
    if (params.duration !== undefined && params.duration > 0) {
        input.duration = getNearestDuration(params.duration, params.model);
    }
    // Video models often use aspect_ratio instead of width/height
    if (params.aspect_ratio) {
        input.aspect_ratio = params.aspect_ratio;
    }
    if (params.seed !== undefined) {
        input.seed = params.seed;
    }

    console.log(`[VIDEO-GENERATION] Creating prediction for video - Story: ${options.storyId}, Scene: ${options.sceneIndex}`);

    // Handle both versioned models (owner/name:version) and model names (owner/name)
    const hasVersion = params.model.includes(':');

    // Append model to webhook for tracking
    const webhookWithModel = `${webhookUrl}&model=${encodeURIComponent(params.model)}`;

    const predictionParams: any = {
        input,
        webhook: webhookWithModel,
        webhook_events_filter: ["completed"],
    };

    if (hasVersion) {
        predictionParams.version = params.model.split(':')[1];
    } else {
        predictionParams.model = params.model;
    }
    console.log(`[VIDEO-GENERATION] Prediction params:`, predictionParams);
    const prediction = await replicate.predictions.create(predictionParams);

    console.log(`[VIDEO-GENERATION] Prediction created: ${prediction.id}`);

    return {
        predictionId: prediction.id,
        status: prediction.status,
    };
}

/**
 * Process finished video prediction - download from Replicate and upload to R2
 */
export async function processFinishedVideoPrediction(
    prediction: any,
    options: {
        userId: string;
        seriesId: string;
        storyId: string;
        bucket: R2Bucket;
        pathName: string;
    }
): Promise<string[]> {
    const { bucket, pathName } = options;

    // Video output is typically a single URL string or array
    const videoUrls = extractVideoUrls(prediction.output);
    console.log(`[VIDEO-GENERATION] Extracted video URLs:`, videoUrls);

    const storageUrls: string[] = [];
    for (const videoUrl of videoUrls) {
        if (!videoUrl) continue;

        const urlString = typeof videoUrl === 'string' ? videoUrl : String(videoUrl);

        const videoResponse = await fetch(urlString);
        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch generated video: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.arrayBuffer();

        const fileName = `${generateUUID()}.mp4`;
        const key = `${pathName}/${fileName}`;

        await bucket.put(key, videoBlob, {
            httpMetadata: {
                contentType: 'video/mp4',
            },
        });

        const publicUrl = `https://videos.artflicks.app/${key}`;
        storageUrls.push(publicUrl);
    }

    return storageUrls;
}

/**
 * Extract video URLs from Replicate output
 */
function extractVideoUrls(output: any): string[] {
    if (!output) return [];

    // Handle array of URLs
    if (Array.isArray(output)) {
        return output.map((item: any) => {
            if (typeof item === 'string') return item;
            if (item?.href) return item.href;
            if (item instanceof URL) return item.href;
            return String(item);
        });
    }

    // Handle single string URL
    if (typeof output === 'string') {
        return [output];
    }

    // Handle URL object
    if (output?.href) {
        return [output.href];
    }

    console.warn('[VIDEO-GENERATION] Unknown output format:', output);
    return [];
}
