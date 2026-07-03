/**
 * Scene calculation functions
 * Convert video duration to number of scenes/clips
 *
 * IMAGE scene counts are sourced from @artflicks/script-generator-templates
 * (IMAGE_SCENE_COUNTS) — single source of truth. Do NOT hardcode here.
 *
 * Uses linear interpolation between known table entries for accurate
 * estimates at any duration. Results are floored (rounded down) so
 * the preview estimate is conservative — user may save credits.
 */

import { IMAGE_SCENE_COUNTS, VIDEO_SCENE_COUNT_GUIDE } from '@artflicks/script-generator-templates';

type TableEntry = [number, number];

function buildSortedEntries(table: Record<number, number>): TableEntry[] {
  return Object.entries(table)
    .map(([d, s]) => [Number(d), s] as TableEntry)
    .sort((a, b) => a[0] - b[0]);
}

function interpolateFromTable(entries: TableEntry[], duration: number): number {
  if (entries.length === 0) return Math.max(3, Math.ceil(duration / 5));

  const [minDur] = entries[0];
  const [maxDur] = entries[entries.length - 1];

  if (duration <= minDur) return entries[0][1];
  if (duration >= maxDur) return entries[entries.length - 1][1];

  for (let i = 0; i < entries.length - 1; i++) {
    const [d1, s1] = entries[i];
    const [d2, s2] = entries[i + 1];
    if (duration >= d1 && duration <= d2) {
      const ratio = (duration - d1) / (d2 - d1);
      return Math.floor(s1 + (s2 - s1) * ratio);
    }
  }

  return entries[entries.length - 1][1];
}

/**
 * Returns the estimated number of AI-image scenes for a given duration.
 * Reads from IMAGE_SCENE_COUNTS (single source of truth).
 * Interpolates between known entries for durations not in the table.
 * Result is floored (rounded down) — conservative estimate.
 */
export function imageScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds in IMAGE_SCENE_COUNTS) {
    return IMAGE_SCENE_COUNTS[durationSeconds];
  }
  return interpolateFromTable(buildSortedEntries(IMAGE_SCENE_COUNTS), durationSeconds);
}

/**
 * Derives the estimated number of AI-video clips from a video duration.
 * Uses VIDEO_SCENE_COUNT_GUIDE targets from script-generator-templates
 * (single source of truth). Interpolates between known entries.
 * Result is floored (rounded down) — conservative estimate.
 */
export function videoScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds in VIDEO_SCENE_COUNT_GUIDE) {
    return VIDEO_SCENE_COUNT_GUIDE[durationSeconds].target;
  }
  const targetEntries: TableEntry[] = Object.entries(VIDEO_SCENE_COUNT_GUIDE)
    .map(([d, v]) => [Number(d), v.target] as TableEntry)
    .sort((a, b) => a[0] - b[0]);
  return interpolateFromTable(targetEntries, durationSeconds);
}

/**
 * Calculate scene count based on media type
 */
export function getSceneCount(duration: number, mediaType: 'ai-images' | 'ai-videos'): number {
  return mediaType === 'ai-videos'
    ? videoScenesFromDuration(duration)
    : imageScenesFromDuration(duration);
}
