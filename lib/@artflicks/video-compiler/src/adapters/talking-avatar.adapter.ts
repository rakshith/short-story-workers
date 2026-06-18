// Talking Avatar adapter — single-scene video where the video's embedded audio IS the voiceover.
// The FAL/Kling video has lip-synced speech baked in, so no separate voiceover track is needed.
// Captions sync to the video duration (audioDuration), not a separate audio file.
import {
  StoryAdapter,
  Story,
  VideoConfig,
  Timeline,
  TimelineItem,
} from '../types';

const MIN_SCENE_DURATION = 0.1;
const DUCKED_MUSIC_VOLUME = 0.25;

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

export class TalkingAvatarAdapter implements StoryAdapter {
  supports(story: any, videoConfig?: VideoConfig): boolean {
    return (
      videoConfig?.enableAvatarAudio === true &&
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

    let currentTime = 0;
    let lastVisualIndex = -1;
    const isLastScene = (index: number) => index === story.scenes.length - 1;

    for (let sceneIndex = 0; sceneIndex < story.scenes.length; sceneIndex++) {
      const scene = story.scenes[sceneIndex];
      const sceneDuration = scene.duration ?? 0;
      const resolvedAudioDuration = scene.audioDuration ?? scene.duration ?? 0;
      const captionDuration = getCaptionDuration(scene);
      const narrationDuration = Math.max(resolvedAudioDuration, captionDuration);

      const isLast = isLastScene(sceneIndex);
      const effectiveSceneDuration = Math.max(
        sceneDuration,
        narrationDuration > 0 && !isLast ? narrationDuration : narrationDuration,
        MIN_SCENE_DURATION
      );

      const sceneStart = currentTime;
      const sceneEnd = sceneStart + effectiveSceneDuration;

      /* ---------------- Visual Track ---------------- */
      if (scene.generatedVideoUrl) {
        visual.push({
          start: sceneStart,
          end: sceneEnd,
          payload: {
            type: 'video',
            url: scene.generatedVideoUrl,
            prompt: scene.imagePrompt ?? null,
            sceneNumber: scene.sceneNumber,
            playEmbeddedAudio: true,
            videoVolume: 1,
          },
        });
        lastVisualIndex = visual.length - 1;
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
        lastVisualIndex = visual.length - 1;
      }

      // NO voiceover track — the video's embedded audio handles speech

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
      ...visual.map(v => v.end)
    );

    /* ---------------- Background Music (full duration, ducked) ---------------- */
    const musicUrl =
      typeof videoConfig.music === 'string' ? videoConfig.music.trim() : '';
    if (musicUrl && musicUrl !== 'none' && finalDuration > 0) {
      const rawVolume = videoConfig.musicVolume ?? 0.2;
      const volume =
        rawVolume > 1 ? Math.min(1, rawVolume / 100) : Math.max(0, Math.min(1, rawVolume));
      const musicVolume = Math.min(volume, DUCKED_MUSIC_VOLUME);
      audio.push({
        start: 0,
        end: finalDuration,
        payload: {
          type: 'background-music',
          role: 'background',
          url: musicUrl,
          volume: musicVolume,
        },
      });
    }

    return {
      duration: Math.round(finalDuration),
      tracks: {
        visual,
        audio,
        text,
      },
    };
  }
}
