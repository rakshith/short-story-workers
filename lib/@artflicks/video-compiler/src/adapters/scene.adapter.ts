// Scene adapter for stories with scenes array
import {
  StoryAdapter,
  Story,
  VideoConfig,
  Timeline,
  TimelineItem,
} from '../types';

const MIN_SCENE_DURATION = 0.1; // prevents zero-length scenes
const TRANSITION_BUFFER = 0.2; // small gap so next scene does not cut active narration/caption

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

export class SceneAdapter implements StoryAdapter {
  supports(story: any): boolean {
    return (
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

    for (const scene of story.scenes) {
      const sceneDuration = scene.duration ?? 0;
      const visualDuration = sceneDuration;
      let resolvedAudioDuration = scene.audioDuration ?? scene.duration ?? 0;
      const captionDuration = getCaptionDuration(scene);

      // For video clips: keep both visual and audio within scene duration so clip stays in sync
      const isVideoScene = Boolean(scene.generatedVideoUrl);
      if (isVideoScene && sceneDuration > 0) {
        resolvedAudioDuration = Math.min(resolvedAudioDuration, sceneDuration);
      }

      // Scene should not advance until narration/captions have finished.
      const narrationDuration = Math.max(resolvedAudioDuration, captionDuration);
      let effectiveSceneDuration = Math.max(
        visualDuration,
        narrationDuration > 0 ? narrationDuration + TRANSITION_BUFFER : 0,
        MIN_SCENE_DURATION
      );
      if (isVideoScene && sceneDuration > 0) {
        // For generated video clips, preserve clip length and keep strict sync.
        effectiveSceneDuration = sceneDuration;
      }

      const sceneStart = currentTime;
      const sceneEnd = sceneStart + effectiveSceneDuration;

      /* ---------------- Visual Track ---------------- */
      if (scene.generatedVideoUrl) {
        // Video clip takes priority over still image
        visual.push({
          start: sceneStart,
          end: sceneEnd,
          payload: {
            type: 'video',
            url: scene.generatedVideoUrl,
            prompt: scene.imagePrompt ?? null,
            sceneNumber: scene.sceneNumber,
          },
        });
      } else if (scene.generatedImageUrl || scene.imagePrompt) {
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

    const finalDuration = Math.max(
      currentTime,
      story.totalDuration ?? 0
    );

    /* ---------------- Background Music (full duration) ---------------- */
    const musicUrl =
      typeof videoConfig.music === 'string' ? videoConfig.music.trim() : '';
    if (musicUrl && musicUrl !== 'none' && finalDuration > 0) {
      const rawVolume = videoConfig.musicVolume ?? 0.2;
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
      duration: finalDuration,
      tracks: {
        visual,
        audio, // voiceovers + optional background music
        text,
        effects: effects.length > 0 ? effects : undefined,
      },
    };
  }
}
