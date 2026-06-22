// Talking Avatar Pipeline Service
// Linear pipeline: Script → TTS Audio → Kling AI Avatar Video

import { Env } from '../types/env';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from './queue-processor';
import { deductCredits, trackAIUsageInternal } from './usage-tracking';
import { getCoordinator, initCoordinator, updateCoordinatorAudio } from '../utils/coordinator';
import { generateSceneAudio, transcribeUploadedAudio } from './audio-generation';
import type { Caption, VideoConfig } from '../types';
import type { CostResponse } from '@artflicks/credit-tracker';
import { estimateGeneration } from '@artflicks/credit-tracker';

const VIDEO_TYPE = 'talking-avatar' as const;

export interface TalkingAvatarPipelineInput {
    jobId: string;
    avatarImageUrl: string;
    script: string;
    voice: string;
    audioModel: string;
    duration: number;
    language: string;
    aspectRatio: string;
    model: string; // 'standard' | 'pro'
    userId: string;
    seriesId?: string;
    teamId?: string;
    title: string;
    userTier: string;
    priority: number;
    baseUrl: string;
    env: Env;
    audioUrl?: string; // Pre-uploaded audio URL (skips TTS)
    backgroundMusic?: string;
    musicVolume?: number;
    motionInstructions?: string;
    enhanceWithAI?: boolean;
    enableCaptions?: boolean;
    videoConfig?: VideoConfig; // Full videoConfig from frontend (used for story record and DO init)
}

export interface TalkingAvatarPipelineResult {
    success: boolean;
    storyId?: string;
    error?: string;
    cost?: CostResponse;
    creditsDeducted?: boolean;
    creditError?: string;
}

/**
 * Build the credit cost breakdown for talking avatar generation using the unified estimator.
 */
function buildAvatarCost(
    duration: number,
    model: string,
    ttsCharCount: number,
    audioModel: string
): { credits: number; costResponse: CostResponse } {
    const estimate = estimateGeneration({
        model,
        duration,
        mediaType: 'avatar',
        operations: ttsCharCount > 0 ? [{ type: 'tts', charCount: ttsCharCount }] : [],
    });

    const costResponse: CostResponse = {
        valid: true,
        credits: estimate.totalCredits,
        currency: 'USD',
        breakdown: estimate.breakdown,
    };

    return { credits: estimate.totalCredits, costResponse };
}

/**
 * Execute the talking avatar pipeline
 * 1. Create story + job records
 * 2. Generate TTS audio from script (uploads to R2 internally)
 * 3. Trigger Kling AI Avatar video (async via webhook)
 * 4. Return jobId + storyId (webhook handles completion)
 */
