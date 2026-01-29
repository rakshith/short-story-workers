// Scene adapter for stories with scenes array
import {
  StoryAdapter,
  Story,
  VideoConfig,
  Timeline,
  TimelineItem,
} from '../types';

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
        resolvedAudioDuration > 0
      ) {
        text.push({
          start: sceneStart,
          end: sceneStart + resolvedAudioDuration,
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
        audio, // voiceovers ONLY
        text,
        effects: effects.length > 0 ? effects : undefined,
      },
    };
  }
}
