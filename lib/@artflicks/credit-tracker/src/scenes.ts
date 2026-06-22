/**
 * Scene calculation functions
 * Convert video duration to number of scenes/clips
 *
 * IMAGE scene counts are sourced from @artflicks/script-generator-templates
 * (IMAGE_SCENE_COUNTS) — single source of truth. Do NOT hardcode here.
 */

import { IMAGE_SCENE_COUNTS } from '@artflicks/script-generator-templates';

/**
 * Returns the estimated number of AI-image scenes for a given duration.
 * Reads from IMAGE_SCENE_COUNTS (single source of truth).
 * Falls back to ~5 s per scene for durations not in the lookup table.
 */
export function imageScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds in IMAGE_SCENE_COUNTS) {
    return IMAGE_SCENE_COUNTS[durationSeconds];
  }
  return Math.ceil(durationSeconds / 5);
}

/**
 * Derives the estimated number of AI-video clips from a video duration.
 * Each AI video clip is ~10 s, so scene count scales linearly with duration.
 * Coverage: up to 300 s (5 min).
 */
export function videoScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds <= 15)  return 3;  // ~5 s each
  if (durationSeconds <= 30)  return 5;  // ~6 s each
  if (durationSeconds <= 60)  return 8;  // ~7.5 s each
  if (durationSeconds <= 120) return 12; // ~10 s each
  if (durationSeconds <= 180) return 18; // ~10 s each (3 min)
  if (durationSeconds <= 240) return 24; // ~10 s each (4 min)
  if (durationSeconds <= 300) return 30; // ~10 s each (5 min)
  return Math.ceil(durationSeconds / 10); // beyond 5 min: ~10 s per clip
}

/**
 * Calculate scene count based on media type
 */
export function getSceneCount(duration: number, mediaType: 'ai-images' | 'ai-videos'): number {
  return mediaType === 'ai-videos'
    ? videoScenesFromDuration(duration)
    : imageScenesFromDuration(duration);
}
