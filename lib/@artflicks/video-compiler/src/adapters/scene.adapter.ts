// Scene adapter for stories with scenes array
import { StoryAdapter, Story, VideoConfig, Timeline, TimelineItem } from '../types';

const MIN_SCENE_DURATION = 0.1; // prevents zero-length scenes

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
      const visualDuration = scene.duration ?? 0;
      const resolvedAudioDuration = scene.audioDuration ?? scene.duration ?? 0;

      // Scene must last long enough for visuals OR audio
      const effectiveSceneDuration = Math.max(
        visualDuration,
        resolvedAudioDuration,
        MIN_SCENE_DURATION
      );

      const sceneStart = currentTime;
      const sceneEnd = sceneStart + effectiveSceneDuration;

      /* ---------------- Visual Track ---------------- */
      if (scene.generatedImageUrl || scene.imagePrompt) {
        visual.push({
          start: sceneStart,
          end: sceneEnd,
          payload: {
            type: 'image',
            url: scene.generatedImageUrl || null,
            prompt: scene.imagePrompt || null,
            sceneNumber: scene.sceneNumber,
          },
        });
      }

      /* ---------------- Audio Track ---------------- */
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
        resolvedAudioDuration > 0
      ) {
        const captionEnd = Math.min(
          sceneStart + resolvedAudioDuration,
          sceneEnd
        );

        text.push({
          start: sceneStart,
          end: captionEnd,
          payload: {
            type: 'caption',
            sceneNumber: scene.sceneNumber,
            stylePreset: videoConfig.captionStylePreset || null,
            captions: scene.captions, // full token structure preserved
          },
        });
      }

      currentTime = sceneEnd;
    }

    // Timeline duration is the source of truth
    const finalDuration = Math.max(
      currentTime,
      story.totalDuration || 0
    );

    /* ---------------- Background Music ---------------- */
    if (videoConfig.music) {
      const musicVolume =
        videoConfig.musicVolume !== undefined
          ? Math.max(0, Math.min(1, videoConfig.musicVolume / 100))
          : 0.5;

      audio.push({
        start: 0,
        end: finalDuration,
        payload: {
          type: 'music',
          url: videoConfig.music,
          volume: musicVolume,
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
          text: videoConfig.watermark.text || '',
          variant: videoConfig.watermark.variant || 'minimal',
        },
      });
    }

    return {
      duration: finalDuration,
      tracks: {
        visual,
        audio,
        text,
        effects: effects.length > 0 ? effects : undefined,
      },
    };
  }
}
