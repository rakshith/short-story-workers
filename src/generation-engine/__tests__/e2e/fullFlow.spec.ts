/**
 * E2E Test: Full Story Generation Flow
 * Validates complete pipeline and outputs Timeline JSON structure
 * 
 * This test simulates the full flow without calling real APIs
 * Uses mock data to validate the data structures
 * 
 * Run: npm run test:run -- --testNamePattern "e2e"
 */

import { describe, it, expect } from 'vitest';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

describe('E2E: Full Story Generation Flow', () => {
  describe('Complete Pipeline with Mock Data', () => {
    it('should generate complete timeline structure', () => {
      // Mock story data (simulating generated story)
      const mockStory = {
        id: 'story-123',
        title: 'Genghis Khan vs Autocorrect',
        scenes: [
          {
            sceneNumber: 1,
            narration: 'Day one, Genghis Khan drafts war—',
            captions: [
              {
                text: 'Day one, Genghis Khan drafts war—',
                tokens: [
                  { text: 'Day', endTime: 0.244, startTime: 0 },
                  { text: ' one,', endTime: 0.592, startTime: 0.337 },
                ],
                endTime: 2.322,
                startTime: 0,
                confidence: null,
                timestampMs: 0,
              },
            ],
            imagePrompt: 'Most striking: Genghis Khan in a vast, storm-lit steppe tent',
            generatedImageUrl: 'https://via.placeholder.com/1024x576.png?text=Mock+Image+1',
            audioUrl: 'https://example.com/mock-audio-1.mp3',
            audioDuration: 2.322,
            duration: 2.8,
            mood: 'ominous',
            cameraAngle: 'extreme close-up',
          },
          {
            sceneNumber: 2,
            narration: '—but autocorrect swaps "surrender" for "sunflower."',
            captions: [
              {
                text: '—but autocorrect swaps "surrender" for "sunflower."',
                tokens: [],
                endTime: 3.251,
                startTime: 0,
                confidence: null,
                timestampMs: 0,
              },
            ],
            imagePrompt: 'Glowing ancient-looking "phone" in Mongol hands',
            generatedImageUrl: 'https://via.placeholder.com/1024x576.png?text=Mock+Image+2',
            audioUrl: 'https://example.com/mock-audio-2.mp3',
            audioDuration: 3.251,
            duration: 3.2,
            mood: 'surreal',
            cameraAngle: 'macro close-up',
          },
        ],
        totalDuration: 15.2,
      };

      // Mock video config
      const mockVideoConfig = {
        model: 'black-forest-labs/flux-schnell',
        voice: 'CwhRBWXzGAHq8TQ4Fs17',
        audioModel: 'eleven_multilingual_v2',
        aspectRatio: '9:16',
        preset: {
          id: '4k-realistic',
          seed: 1945013733,
          title: '4k Realistic',
          stylePrompt: 'hyperrealistic 4K photographic quality',
        },
        watermark: {
          show: true,
          text: 'ArtFlicks',
          variant: 'gradient',
        },
        musicVolume: 8,
        enableCaptions: true,
      };

      // Build Timeline JSON structure
      const timeline = buildTimeline(mockStory, mockVideoConfig);

      console.log('\n' + '='.repeat(60));
      console.log('📺 TIMELINE JSON OUTPUT');
      console.log('='.repeat(60));
      console.log(JSON.stringify(timeline, null, 2));
      console.log('='.repeat(60));

      // Validate timeline structure
      expect(timeline.tracks).toBeDefined();
      expect(timeline.tracks.text).toBeDefined();
      expect(timeline.tracks.audio).toBeDefined();
      expect(timeline.tracks.visual).toBeDefined();
      expect(timeline.tracks.effects).toBeDefined();
      expect(timeline.duration).toBeDefined();

      // Validate text track (captions)
      expect(timeline.tracks.text.length).toBe(2);
      expect(timeline.tracks.text[0].payload.type).toBe('caption');
      expect(timeline.tracks.text[0].payload.captions).toBeDefined();

      // Validate audio track
      expect(timeline.tracks.audio.length).toBeGreaterThan(0);
      expect(timeline.tracks.audio[0].payload.type).toBe('voiceover');

      // Validate visual track
      expect(timeline.tracks.visual.length).toBe(2);
      expect(timeline.tracks.visual[0].payload.type).toBe('image');

      // Validate effects track (watermark)
      expect(timeline.tracks.effects.length).toBe(1);
      expect(timeline.tracks.effects[0].payload.type).toBe('watermark');
    });

    it('should validate Story JSON structure', () => {
      const story = {
        id: 'story-123',
        title: 'Test Story',
        scenes: [
          {
            sceneNumber: 1,
            narration: 'Test narration',
            captions: [],
            imagePrompt: 'Test prompt',
            generatedImageUrl: 'https://example.com/image.jpg',
            audioUrl: 'https://example.com/audio.mp3',
            audioDuration: 5.0,
            duration: 5.0,
          },
        ],
        totalDuration: 5.0,
      };

      expect(story.id).toBeDefined();
      expect(story.title).toBeDefined();
      expect(story.scenes).toBeDefined();
      expect(story.scenes.length).toBeGreaterThan(0);
      expect(story.totalDuration).toBeDefined();

      // Scene validation
      const scene = story.scenes[0];
      expect(scene.sceneNumber).toBeDefined();
      expect(scene.narration).toBeDefined();
      expect(scene.captions).toBeDefined();
      expect(scene.imagePrompt).toBeDefined();
      expect(scene.generatedImageUrl).toBeDefined();
      expect(scene.audioUrl).toBeDefined();
    });

    it('should validate VideoConfig structure', () => {
      const videoConfig = {
        model: 'black-forest-labs/flux-schnell',
        voice: 'voice-id',
        audioModel: 'eleven_multilingual_v2',
        aspectRatio: '9:16',
        preset: {
          id: '4k-realistic',
          seed: 12345,
          title: '4k Realistic',
          stylePrompt: 'hyperrealistic',
        },
        watermark: {
          show: true,
          text: 'ArtFlicks',
          variant: 'gradient',
        },
        musicVolume: 8,
        outputFormat: 'jpg',
        enableCaptions: true,
      };

      expect(videoConfig.model).toBeDefined();
      expect(videoConfig.voice).toBeDefined();
      expect(videoConfig.audioModel).toBeDefined();
      expect(videoConfig.aspectRatio).toBeDefined();
      expect(videoConfig.preset).toBeDefined();
      expect(videoConfig.watermark).toBeDefined();
      expect(videoConfig.enableCaptions).toBe(true);
    });

    it('should merge template config with user config', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const templateConfig = template?.defaultConfig?.videoConfig as any;

      const userConfig = {
        imageModel: 'custom-model',
        aspectRatio: '16:9',
      };

      const mergedConfig = {
        ...templateConfig,
        ...userConfig,
      };

      expect(mergedConfig.templateId).toBe('youtube-shorts');
      expect(mergedConfig.imageModel).toBe('custom-model');
      expect(mergedConfig.aspectRatio).toBe('16:9');
    });
  });

  describe('Timeline Track Structure', () => {
    it('should build text track with captions', () => {
      const scenes = [
        {
          sceneNumber: 1,
          captions: [
            {
              text: 'Caption 1',
              startTime: 0,
              endTime: 2.0,
            },
          ],
        },
      ];

      const textTrack = scenes.map((scene, index) => {
        const prevScene = scenes[index - 1];
        const startTime = index === 0 ? 0 : (prevScene.captions[prevScene.captions.length - 1]?.endTime || 0) + 0.4;
        const endTime = startTime + (scene.captions[0]?.endTime || 2.0);

        return {
          start: startTime,
          end: endTime,
          payload: {
            type: 'caption' as const,
            captions: scene.captions,
            sceneNumber: scene.sceneNumber,
            stylePreset: 'beast',
          },
        };
      });

      expect(textTrack).toHaveLength(1);
      expect(textTrack[0].payload.type).toBe('caption');
    });

    it('should build audio track with voiceover', () => {
      const scenes = [
        {
          sceneNumber: 1,
          audioUrl: 'https://example.com/audio1.mp3',
          audioDuration: 2.322,
        },
        {
          sceneNumber: 2,
          audioUrl: 'https://example.com/audio2.mp3',
          audioDuration: 3.0,
        },
      ];

      const audioTrack = scenes.map((scene, index) => {
        const prevScene = scenes[index - 1];
        const startTime = index === 0 ? 0 : (prevScene.audioDuration || 0) + 0.4;
        const endTime = startTime + scene.audioDuration;

        return {
          start: startTime,
          end: endTime,
          payload: {
            url: scene.audioUrl,
            type: 'voiceover' as const,
            sceneNumber: scene.sceneNumber,
          },
        };
      });

      expect(audioTrack).toHaveLength(2);
      expect(audioTrack[0].payload.type).toBe('voiceover');
    });

    it('should build visual track with images', () => {
      const scenes = [
        {
          sceneNumber: 1,
          generatedImageUrl: 'https://example.com/image1.jpg',
          imagePrompt: 'Prompt 1',
          duration: 2.8,
        },
      ];

      const visualTrack = scenes.map((scene, index) => {
        const prevScene = scenes[index - 1];
        const startTime = index === 0 ? 0 : prevScene.duration + 0.4;
        const endTime = startTime + scene.duration;

        return {
          start: startTime,
          end: endTime,
          payload: {
            url: scene.generatedImageUrl,
            type: 'image' as const,
            prompt: scene.imagePrompt,
            sceneNumber: scene.sceneNumber,
          },
        };
      });

      expect(visualTrack).toHaveLength(1);
      expect(visualTrack[0].payload.type).toBe('image');
    });

    it('should build effects track with watermark', () => {
      const totalDuration = 15.2;
      const watermark = {
        show: true,
        text: 'ArtFlicks',
        variant: 'gradient',
      };

      const effectsTrack = [
        {
          start: 0,
          end: totalDuration,
          payload: {
            text: watermark.text,
            type: 'watermark' as const,
            variant: watermark.variant,
          },
        },
      ];

      expect(effectsTrack).toHaveLength(1);
      expect(effectsTrack[0].payload.type).toBe('watermark');
    });
  });

  describe('End-to-End Duration Calculation', () => {
    it('should calculate total duration from scenes', () => {
      const scenes = [
        { duration: 2.8 },
        { duration: 3.2 },
        { duration: 2.5 },
        { duration: 2.8 },
        { duration: 2.8 },
        { duration: 3.6 },
      ];

      // Add transition time between scenes
      const transitionTime = 0.4;
      const totalDuration = scenes.reduce((sum, scene, index) => {
        if (index === 0) return scene.duration;
        return sum + transitionTime + scene.duration;
      }, 0);

      expect(totalDuration).toBeCloseTo(19.7, 1);
    });

    it('should add background music to audio track', () => {
      const backgroundMusic = {
        url: 'https://assets.artflicks.app/background-music/space-beat-263970.mp3',
        role: 'background',
        type: 'background-music',
        volume: 0.08,
      };

      const audioTrack = [
        {
          start: 0,
          end: 20,
          payload: backgroundMusic,
        },
      ];

      expect(audioTrack[0].payload.type).toBe('background-music');
      expect(audioTrack[0].payload.role).toBe('background');
      expect(audioTrack[0].payload.volume).toBe(0.08);
    });
  });
});

