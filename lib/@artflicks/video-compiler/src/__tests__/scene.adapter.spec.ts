/**
 * Spec: Timeline background music
 * Executes the scenarios from openspec/changes/fix-video-background-music/specs/timeline-background-music/spec.md
 */

import { compile } from '../compile';
import type { Story, VideoConfig } from '../types';

const MUSIC_URL = 'https://assets.example.com/music.mp3';

function findBackgroundMusicItem(timeline: ReturnType<typeof compile>) {
  return timeline.tracks.audio.find(
    (item) =>
      item.payload?.role === 'background' ||
      item.payload?.type === 'background-music'
  );
}

// --- Scenario: video config has music + visual track has video items ---
function scenarioVideoWithMusic() {
  const story: Story = {
    scenes: [
      {
        sceneNumber: 1,
        duration: 5,
        generatedVideoUrl: 'https://example.com/video.mp4',
        imagePrompt: 'a scene',
      },
    ],
    totalDuration: 5,
  };
  const videoConfig: VideoConfig = { music: MUSIC_URL, musicVolume: 0.5 };
  const timeline = compile({ story, videoConfig });

  const bg = findBackgroundMusicItem(timeline);
  if (!bg) throw new Error('Expected one background music item in tracks.audio');
  if (bg.start !== 0 || bg.end !== timeline.duration)
    throw new Error('Background music must span full duration (start: 0, end: timeline.duration)');
  const url = bg.payload?.url ?? bg.payload?.src ?? bg.payload?.audioUrl;
  if (!url || url !== MUSIC_URL)
    throw new Error('Background music item must have music URL in payload');
  console.log('✓ Scenario: timeline has background music when video config has music and visual track has video items');
}

// --- Scenario: video config has music + visual track has only image items ---
function scenarioImageOnlyWithMusic() {
  const story: Story = {
    scenes: [
      {
        sceneNumber: 1,
        duration: 5,
        generatedImageUrl: 'https://example.com/image.jpg',
        imagePrompt: 'a scene',
      },
    ],
    totalDuration: 5,
  };
  const videoConfig: VideoConfig = { music: MUSIC_URL };
  const timeline = compile({ story, videoConfig });

  const bg = findBackgroundMusicItem(timeline);
  if (!bg) throw new Error('Expected one background music item in tracks.audio');
  if (bg.start !== 0 || bg.end !== timeline.duration)
    throw new Error('Background music must span full duration');
  console.log('✓ Scenario: timeline has background music when video config has music and visual track has only image items');
}

// --- Scenario: no background music when music is not configured ---
function scenarioNoMusicWhenNotConfigured() {
  const story: Story = {
    scenes: [
      {
        sceneNumber: 1,
        duration: 5,
        generatedImageUrl: 'https://example.com/image.jpg',
        imagePrompt: 'a scene',
      },
    ],
    totalDuration: 5,
  };

  const withEmpty = compile({ story, videoConfig: { music: '' } });
  if (findBackgroundMusicItem(withEmpty))
    throw new Error('Expected no background music item when music is empty');

  const withNone = compile({ story, videoConfig: { music: 'none' } });
  if (findBackgroundMusicItem(withNone))
    throw new Error('Expected no background music item when music is "none"');

  const withMissing = compile({ story, videoConfig: {} });
  if (findBackgroundMusicItem(withMissing))
    throw new Error('Expected no background music item when music is missing');

  console.log('✓ Scenario: no background music item when music is not configured');
}

// --- Scenario: background music item includes volume in payload ---
function scenarioVolumeInPayload() {
  const story: Story = {
    scenes: [
      {
        sceneNumber: 1,
        duration: 5,
        generatedImageUrl: 'https://example.com/image.jpg',
        imagePrompt: 'a scene',
      },
    ],
    totalDuration: 5,
  };
  const videoConfig: VideoConfig = { music: MUSIC_URL, musicVolume: 0.7 };
  const timeline = compile({ story, videoConfig });

  const bg = findBackgroundMusicItem(timeline);
  if (!bg) throw new Error('Expected one background music item');
  const vol = bg.payload?.volume;
  if (typeof vol !== 'number' || vol < 0 || vol > 1)
    throw new Error('Background music item should include volume (0–1) in payload');
  if (Math.abs(vol - 0.7) > 0.01) throw new Error('Volume should be 0.7');
  console.log('✓ Scenario: background music item includes volume in payload');
}

// Run all spec scenarios
function run() {
  scenarioVideoWithMusic();
  scenarioImageOnlyWithMusic();
  scenarioNoMusicWhenNotConfigured();
  scenarioVolumeInPayload();
  console.log('\nAll spec scenarios passed.');
}

run();
