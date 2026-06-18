import type { MediaType } from '../types';

/**
 * Canonical mediaType values the frontend sends.
 * Use these helpers instead of comparing raw strings.
 */
export const MEDIA_TYPE = {
  AI_IMAGES: 'ai-images' as const,
  AI_VIDEOS: 'ai-videos' as const,
} as const;

export function isVideoMediaType(mediaType?: MediaType): boolean {
  return mediaType === MEDIA_TYPE.AI_VIDEOS;
}

export function isImageMediaType(mediaType?: MediaType): boolean {
  return mediaType === MEDIA_TYPE.AI_IMAGES || mediaType === undefined;
}

/**
 * Normalizes frontend mediaType to internal category used for queue messages.
 * Frontend sends 'ai-images' | 'ai-videos', internal queue uses 'image' | 'video'.
 */
export function normalizeMediaType(mediaType?: MediaType): 'image' | 'video' {
  return isVideoMediaType(mediaType) ? 'video' : 'image';
}
