// AI UGC Ads Adapter — Handles timeline generation for AI UGC Ads workflow
// Simple model: Avatar video OR user content + voiceover
// Does NOT modify existing adapters — isolated to ai-ugc-ads workflow

import {
  StoryAdapter,
  Story,
  VideoConfig,
  Timeline,
  TimelineItem,
} from '../types';
import { DEFAULT_MUSIC_VOLUME } from '../config';

const MIN_SCENE_DURATION = 0.1;
const TRANSITION_BUFFER = 0.2;

function getCaptionDuration(scene: Story['scenes'][number]): number {
  if (!Array.isArray(scene.captions) || scene.captions.length === 0) return 0;

  let maxEnd = 0;
  for (const caption of scene.captions) {
    const tokenEnd =
      Array.isArray(caption.tokens) && caption.tokens.length > 0
        ? Math.max(...caption.tokens.map((token) => token.endTime ?? 0))
        : 0;
    const captionEnd = Math.max(caption.endTime ?? 0, tokenEnd);
    if (captionEnd > maxEnd) maxEnd = captionEnd;
  }

  return maxEnd;
}

/**
 * Compute the effective scene duration for video generation.
 * This MUST match the timeline slot computed by the adapter to prevent
 * video files being shorter than their timeline slots (which causes frozen frames).
 *
 * Exported so pipeline-config.ts can use the same duration as the adapter.
 */
export function computeSceneDuration(
  scene: Story['scenes'][number],
  isLastScene: boolean
): number {
  const sceneDuration = scene.duration ?? 0;
  const resolvedAudioDuration = scene.audioDuration ?? scene.duration ?? 0;
  const captionDuration = getCaptionDuration(scene);
  const narrationDuration = Math.max(resolvedAudioDuration, captionDuration);

  return Math.max(
    sceneDuration,
    narrationDuration > 0 && !isLastScene ? narrationDuration + TRANSITION_BUFFER : narrationDuration,
    MIN_SCENE_DURATION
  );
}

export class AiUgcAdsAdapter implements StoryAdapter {
  supports(story: any, videoConfig?: VideoConfig): boolean {
    // Only support ai-ugc-ads workflow (check preset.id)
    return (
      videoConfig?.preset?.id === 'ai-ugc-ads' &&
      story !== null &&
      typeof story === 'object' &&
      Array.isArray(story.scenes) &&
      story.scenes.length > 0
    );
  }

