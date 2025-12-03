import { Scene, AspectRatio } from '../types';

export const VIDEO_FPS = 30;
export const TRANSITION_DURATION_SECONDS = 0.3;

export function calculateTotalDuration(scenes: Scene[]): number {
  return scenes.reduce((acc, scene, idx) => {
    const sceneDuration = scene.duration || 5;
    const audioDuration = scene.audioDuration || 0;
    const isLastScene = idx === scenes.length - 1;
    
    const TRANSITION_DURATION_SECONDS = 0.3;
    const AUDIO_TAIL_SECONDS = 0.5;
    
    const bufferSeconds = isLastScene 
      ? 2.5
      : TRANSITION_DURATION_SECONDS + AUDIO_TAIL_SECONDS;
    
    const effectiveDuration = audioDuration > 0 
      ? Math.max(sceneDuration, audioDuration + bufferSeconds)
      : sceneDuration;
    
    return acc + effectiveDuration;
  }, 0);
}

export function calculateVideoDuration(
  scenes: Scene[],
  fps: number = VIDEO_FPS,
  transitionDurationSeconds: number = TRANSITION_DURATION_SECONDS
) {
  const totalDuration = calculateTotalDuration(scenes);
  const numberOfTransitions = Math.max(0, scenes.length - 1);
  const transitionOverlapSeconds = numberOfTransitions * transitionDurationSeconds;
  
  const actualDuration = Math.max(0, totalDuration - transitionOverlapSeconds);
  const durationInFrames = actualDuration > 0 ? Math.ceil(actualDuration * fps) : 300;

  return {
    totalDuration,
    actualDuration,
    durationInFrames,
    numberOfTransitions,
    transitionOverlapSeconds,
  };
}

export function getVideoRenderConfig(
  scenes: Scene[],
  aspectRatio: AspectRatio = '9:16',
  fps: number = VIDEO_FPS
) {
  const duration = calculateVideoDuration(scenes, fps);
  return {
    ...duration,
    aspectRatio,
    fps,
  };
}