export async function executeTalkingAvatarPipeline(
    input: TalkingAvatarPipelineInput
): Promise<TalkingAvatarPipelineResult> {
    const {
        jobId,
        avatarImageUrl,
        script,
        voice,
        audioModel,
        duration,
        language,
        aspectRatio,
        model,
        userId,
        seriesId,
        teamId,
        title,
        userTier,
        priority,
        baseUrl,
        env,
        audioUrl: preUploadedAudioUrl,
        backgroundMusic,
        musicVolume,
        motionInstructions,
        enhanceWithAI,
        enableCaptions,
        videoConfig,
    } = input;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        // 1. Create story record in Supabase
        const storyId = generateUUID();
        console.log(`[Talking Avatar Pipeline] Story: ${storyId}, Job: ${jobId}`);

        const storyData = {
            id: storyId,
            title,
            totalDuration: duration,
            scenes: [{
                sceneNumber: 1,
                duration,
                narration: script,
                imagePrompt: '',
                videoPrompt: '',
                cameraAngle: 'medium shot',
                mood: 'neutral',
                action: '',
                details: '',
                generatedImageUrl: avatarImageUrl,
            }],
        };

        const { error: storyError } = await supabase
            .from('stories')
            .insert({
                id: storyId,
                user_id: userId,
                video_type: VIDEO_TYPE,
                series_id: seriesId || null,
                team_id: teamId || null,
                title,
                story: storyData,
                video_config: videoConfig || {
                    videoType: VIDEO_TYPE,
                    aspectRatio,
                    model: `kling-avatar-v2/${model}`,
                    avatarImageUrl,
                    voice,
                    audioModel,
                    duration,
                    language,
                    userId,
                    seriesId,
                    teamId,
                    music: backgroundMusic,
                    musicVolume,
                    motionInstructions,
                    enhanceWithAI,
                    enableCaptions,
                    enableAvatarAudio: true,
                },
                status: 'processing',
            });

        if (storyError) {
            console.error('[Talking Avatar Pipeline] Failed to create story:', storyError);
            await updateJobStatus(jobId, {
                jobId,
                userId,
                status: 'failed',
                progress: 0,
                totalScenes: 1,
                imagesGenerated: 0,
                audioGenerated: 0,
                error: `Failed to create story: ${storyError.message}`,
                teamId,
            }, env);
            return { success: false, error: `Failed to create story: ${storyError.message}` };
        }

        // 2. Create story_costs record
        // TTS term only counts when we actually generate TTS (not for pre-uploaded audio).
        const ttsCharCount = preUploadedAudioUrl ? 0 : script.length;
        const { credits, costResponse } = buildAvatarCost(duration, model, ttsCharCount, audioModel);

        await supabase
            .from('story_costs')
            .insert({
                job_id: jobId,
                user_id: userId,
                story_id: storyId,
                total_cost_usd: credits / 100,
                credits_cost: credits,
            });

        // 3. Deduct credits upfront
        const deductResult = await deductCredits(userId, credits, env);
        if (!deductResult.success) {
            console.error('[Talking Avatar Pipeline] Credit deduction failed:', deductResult.error);
            await updateJobStatus(jobId, {
                jobId,
                userId,
                status: 'failed',
                progress: 0,
                totalScenes: 1,
                imagesGenerated: 0,
                audioGenerated: 0,
                error: `Insufficient credits: ${deductResult.error}`,
                teamId,
            }, env);
            return { success: false, error: `Insufficient credits: ${deductResult.error}` };
        }

        // 4. Initialize Durable Object for SSE and finalization
        // skipAudioCheck: true because audio is generated synchronously in this same
        // request (step 5) before video is triggered. The DO should mark audio as
        // done at init time and only track video completion via the async webhook.
        const coordinator = getCoordinator(storyId, env);
        // Ensure mediaType is always 'ai-videos' so the DO knows this is a video story
        // (prevents premature completionSignaled from audio update)
        const effectiveVideoConfig = {
            ...(videoConfig || {
                videoType: VIDEO_TYPE,
                aspectRatio,
                model: `kling-avatar-v2/${model}`,
                avatarImageUrl,
                voice,
                audioModel,
                duration,
                language,
                music: backgroundMusic,
                musicVolume,
                enableCaptions,
                enableAvatarAudio: true,
            }),
            mediaType: 'ai-videos' as const,
        };
        await initCoordinator(coordinator, {
            storyId,
            userId,
            scenes: storyData.scenes,
            totalScenes: 1,
            videoConfig: effectiveVideoConfig,
            skipAudioCheck: true,
        });

        // 5. Generate TTS audio or transcribe uploaded audio
        let audioUrl: string;
        let audioDuration = duration;
        let captions: Caption[] = [];

        if (preUploadedAudioUrl) {
            // User uploaded their own audio — transcribe for captions (only if captions enabled)
            console.log(`[Talking Avatar Pipeline] Using pre-uploaded audio: ${preUploadedAudioUrl}`);
            audioUrl = preUploadedAudioUrl;
            if (enableCaptions) {
                try {
                    captions = await transcribeUploadedAudio(preUploadedAudioUrl, env.ELEVENLABS_API_KEY);
                    console.log(`[Talking Avatar Pipeline] Transcribed ${captions.length} caption words from uploaded audio`);
                } catch (err) {
                    console.warn(`[Talking Avatar Pipeline] Transcription failed, continuing without captions:`, err);
                    // Continue without captions — video will still play, just no text overlay
                }
            } else {
                console.log(`[Talking Avatar Pipeline] Captions disabled — skipping STT transcription`);
            }
        } else {
            // Generate TTS audio (generateSceneAudio handles R2 upload internally)
            console.log(`[Talking Avatar Pipeline] Generating TTS audio (captions: ${enableCaptions ?? true})...`);
            const audioResult = await generateSceneAudio(
                script,
                voice,
                duration,
                userId,
                1, // sceneNumber
                1.0, // speed
                env.AUDIO_BUCKET,
                env.ELEVENLABS_API_KEY,
                env.OPENAI_API_KEY,
                env.ELEVENLABS_DEFAULT_VOICE_ID,
                undefined, // narrationStyle
                audioModel,
                'avatar-voice-overs', // folder override for avatar audio
                enableCaptions ?? true, // skip alignment fetch when captions are off
            );
            audioUrl = audioResult.audioUrl;
            audioDuration = audioResult.audioDuration;
            captions = audioResult.captions;
        }

        console.log(`[Talking Avatar Pipeline] Audio ready: ${audioUrl}, duration: ${audioDuration}, captions: ${captions.length}`);

        // Update DO with real audio duration so handleFinalize computes correct totalDuration
        await updateCoordinatorAudio(coordinator, {
            sceneIndex: 0,
            audioUrl,
            audioDuration,
            captions,
        });

        // Update story with captions (for frontend to display during playback)
        if (captions.length > 0) {
            const { error: captionsError } = await supabase
                .from('stories')
                .update({
                    story: {
                        id: storyId,
                        title,
                        totalDuration: audioDuration,
                        scenes: [{
                            sceneNumber: 1,
                            duration: audioDuration,
                            audioDuration,
                            narration: script,
                            imagePrompt: '',
                            videoPrompt: '',
                            cameraAngle: 'medium shot',
                            mood: 'neutral',
                            action: '',
                            details: '',
                            generatedImageUrl: avatarImageUrl,
                            captions,
                        }],
                    },
                })
                .eq('id', storyId);
            if (captionsError) {
                console.warn(`[Talking Avatar Pipeline] Failed to store captions:`, captionsError);
            }
        }

        // Update progress to 50% (audio done)
        await updateJobStatus(jobId, {
            jobId,
            userId,
            status: 'processing',
            progress: 50,
            totalScenes: 1,
            imagesGenerated: 1,
            audioGenerated: 1,
            teamId,
        }, env);

        // 6. Trigger Kling AI Avatar video generation (FAL-first, Replicate fallback)
        const { ModelProviderFactory, PROVIDER_NAMES, isProviderConfigured } = await import('@artflicks/model-provider');

        const falAvailable = isProviderConfigured(PROVIDER_NAMES.FALAI, env);
        const replicateAvailable = isProviderConfigured(PROVIDER_NAMES.REPLICATE, env);
        console.log(`[Talking Avatar Pipeline] Provider check — FAL: ${falAvailable} (key: ${!!env.FAL_API_KEY}), Replicate: ${replicateAvailable} (key: ${!!env.REPLICATE_API_TOKEN})`);

        // FAL models: separate endpoints per tier
        const FAL_AVATAR_MODELS: Record<string, string> = {
            standard: 'fal-ai/kling-video/ai-avatar/v2/standard',
            pro: 'fal-ai/kling-video/ai-avatar/v2/pro',
        };
        // Replicate model: single model with mode parameter
        const REPLICATE_AVATAR_MODEL = 'kwaivgi/kling-avatar-v2';
        const REPLICATE_MODE_MAP: Record<string, string> = {
            standard: 'std',
            pro: 'pro',
        };

        // Webhook URLs — provider-specific endpoints (match queue-processor pattern)
        const origin = new URL(baseUrl).origin;
        const webhookParams = `storyId=${storyId}&type=avatar&userId=${userId}&jobId=${jobId}&model=${encodeURIComponent(model)}`;
        const falWebhookUrl = `${origin}/webhooks/fal?${webhookParams}`;
        const replicateWebhookUrl = `${origin}/webhooks/replicate?${webhookParams}`;

        let videoResult: { predictionId: string; status: string } | null = null;
        let usedProvider: string = '';
        let usedModel: string = '';

        // Build prompt from motion instructions only (script is already provided via audio)
        const prompt = motionInstructions || '';

        // Try FAL first
        if (falAvailable) {
            try {
                const falModel = FAL_AVATAR_MODELS[model] || FAL_AVATAR_MODELS.standard;
                const falProvider = ModelProviderFactory.createProvider(PROVIDER_NAMES.FALAI, { apiKey: env.FAL_API_KEY });
                if (falProvider.generateVideoAsync) {
                    videoResult = await falProvider.generateVideoAsync(falModel, {
                        imageUrl: avatarImageUrl,
                        audioUrl: audioUrl,
                        aspect_ratio: aspectRatio,
                        ...(prompt && { prompt }),
                    }, {
                        webhookUrl: falWebhookUrl,
                        webhookEvents: ['completed'],
                    });
                    usedProvider = 'falai';
                    usedModel = falModel;
                    console.log(`[Talking Avatar Pipeline] FAL submission succeeded: ${videoResult.predictionId}`);
                }
            } catch (err) {
                console.warn(`[Talking Avatar Pipeline] FAL submission failed, trying Replicate:`, err);
            }
        }

        // Fallback to Replicate
        if (!videoResult && replicateAvailable) {
            try {
                    const replicateProvider = ModelProviderFactory.createProvider(PROVIDER_NAMES.REPLICATE, { apiKey: env.REPLICATE_API_TOKEN });
                if (replicateProvider.generateVideoAsync) {
                    videoResult = await replicateProvider.generateVideoAsync(REPLICATE_AVATAR_MODEL, {
                        imageUrl: avatarImageUrl,
                        audioUrl: audioUrl,
                        aspect_ratio: aspectRatio,
                    }, {
                        input: {
                            mode: REPLICATE_MODE_MAP[model] || 'std',
                            ...(prompt && { prompt }),
                        },
                        webhookUrl: replicateWebhookUrl,
                        webhookEvents: ['completed'],
                    });
                    usedProvider = 'replicate';
                    usedModel = REPLICATE_AVATAR_MODEL;
                    console.log(`[Talking Avatar Pipeline] Replicate submission succeeded: ${videoResult.predictionId}`);
                }
            } catch (err) {
                console.error(`[Talking Avatar Pipeline] Replicate submission also failed:`, err);
            }
        }

        if (!videoResult) {
            throw new Error('No video provider available. Configure FAL_API_KEY or REPLICATE_API_TOKEN.');
        }

        console.log(`[Talking Avatar Pipeline] Video prediction created: ${videoResult.predictionId} (provider: ${usedProvider}, model: ${usedModel})`);

        // 7. Track AI usage for TTS (only if TTS was generated)
        if (!preUploadedAudioUrl) {
            await trackAIUsageInternal(env, {
                userId,
                teamId,
                provider: 'elevenlabs',
                model: audioModel,
                feature: 'talking-avatar-tts',
                type: 'audio',
                characterCount: script.length,
                durationSeconds: audioDuration,
                correlationId: storyId,
                source: 'api',
            });
        }

        return {
            success: true,
            storyId,
            cost: costResponse,
            creditsDeducted: true,
        };

    } catch (error) {
        console.error('[Talking Avatar Pipeline] Error:', error);

        await updateJobStatus(jobId, {
            jobId,
            userId,
            status: 'failed',
            progress: 0,
            totalScenes: 1,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            teamId,
        }, env);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