  toTimeline(story: Story, videoConfig: VideoConfig): Timeline {
    const visual: TimelineItem[] = [];
    const audio: TimelineItem[] = [];
    const text: TimelineItem[] = [];
    const effects: TimelineItem[] = [];

    let currentTime = 0;
    let lastVisualIndex = -1;
    const isLastScene = (index: number) => index === story.scenes.length - 1;

    for (let sceneIndex = 0; sceneIndex < story.scenes.length; sceneIndex++) {
      const scene = story.scenes[sceneIndex];
      let resolvedAudioDuration = scene.audioDuration ?? scene.duration ?? 0;
      const captionDuration = getCaptionDuration(scene);

      const narrationDuration = Math.max(resolvedAudioDuration, captionDuration);
      const isLast = isLastScene(sceneIndex);
      const effectiveSceneDuration = computeSceneDuration(scene, isLast);

      const sceneStart = currentTime;
      const sceneEnd = sceneStart + effectiveSceneDuration;

      // Get composer metadata for this scene
      const composer = (scene as any).composer;
      const sceneType = composer?.sceneType;

      /* ---------------- Visual Track ---------------- */
      // Three cases:
      // 1. AI-generated video (generatedVideoUrl) — avatar lip-sync (intro/outro) or product animation (physical demo)
      // 2. User-uploaded media (sourceMediaUrl) — screen recording, product photo, product video
      // 3. AI-generated image (generatedImageUrl) — fallback, rare in AI UGC Ads
      if (scene.generatedVideoUrl) {
        // AI-generated video — avatar lip-sync or product animation
        // System rule: avatar videos never play embedded audio (TTS voiceover handles it)
        // User rule: product animation can opt-in via enableImmersiveAudio
        const avatarBehavior = (scene as any)?.composer?.classification?.avatarBehavior;
        const isAvatarVideo = avatarBehavior === 'avatar-holds-product';
        const playEmbeddedAudio = !isAvatarVideo && (videoConfig as any).enableImmersiveAudio === true;
        const hasVoiceover = Boolean(scene.audioUrl && resolvedAudioDuration > 0);
        const videoVolume = playEmbeddedAudio
          ? (hasVoiceover ? 0.25 : 1)
          : undefined;

        visual.push({
          start: sceneStart,
          end: sceneEnd,
          payload: {
            type: 'video',
            url: scene.generatedVideoUrl,
            prompt: scene.imagePrompt ?? null,
            sceneNumber: scene.sceneNumber,
            playEmbeddedAudio,
            ...(playEmbeddedAudio && { videoVolume }),
          },
        });
        lastVisualIndex = visual.length - 1;
      } else if ((scene as any).sourceMediaUrl) {
        // User-uploaded media — screen recording, product photo, product video
        const showcaseItem = composer?.showcaseItem;
        const isVideoItem = showcaseItem?.type === 'video';
        const videoStrategy = composer?.displayPipeline?.videoStrategy;
        const videoAspectRatio = composer?.displayPipeline?.videoAspectRatio;

        visual.push({
          start: sceneStart,
          end: sceneEnd,
          payload: {
            type: isVideoItem ? 'video' : 'image',
            url: (scene as any).sourceMediaUrl,
            prompt: scene.imagePrompt ?? null,
            sceneNumber: scene.sceneNumber,
            // Video-specific options for luxury-fullscreen strategy
            ...(isVideoItem && {
              playEmbeddedAudio: videoStrategy === 'luxury-fullscreen',
              videoVolume: videoStrategy === 'luxury-fullscreen' ? 0.25 : undefined,
              aspectRatio: videoAspectRatio || videoConfig.aspectRatio || '9:16',
            }),
          },
        });
        lastVisualIndex = visual.length - 1;
      } else if (scene.generatedImageUrl || scene.imagePrompt) {
        // AI-generated image — fallback for image-only workflows
        visual.push({
          start: sceneStart,
          end: sceneEnd,
          payload: {
            type: 'image',
            url: scene.generatedImageUrl ?? null,
            prompt: scene.imagePrompt ?? null,
            sceneNumber: scene.sceneNumber,
          },
        });
        lastVisualIndex = visual.length - 1;
      }

      /* ---------------- Voiceover Track ---------------- */
      if (scene.audioUrl && resolvedAudioDuration > 0) {
        audio.push({
          start: sceneStart,
          end: sceneStart + resolvedAudioDuration,
          payload: {
            type: 'voiceover',
            url: scene.audioUrl,
            sceneNumber: scene.sceneNumber,
          },
        });
      }

      /* ---------------- Caption Track ---------------- */
      if (
        videoConfig.enableCaptions &&
        Array.isArray(scene.captions) &&
        scene.captions.length > 0 &&
        narrationDuration > 0
      ) {
        text.push({
          start: sceneStart,
          end: sceneStart + narrationDuration,
          payload: {
            type: 'caption',
            sceneNumber: scene.sceneNumber,
            stylePreset: videoConfig.captionStylePreset ?? null,
            captions: scene.captions,
          },
        });
      }

      currentTime = sceneEnd;
    }

    // Find actual audio end time
    const audioEndTime = audio.length > 0 
      ? Math.max(...audio.map(item => item.end)) 
      : 0;

    // Extend last visual if audio extends beyond scene duration
    if (lastVisualIndex >= 0 && audioEndTime > 0) {
      const lastVisual = visual[lastVisualIndex];
      if (audioEndTime > lastVisual.end) {
        lastVisual.end = audioEndTime;
      }
    }

    const finalDuration = Math.max(
      currentTime,
      audioEndTime,
      ...visual.map(v => v.end)
    );

    /* ---------------- Background Music (full duration) ---------------- */
    const musicUrl =
      typeof videoConfig.music === 'string' ? videoConfig.music.trim() : '';
    if (musicUrl && musicUrl !== 'none' && finalDuration > 0) {
      const rawVolume = videoConfig.musicVolume ?? DEFAULT_MUSIC_VOLUME;
      const volume =
        rawVolume > 1 ? Math.min(1, rawVolume / 100) : Math.max(0, Math.min(1, rawVolume));
      audio.push({
        start: 0,
        end: finalDuration,
        payload: {
          type: 'background-music',
          role: 'background',
          url: musicUrl,
          volume,
        },
      });
    }

    /* ---------------- Watermark Effect ---------------- */
    if (videoConfig.watermark?.show === true) {
      effects.push({
        start: 0,
        end: finalDuration,
        payload: {
          type: 'watermark',
          text: videoConfig.watermark.text ?? '',
          variant: videoConfig.watermark.variant ?? 'minimal',
        },
      });
    }

    return {
      duration: Math.round(finalDuration),
      tracks: {
        visual,
        audio,
        text,
        effects: effects.length > 0 ? effects : undefined,
      },
    };
  }
}
