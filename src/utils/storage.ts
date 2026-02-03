// Storage utility functions for Cloudflare R2

import { FOLDER_NAMES } from '../config/table-config';

export function generateShortStoryPath(
  storyType: string,
  userId: string,
  seriesId: string | number | undefined,
  storyId: string,
  outputFormat: string = 'jpg'
): string {
  const folderName = storyType.toLowerCase();
  const hasSeriesId = seriesId != null && String(seriesId).trim() !== '';
  return hasSeriesId
    ? `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/series/${userId}/${seriesId}/${storyId}`
    : `${FOLDER_NAMES.SHORT_STORIES}/${folderName}/series/${userId}/${storyId}`;
}

export function generateUUID(): string {
  // Simple UUID v4 generator for Cloudflare Workers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

