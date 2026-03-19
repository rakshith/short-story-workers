/**
 * Scene calculation functions
 * Convert video duration to number of scenes/clips
 */

/**
 * Derives the estimated number of AI-image scenes from a video duration.
 * Each AI image scene is ~2.5 s, so scene count scales linearly with duration.
 * Coverage: up to 300 s (5 min).
 */
export function imageScenesFromDuration(durationSeconds: number): number {
  if (durationSeconds <= 15)  return 6;   // ~2.5 s each
  if (durationSeconds <= 30)  return 12;  // ~2.5 s each
  if (durationSeconds <= 60)  return 24;  // ~2.5 s each
  if (durationSeconds <= 120) return 48;  // ~2.5 s each
  if (durationSeconds <= 180) return 72; // ~2.5 s each (3 min)
  if (durationSeconds <= 240) return 96; // ~2.5 s each (4 min)
  if (durationSeconds <= 300) return 120; // ~2.5 s each (5 min)
  return Math.ceil(durationSeconds / 2.5); // beyond 5 min: ~2.5 s per scene
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
