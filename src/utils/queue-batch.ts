import { Queue } from '@cloudflare/workers-types';

const MAX_BATCH_SIZE = 100;

/**
 * Spread window (seconds) over which video scene jobs are staggered.
 * All scenes are distributed evenly within this window regardless of total scene count.
 * Increase if 429s reappear; decrease to speed up video start times.
 */
export const VIDEO_STAGGER_WINDOW_SECONDS = 60;

/**
 * Calculate proportional delay for a video scene job.
 * Spreads all scenes evenly across VIDEO_STAGGER_WINDOW_SECONDS.
 * Works correctly for any number of scenes — no cap needed.
 *
 * @param sceneIndex - 0-based index of the scene
 * @param totalScenes - total number of scenes in the story
 */
export function calcVideoDelaySeconds(sceneIndex: number, totalScenes: number): number {
  if (totalScenes <= 1) return 0;
  return Math.floor((sceneIndex / totalScenes) * VIDEO_STAGGER_WINDOW_SECONDS);
}

/**
 * Send messages in batches of MAX_BATCH_SIZE with no artificial delay.
 * Image and audio jobs are fired as fast as possible — only video sends are staggered.
 */
export async function sendQueueBatch<T>(queue: Queue<T>, messages: T[]): Promise<void> {
  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const chunk = messages.slice(i, i + MAX_BATCH_SIZE).map(body => ({ body }));
    await queue.sendBatch(chunk);
  }
}
