// AI UGC Ads workflow definition
// AI Director-driven scene composition: single agent handles all creative decisions
// Flow: AIDirectorAgent → ModelSelectionAgent → CompositeImageAgent → AvatarAgent

import { StoryTimeline, VideoConfig } from '../types';
import { WorkflowDefinition } from './registry';
import { orchestrateStoryCreation } from '../services/story-orchestrator';
import { updateJobStatus } from '../services/queue-processor';
import { AgentRegistry } from '../agents/agent-registry';
import { aiUgcAdsConfig } from './configs/ai-ugc-ads.config';
import { CreativeFreedom, mapSliderToFreedom } from '../types/creative-plan';
import { extractVideoFrame } from '../utils/video-frame-extractor';
import { estimateAiUgcAdsGeneration } from '@artflicks/credit-tracker';

export interface AiUgcAdsRequest {
  userId: string;
  seriesId?: string;
  teamId?: string;
  userTier?: string;
  title: string;
  prompt: string;
  model?: string;
  creativeFreedom?: number; // 0-100 slider, mapped to conservative/balanced/bold/experimental
  selectedVideoTier?: string; // 'auto' | 'basic' | 'pro' | 'ultra' | 'max'
  videoConfig: {
    videoType: 'ai-ugc-ads';
    avatarImageUrl: string;
    avatarModel?: string;
    aspectRatio?: string;
    voice?: string;
    music?: string | null;
    musicVolume?: number;
    enableCaptions?: boolean;
    captionStylePreset?: string;
    transitionPack?: TransitionPack;
    enableAvatarAudio?: boolean;
    enhanceWithAI?: boolean;
    script?: string;
    language?: string;
    audioModel?: string;
    targetDuration?: number; // Override freedom-mode duration (10-120s). If omitted, freedom mode decides.
  };
  showcase: {
    items: ProductItem[];
    style?: 'auto' | 'influencer' | 'saas-demo' | 'product-showcase' | 'tutorial' | 'premium' | 'unboxing' | 'tiktok' | 'youtube-review' | 'instagram-story' | 'corporate-b2b';
  };
  compositeImage?: string; // Optional: user provides avatar + product in one image
}

export interface ProductItem {
  url: string;
  type: 'video' | 'image';
  label?: string;
  duration?: number;
  trim?: { start: number; end: number };
}

export type TransitionPack = 'minimal' | 'apple' | 'modern-saas' | 'tiktok' | 'premium';
export type ContentTone = 'educational' | 'premium' | 'energetic' | 'casual' | 'technical';

