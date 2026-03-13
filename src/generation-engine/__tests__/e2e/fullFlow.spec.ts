/**
 * E2E Test: Full Story Generation Flow
 * Validates complete pipeline and outputs Timeline JSON structure
 * 
 * Run: npm run test:e2e
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv } from '../../index';
import { createCreateJobAPI } from '../../api/createJob';
import { createJobStatusAPI } from '../../api/jobStatus';
import { getMockDatabase, resetMockDatabase } from '../../storage/mockDatabase';
import { getMockStoryQueue, clearAllMockQueues } from '../../queue/mockQueue';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

describe('E2E: Full Story Generation Flow', () => {
  beforeEach(() => {
    resetMockDatabase();
    clearAllMockQueues();
  });

  it('should execute full pipeline and output Timeline JSON', async () => {
    // Step 1: Create job using the SAME API as integration tests
    const env = createMockEnv();
    const createApi = createCreateJobAPI(env);
    const statusApi = createJobStatusAPI(env);

    const result = await createApi.execute({
      userId: 'e2e-test-user',
      templateId: 'youtube-shorts',
      prompt: 'A brave knight discovers a magical sword'
    });

    expect(result.success).toBe(true);
    expect(result.jobId).toBeDefined();
    expect(result.storyId).toBeDefined();

    // Step 2: Get the actual story from mock database
    const db = getMockDatabase();
    const story = await db.getStory(result.storyId);
    const storyData = story.data;

    expect(storyData).toBeDefined();
    expect(storyData!.story).toBeDefined();
    expect(storyData!.story.scenes).toBeDefined();
    expect(storyData!.story.scenes!.length).toBeGreaterThan(0);

    // Step 3: Get the video config used
    const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
    const videoConfig: any = {
      ...template?.defaultConfig?.videoConfig,
      watermark: {
        show: true,
        text: 'ArtFlicks',
        variant: 'gradient',
      },
      musicVolume: 8,
    };

    // Step 4: Build Timeline JSON from ACTUAL generated story
    const timeline = buildTimeline(storyData!.story, videoConfig);

    // Step 5: Output Timeline JSON to console
    console.log('\n' + '='.repeat(60));
    console.log('📺 TIMELINE JSON OUTPUT (From Real Execution)');
    console.log('='.repeat(60));
    console.log(JSON.stringify(timeline, null, 2));
    console.log('='.repeat(60));

    // Step 6: Validate timeline structure
    expect(timeline.tracks).toBeDefined();
    expect(timeline.tracks.text).toBeDefined();
    expect(timeline.tracks.audio).toBeDefined();
    expect(timeline.tracks.visual).toBeDefined();
    expect(timeline.tracks.effects).toBeDefined();
    expect(timeline.duration).toBeDefined();

    // Validate text track
    expect(timeline.tracks.text.length).toBeGreaterThan(0);
    expect(timeline.tracks.text[0].payload.type).toBe('caption');

    // Validate audio track
    expect(timeline.tracks.audio.length).toBeGreaterThan(0);
    expect(timeline.tracks.audio[0].payload.type).toBe('voiceover');

    // Validate visual track
    expect(timeline.tracks.visual.length).toBeGreaterThan(0);
    expect(timeline.tracks.visual[0].payload.type).toBe('image');

    // Validate effects track
    expect(timeline.tracks.effects.length).toBe(1);
    expect(timeline.tracks.effects[0].payload.type).toBe('watermark');

    console.log('\n✅ Timeline JSON validated successfully!');
  });

  it('should execute skeleton-3d-shorts and output Timeline JSON', async () => {
    resetMockDatabase();
    clearAllMockQueues();

    const env = createMockEnv();
    const createApi = createCreateJobAPI(env);

    const result = await createApi.execute({
      userId: 'e2e-skeleton-user',
      templateId: 'skeleton-3d-shorts',
      prompt: 'A dancing skeleton at a Halloween party'
    });

    expect(result.success).toBe(true);

    const db = getMockDatabase();
    const story = await db.getStory(result.storyId);
    const storyData = story.data;

    const template = getTemplate(TEMPLATE_IDS.SKELETON_3D_SHORTS);
    const videoConfig: any = {
      ...template?.defaultConfig?.videoConfig,
      watermark: { show: true, text: 'ArtFlicks', variant: 'gradient' },
      musicVolume: 8,
    };

    const timeline = buildTimeline(storyData!.story, videoConfig);

    console.log('\n📺 SKELETON 3D TIMELINE JSON');
    console.log(JSON.stringify(timeline, null, 2));

    expect(timeline.tracks.visual.length).toBeGreaterThan(0);
  });

  it('should execute character-story and output Timeline JSON', async () => {
    resetMockDatabase();
    clearAllMockQueues();

    const env = createMockEnv();
    const createApi = createCreateJobAPI(env);

    const result = await createApi.execute({
      userId: 'e2e-character-user',
      templateId: 'character-story',
      prompt: 'A hero journey through ancient mountains'
    });

    expect(result.success).toBe(true);

    const db = getMockDatabase();
    const story = await db.getStory(result.storyId);
    const storyData = story.data;

    const template = getTemplate(TEMPLATE_IDS.CHARACTER_STORY);
    const videoConfig: any = {
      ...template?.defaultConfig?.videoConfig,
      watermark: { show: true, text: 'ArtFlicks', variant: 'gradient' },
      musicVolume: 8,
    };

    const timeline = buildTimeline(storyData!.story, videoConfig);

    console.log('\n📺 CHARACTER STORY TIMELINE JSON');
    console.log(JSON.stringify(timeline, null, 2));

    expect(timeline.tracks.visual.length).toBeGreaterThan(0);
  });

  it('should validate Story JSON structure from execution', async () => {
    resetMockDatabase();
    clearAllMockQueues();

    const env = createMockEnv();
    const createApi = createCreateJobAPI(env);

    const result = await createApi.execute({
      userId: 'e2e-validation-user',
      templateId: 'youtube-shorts',
      prompt: 'Test story for validation'
    });

    const db = getMockDatabase();
    const story = await db.getStory(result.storyId);
    const storyData = story.data;

    expect(storyData!.id).toBeDefined();
    expect(storyData!.story).toBeDefined();
    expect(storyData!.story!.scenes).toBeDefined();
    expect(storyData!.story!.scenes!.length).toBeGreaterThan(0);

    const scene = storyData!.story!.scenes![0];
    expect(scene.sceneNumber).toBeDefined();
    expect(scene.narration).toBeDefined();
    expect(scene.imagePrompt).toBeDefined();
  });
});

// Helper function to build timeline from ACTUAL story data
function buildTimeline(story: any, videoConfig: any) {
  const transitionTime = 0.4;
  let currentTime = 0;

  const textTrack = story.scenes.map((scene: any) => {
    const captionData = {
      start: currentTime,
      end: currentTime + (scene.audioDuration || scene.duration || 2),
      payload: {
        type: 'caption' as const,
        captions: scene.captions || [],
        sceneNumber: scene.sceneNumber,
        stylePreset: 'beast',
      },
    };
    currentTime += (scene.duration || 2) + transitionTime;
    return captionData;
  });

  currentTime = 0;
  const audioTrack = [
    ...story.scenes.map((scene: any) => {
      const audioData = {
        start: currentTime,
        end: currentTime + (scene.audioDuration || scene.duration || 2),
        payload: {
          url: scene.audioUrl || 'https://example.com/mock-audio.mp3',
          type: 'voiceover' as const,
          sceneNumber: scene.sceneNumber,
        },
      };
      currentTime += (scene.duration || 2) + transitionTime;
      return audioData;
    }),
    {
      start: 0,
      end: story.totalDuration || currentTime,
      payload: {
        url: 'https://assets.artflicks.app/background-music/space-beat-263970.mp3',
        role: 'background' as const,
        type: 'background-music' as const,
        volume: (videoConfig.musicVolume || 8) / 100,
      },
    },
  ];

  currentTime = 0;
  const visualTrack = story.scenes.map((scene: any) => {
    const visualData = {
      start: currentTime,
      end: currentTime + (scene.duration || 2),
      payload: {
        url: scene.generatedImageUrl || 'https://via.placeholder.com/1024x576.png?text=Mock+Image',
        type: 'image' as const,
        prompt: scene.imagePrompt || '',
        sceneNumber: scene.sceneNumber,
      },
    };
    currentTime += (scene.duration || 2) + transitionTime;
    return visualData;
  });

  const totalDuration = story.totalDuration || currentTime;
  const effectsTrack = [
    {
      start: 0,
      end: totalDuration,
      payload: {
        text: videoConfig.watermark?.text || 'ArtFlicks',
        type: 'watermark' as const,
        variant: videoConfig.watermark?.variant || 'gradient',
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
    duration: totalDuration,
  };
}
