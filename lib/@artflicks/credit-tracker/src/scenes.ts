/**
 * Scene calculation functions
 * Convert video duration to number of scenes/clips
 *
 * IMAGE scene counts are sourced from @artflicks/script-generator-templates
 * (IMAGE_SCENE_COUNTS) — single source of truth. Do NOT hardcode here.
 */

import { IMAGE_SCENE_COUNTS, VIDEO_SCENE_COUNT_GUIDE } from '@artflicks/script-generator-templates';

/**
 * Returns the estimated number of AI-image scenes for a given duration.
 * Reads from IMAGE_SCENE_COUNTS (single source of truth).
 * Falls back to ~5 s per scene for durations not in the lookup table.
 */
export function imageScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds in IMAGE_SCENE_COUNTS) {
    return IMAGE_SCENE_COUNTS[durationSeconds];
  }
  return Math.max(3, Math.ceil(durationSeconds / 5));
}

/**
 * Derives the estimated number of AI-video clips from a video duration.
 * Uses VIDEO_SCENE_COUNT_GUIDE targets from script-generator-templates
 * (single source of truth). Falls back to ~1 scene per 5s for durations not in the table.
 */
export function videoScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds in VIDEO_SCENE_COUNT_GUIDE) {
    return VIDEO_SCENE_COUNT_GUIDE[durationSeconds].target;
  }
  return Math.ceil(durationSeconds / 5);
}

/**
 * Calculate scene count based on media type
 */
export function getSceneCount(duration: number, mediaType: 'ai-images' | 'ai-videos'): number {
  return mediaType === 'ai-videos'
    ? videoScenesFromDuration(duration)
    : imageScenesFromDuration(duration);
}