export const aiUgcAdsDefinition: WorkflowDefinition = {
  id: 'ai-ugc-ads',
  name: 'AI UGC Ads',

  validate: aiUgcAdsConfig.validate,

  execute: async (body, { jobId, resolved, baseUrl, env }) => {
    const request = body as AiUgcAdsRequest;
    const agents = new AgentRegistry(env);

    // Map creative freedom slider (0-100) to level
    const creativeFreedom: CreativeFreedom = mapSliderToFreedom(request.creativeFreedom ?? 50);

    // Duration determined by freedom mode — couples creativity with pacing
    const FREEDOM_DURATIONS: Record<CreativeFreedom, number> = {
      conservative: 15,
      balanced: 30,
      bold: 45,
      experimental: 60,
    };
    const targetDuration = request.videoConfig.targetDuration || FREEDOM_DURATIONS[creativeFreedom];

    console.log(`[AI-UGC-Ads] Starting workflow for user ${request.userId}, creative freedom: ${creativeFreedom}, duration: ${targetDuration}s`);

    // ── Step 1: AI Director — All creative inference in one pass ──────
    // Replaces VisionAgent + ClassificationAgent + ScriptAgent
    const directorResult = await agents.aiDirector.execute({
      avatarImageUrl: request.videoConfig.avatarImageUrl,
      productImages: request.showcase.items.map(item => ({ url: item.url, type: item.type })),
      voiceoverUrl: request.videoConfig.voice || undefined,
      aspectRatio: request.videoConfig.aspectRatio || '9:16',
      creativeFreedom,
      targetDuration,
      userId: request.userId,
      title: request.title,
      userTier: resolved.tier,
    });

    if (!directorResult.success || !directorResult.plan) {
      return {
        success: false,
        error: directorResult.error || 'AI Director failed to generate creative plan',
      };
    }

    const creativePlan = directorResult.plan;
    console.log(`[AI-UGC-Ads] Creative plan: ${creativePlan.story.scenes.length} scenes, ${creativePlan.story.totalDuration}s, product: ${creativePlan.inference.productCategory}`);

    // ── Step 2: Video Product Strategy Decision ──────
    const productItem = request.showcase.items[0];
    let extractedFrameUrl: string | undefined;
    let videoAspectRatio = request.videoConfig.aspectRatio || '9:16';

    if (productItem?.type === 'video' && creativePlan.videoProductAnalysis) {
      const videoAnalysis = creativePlan.videoProductAnalysis;
      const videoStrategy = videoAnalysis.videoStrategy;

      console.log(`[AI-UGC-Ads] Video product detected: strategy=${videoStrategy}, complexity=${videoAnalysis.videoComplexityScore}, aspect=${videoAnalysis.detectedAspectRatio}`);

      // Use detected aspect ratio from video (or fall back to user selection)
      if (videoAnalysis.detectedAspectRatio && videoAnalysis.detectedAspectRatio !== 'other') {
        videoAspectRatio = videoAnalysis.detectedAspectRatio;
      }

      if (videoStrategy === 'unusable') {
        return {
          success: false,
          error: 'Product video is not usable — too short, blurry, or invalid format',
        };
      }

      if (videoStrategy === 'simple-composite' && creativePlan.requirements.needsComposite) {
        // Extract frame at best timestamp for composite (physical products only)
        const timestamp = videoAnalysis.bestProductTimestamp || '00:00:01.00';
        console.log(`[AI-UGC-Ads] Extracting frame at ${timestamp} for simple-composite strategy (physical product)`);

        const frameResult = await extractVideoFrame(env, {
          videoUrl: productItem.url,
          timestamp,
          outputAspectRatio: videoAnalysis.detectedAspectRatio || '9:16',
        });

        if (frameResult.success && frameResult.frameBlob) {
          // Upload extracted frame to R2
          const frameKey = `ai-ugc-ads-frames/${request.userId}/${crypto.randomUUID()}.jpg`;
          await env.IMAGES_BUCKET.put(frameKey, frameResult.frameBlob, {
            httpMetadata: { contentType: frameResult.contentType || 'image/jpeg' },
          });

          // Construct public URL for the extracted frame
          const baseUrl = env.APP_URL || 'https://artflicks.app';
          extractedFrameUrl = `${baseUrl}/api/storage/images/${frameKey}`;

          console.log(`[AI-UGC-Ads] Frame extracted and uploaded: ${extractedFrameUrl}`);
        } else {
          return {
            success: false,
            error: `Failed to extract product frame from video: ${frameResult.error}`,
          };
        }
      }

      // luxury-fullscreen: continue without composite (full video flow)
      if (videoStrategy === 'luxury-fullscreen') {
        console.log(`[AI-UGC-Ads] Luxury video detected — using full video as product showcase`);
      }
    }

    // ── Step 3: Model Selection — Choose optimal models ──────
    const modelResult = await agents.modelSelection.execute({
      creativePlan,
      userTier: resolved.tier,
      aspectRatio: request.videoConfig.aspectRatio || '9:16',
      selectedVideoTier: request.selectedVideoTier || 'auto',
      videoComplexityScore: creativePlan.videoProductAnalysis?.videoComplexityScore,
      targetDuration,
      sceneCount: creativePlan.story.scenes.length,
    });

    if (!modelResult.success || !modelResult.modelPlan) {
      return {
        success: false,
        error: modelResult.error || 'Model Selection failed',
      };
    }

    const modelPlan = modelResult.modelPlan;
    console.log(`[AI-UGC-Ads] Models: image=${modelPlan.image.model}, avatar=${modelPlan.avatar.model}, voice=${modelPlan.voice.model}, video=${modelPlan.video.model} (${modelPlan.video.variant}, ${modelPlan.video.resolution})`);

    // ── Step 3.5: Estimate credits for this workflow ──────
    const estimatedCost = estimateAiUgcAdsGeneration({
      duration: targetDuration,
      sceneCount: creativePlan.story.scenes.length,
      enableComposite: creativePlan.requirements.needsComposite,
      enableVoiceover: creativePlan.requirements.needsVoiceover,
      enableMusic: Boolean(request.videoConfig.music),
      videoModelKey: modelPlan.video.modelKey,
      videoStrategy: creativePlan.videoProductAnalysis?.videoStrategy,
      scriptCharCount: request.prompt?.length,
    });

    console.log(`[AI-UGC-Ads] Estimated cost: ${estimatedCost.totalCredits} credits`);

    // ── Step 4: Generate composite image for physical products ──────
    let compositeImageUrl: string | undefined;

    // Determine if we need composite generation
    const isLuxuryVideo = productItem?.type === 'video' 
      && creativePlan.videoProductAnalysis?.videoStrategy === 'luxury-fullscreen';
    const isSimpleCompositeVideo = productItem?.type === 'video'
      && creativePlan.videoProductAnalysis?.videoStrategy === 'simple-composite';

    if (creativePlan.requirements.needsComposite && !isLuxuryVideo) {
      console.log(`[AI-UGC-Ads] Physical product detected, generating composite image with model: ${modelPlan.image.model}`);

      // Use extracted frame URL if available (from simple-composite video), otherwise use image item
      const productImageUrl = extractedFrameUrl 
        || request.showcase.items.find(i => i.type === 'image')?.url;

      if (productImageUrl) {
        // Use first scene's shot description + vision analysis for richer composite prompt
        const firstSceneShot = creativePlan.story.scenes[0]?.shotDescription;
        const visualStyle = directorResult.visionResults?.[0]?.analysis?.visualStyle;

        const compositeResult = await agents.compositeImage.execute({
          avatarImageUrl: request.videoConfig.avatarImageUrl,
          productImageUrl,
          productDescription: creativePlan.inference.productCategory,
          userId: request.userId,
          model: modelPlan.image.model,
          aspectRatio: videoAspectRatio,
          shotDescription: firstSceneShot,
          visualStyle,
          brandTone: creativePlan.inference.brandTone,
        });

        if (compositeResult.success && compositeResult.compositeImageUrl) {
          compositeImageUrl = compositeResult.compositeImageUrl;
          console.log(`[AI-UGC-Ads] Composite image generated: ${compositeImageUrl}`);
        } else {
          console.warn(`[AI-UGC-Ads] Composite generation failed: ${compositeResult.error}, using original avatar`);
        }
      } else {
        console.warn(`[AI-UGC-Ads] No product image available for composite generation`);
      }
    }

    // ── Step 4: Build Story Timeline from CreativePlan ──────
    const displayStrategy = request.compositeImage
      ? 'composite' as const
      : creativePlan.inference.productType === 'physical'
        ? 'composite' as const
        : 'pip-overlay' as const;

    const storyData: StoryTimeline = {
      id: crypto.randomUUID(),
      title: creativePlan.title || request.title,
      totalDuration: Number(creativePlan.story.totalDuration) || 30,
      scenes: creativePlan.story.scenes.map((creativeScene, index) => {
        const sceneType = creativeScene.sceneType;
        // Avatar ALWAYS in intro/outro only — for both physical and SaaS
        const isPhysicalProduct = creativePlan.inference.productType === 'physical';
        const isAvatarScene = sceneType === 'intro' || sceneType === 'outro';

        // Pick showcase item (cycle through if more scenes than items)
        const itemIndex = index % request.showcase.items.length;
        const showcaseItem = request.showcase.items[itemIndex];

        return {
          sceneNumber: creativeScene.sceneNumber,
          duration: Number(creativeScene.duration) || 5,
          details: `${sceneType} — ${creativeScene.shotDescription.slice(0, 200)}`,
          narration: creativeScene.narration,
          imagePrompt: creativeScene.shotDescription,
          cameraAngle: 'front',
          sourceMediaUrl: showcaseItem.url,
          captions: [],
          mood: creativePlan.inference.brandTone,
          composer: {
            classification: {
              productType: creativePlan.inference.productType,
              productCategory: creativePlan.inference.productCategory,
              avatarBehavior: isAvatarScene
              ? 'avatar-holds-product'
              : isPhysicalProduct
                ? 'no-avatar'
                : 'pip-overlay',
              visualStrategy: displayStrategy === 'composite' ? 'composite' : 'user-video-composite',
              motionType: 'static',
            },
            sceneKind: sceneType === 'intro' ? 'hook' : sceneType === 'outro' ? 'cta' : sceneType,
            sceneType: sceneType,
            showcaseItem: {
              itemIndex,
              url: showcaseItem.url,
              type: showcaseItem.type,
              label: showcaseItem.label,
            },
            avatarPolicy: isAvatarScene
              ? { visibility: 'full-screen', scale: 1.0 }
              : isPhysicalProduct
                ? { visibility: 'hidden', scale: 0 }
                : { visibility: 'pip-corner', scale: 0.3, position: { x: 0.7, y: 0.65 } },
            // Use composite image for physical products (avatar holding product)
            avatarImageUrl: isAvatarScene
              ? (compositeImageUrl || request.videoConfig.avatarImageUrl)
              : isPhysicalProduct
                ? showcaseItem.url
                : request.videoConfig.avatarImageUrl,
            avatarModel: modelPlan.avatar.model, // Use model from ModelPlan
            // AI Director creative fields — flow to AvatarAgent motion instructions
            shotDescription: creativeScene.shotDescription,
            cameraStyle: creativeScene.cameraStyle,
            cameraPolicy: { angle: 'front', movement: 'static', intensity: 'medium' },
            transitionPolicy: { type: 'cut', durationFrames: 6 },
            effects: undefined,
            visionAnalysis: directorResult.visionResults?.[itemIndex]?.analysis,
            styleProfile: request.showcase?.style || 'auto',
            // Display strategy
            displayStrategy: displayStrategy,
            displayPipeline: {
              enableAvatarVideo: isAvatarScene,
              overlayType: displayStrategy === 'composite' ? 'composite' : displayStrategy === 'pip-overlay' ? 'pip' : 'full-screen',
              // Include all product items (images and videos)
              productImages: request.showcase.items.map(i => i.url),
              // Video-specific fields for luxury-fullscreen
              ...(showcaseItem.type === 'video' && {
                videoAspectRatio: videoAspectRatio,
                videoStrategy: creativePlan.videoProductAnalysis?.videoStrategy,
              }),
              // SaaS explainer: trim range for the source video segment this scene covers
              // Only set for demo scenes when Creative Director assigned sourceStart/sourceEnd
              ...(creativeScene.sourceStart != null && creativeScene.sourceEnd != null && {
                sourceStart: creativeScene.sourceStart,
                sourceEnd: creativeScene.sourceEnd,
              }),
            },
          },
        };
      }) as StoryTimeline['scenes'],
    };

    const isPhysicalProduct = creativePlan.inference.productType === 'physical';

    const videoConfig: VideoConfig = {
      aspectRatio: request.videoConfig.aspectRatio || '9:16',
      voice: request.videoConfig.voice || '',
      music: request.videoConfig.music || '',
      musicVolume: request.videoConfig.musicVolume || 0.12,
      preset: { id: 'ai-ugc-ads', name: 'AI UGC Ads', stylePrompt: '' },
      model: 'ai-ugc-ads',
      script: request.prompt || '',
      videoType: 'ai-ugc-ads',
      outputFormat: 'mp4',
      audioModel: modelPlan.voice.model,
      resolution: modelPlan.video.resolution,
      mediaType: isPhysicalProduct ? 'ai-videos' : 'ai-images',
      transitionPreset: 'crossfade',
      captionStylePreset: (request.videoConfig.captionStylePreset || 'beast') as VideoConfig['captionStylePreset'],
      enableCaptions: request.videoConfig.enableCaptions ?? true,
      enableVoiceOver: true,
      templateId: 'ai-ugc-ads',
      sceneReviewRequired: false,
      // Video model selection from ModelPlan
      videoModel: modelPlan.video.model,
      videoVariant: modelPlan.video.variant,
      videoModelKey: modelPlan.video.modelKey,
      // Audio handling for video model (ElevenLabs TTS lip-sync)
      audioInput: modelPlan.video.audioInput,
      audioParam: modelPlan.video.audioParam,
      audioArray: modelPlan.video.audioArray,
      generateAudio: modelPlan.video.generateAudio,
      // Product type for workflow tree resolution
      productType: creativePlan.inference.productType,
    } as VideoConfig;

    await updateJobStatus(jobId, {
      jobId,
      userId: request.userId,
      status: 'processing',
      progress: 0,
      totalScenes: storyData.scenes.length,
      imagesGenerated: 0,
      audioGenerated: 0,
      teamId: request.teamId,
    }, env);

    const result = await orchestrateStoryCreation({
      jobId,
      userId: request.userId,
      storyData,
      videoConfig,
      baseUrl,
      userTier: resolved.tier,
      priority: resolved.priority,
      seriesId: request.seriesId,
      teamId: request.teamId,
      title: request.title,
      env,
      templateConfig: {
        generateAudio: true,
        generateVisuals: false,
      },
      preCalculatedCost: {
        credits: estimatedCost.totalCredits,
        breakdown: estimatedCost.breakdown as Record<string, unknown>,
      },
    });

    return {
      success: result.success,
      storyId: result.storyId,
      error: result.error,
      cost: result.cost,
      creditsDeducted: result.creditsDeducted,
      creditError: result.creditError,
      estimatedCost: estimatedCost.totalCredits,
      costBreakdown: estimatedCost.breakdown,
      message: result.success
        ? `AI UGC Ads workflow started with ${storyData.scenes.length} scenes (${creativePlan.inference.productType} / ${creativePlan.inference.adFormat})`
        : result.error,
    };
  },
};
