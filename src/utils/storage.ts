// Storage utility functions for Cloudflare R2

export function generateShortStoryPath(
  storyType: string,
  userId: string,
  seriesId: string | number,
  storyId: string,
  outputFormat: string = 'jpg'
): string {
  const folderName = storyType.toLowerCase();
  return `short-stories/${folderName}/series/${userId}/${seriesId}/${storyId}`;
}

export function generateUUID(): string {
  // Simple UUID v4 generator for Cloudflare Workers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