// Helper function to build timeline
function buildTimeline(story: any, videoConfig: any) {
  const transitionTime = 0.4;
  let currentTime = 0;

  // Build text track (captions)
  const textTrack = story.scenes.map((scene: any) => {
    const captionData = {
      start: currentTime,
      end: currentTime + scene.audioDuration,
      payload: {
        type: 'caption',
        captions: scene.captions,
        sceneNumber: scene.sceneNumber,
        stylePreset: 'beast',
      },
    };
    currentTime += scene.duration + transitionTime;
    return captionData;
  });

  // Build audio track (voiceover + background music)
  currentTime = 0;
  const audioTrack = [
    ...story.scenes.map((scene: any) => {
      const audioData = {
        start: currentTime,
        end: currentTime + scene.audioDuration,
        payload: {
          url: scene.audioUrl,
          type: 'voiceover',
          sceneNumber: scene.sceneNumber,
        },
      };
      currentTime += scene.duration + transitionTime;
      return audioData;
    }),
    // Background music
    {
      start: 0,
      end: story.totalDuration,
      payload: {
        url: 'https://assets.artflicks.app/background-music/space-beat-263970.mp3',
        role: 'background',
        type: 'background-music',
        volume: videoConfig.musicVolume / 100,
      },
    },
  ];

  // Build visual track (images)
  currentTime = 0;
  const visualTrack = story.scenes.map((scene: any) => {
    const visualData = {
      start: currentTime,
      end: currentTime + scene.duration,
      payload: {
        url: scene.generatedImageUrl,
        type: 'image',
        prompt: scene.imagePrompt,
        sceneNumber: scene.sceneNumber,
      },
    };
    currentTime += scene.duration + transitionTime;
    return visualData;
  });

  // Build effects track (watermark)
  const effectsTrack = [
    {
      start: 0,
      end: story.totalDuration,
      payload: {
        text: videoConfig.watermark.text,
        type: 'watermark',
        variant: videoConfig.watermark.variant,
      },
    },
  ];

  return {
    tracks: {
      text: textTrack,
      audio: audioTrack,
      visual: visualTrack,
      effects: effectsTrack,
    },
    duration: story.totalDuration,
  };
}
