// Video Frame Extractor — Cloudflare Media Transformations binding
// Extracts frames at specific timestamps from product videos
// Native to Workers, supports any aspect ratio

import { Env } from '../types/env';

// ── Types ─────────────────────────────────────────────────────

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | 'other';

export interface ExtractFrameOptions {
  /** Video URL (R2 private URL or public URL) */
  videoUrl: string;
  /** Timestamp to extract (format: "00:00:05.00" or "5s") */
  timestamp: string;
  /** Output aspect ratio — matches video native ratio or user preference */
  outputAspectRatio?: AspectRatio;
  /** Custom width (overrides aspect ratio calculation) */
  width?: number;
  /** Custom height (overrides aspect ratio calculation) */
  height?: number;
  /** Output format (default: jpg) */
  format?: 'jpg' | 'png';
}

export interface ExtractFrameResult {
  success: boolean;
  /** Extracted frame as Blob (for upload to R2) */
  frameBlob?: Blob;
  /** Content type of the extracted frame */
  contentType?: string;
  /** Error message if extraction failed */
  error?: string;
}

// ── Aspect Ratio Helpers ──────────────────────────────────────

/**
 * Get width/height dimensions for a given aspect ratio.
 * Base width is 1080px, height calculated to maintain ratio.
 */
function getDimensionsForAspectRatio(
  aspectRatio: AspectRatio,
  baseWidth: number = 1080
): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    case 'other':
    default:
      // Default to 9:16 for unknown ratios
      return { width: 1080, height: 1920 };
  }
}

/**
 * Parse timestamp string to seconds.
 * Supports "00:00:05.00", "00:05", "5s", "5" formats.
 */
function parseTimestampToSeconds(timestamp: string): number {
  // Handle "5s" format
  if (timestamp.endsWith('s')) {
    return parseFloat(timestamp.replace('s', ''));
  }

  // Handle "00:00:05.00" or "00:05" format
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  // Handle plain number (seconds)
  return parseFloat(timestamp) || 0;
}

// ── Main Extraction Function ──────────────────────────────────

/**
 * Extract a frame from a video at a specific timestamp using Cloudflare Media Transformations.
 *
 * @param env - Cloudflare Worker environment with MEDIA binding
 * @param options - Extraction options (video URL, timestamp, aspect ratio)
 * @returns Extracted frame as Blob or error
 *
 * @example
 * ```typescript
 * const result = await extractVideoFrame(env, {
 *   videoUrl: 'https://pub-xxx.r2.dev/videos/product.mp4',
 *   timestamp: '00:00:05.00',
 *   outputAspectRatio: '9:16',
 * });
 *
 * if (result.success && result.frameBlob) {
 *   // Upload to R2
 *   await env.IMAGES_BUCKET.put('frames/frame.jpg', result.frameBlob);
 * }
 * ```
 */
export async function extractVideoFrame(
  env: Env,
  options: ExtractFrameOptions
): Promise<ExtractFrameResult> {
  const {
    videoUrl,
    timestamp,
    outputAspectRatio = '9:16',
    width: customWidth,
    height: customHeight,
    format = 'jpg',
  } = options;

  try {
    // Validate timestamp
    const seconds = parseTimestampToSeconds(timestamp);
    if (seconds < 0) {
      return {
        success: false,
        error: `Invalid timestamp: ${timestamp}`,
      };
    }

    // Calculate output dimensions
    const dimensions = customWidth && customHeight
      ? { width: customWidth, height: customHeight }
      : getDimensionsForAspectRatio(outputAspectRatio);

    console.log(`[VideoFrameExtractor] Extracting frame at ${timestamp}s (${dimensions.width}x${dimensions.height})`);

    // Fetch the video
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`,
      };
    }

    const videoBody = videoResponse.body;
    if (!videoBody) {
      return {
        success: false,
        error: 'Video response has no body',
      };
    }

    // Use Cloudflare Media Transformations binding
    // Input the video stream
    const transformer = env.MEDIA.input(videoBody);

    // Apply transformation and get output
    // The .output() method returns a MediaTransformationResult
    // which can be awaited to get a Response
    const result = await transformer
      .output({
        mode: 'frame',
        format,
        time: timestamp,
      })
      .response();

    // Convert Response to Blob
    const frameBlob = await result.blob();
    const contentType = result.headers.get('content-type') || `image/${format}`;

    console.log(`[VideoFrameExtractor] Frame extracted successfully (${frameBlob.size} bytes)`);

    return {
      success: true,
      frameBlob,
      contentType,
    };
  } catch (err) {
    console.error('[VideoFrameExtractor] Extraction failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Frame extraction failed',
    };
  }
}

// ── Utility Functions ─────────────────────────────────────────

/**
 * Check if a video URL is accessible (for validation before extraction).
 */
export async function validateVideoUrl(videoUrl: string): Promise<boolean> {
  try {
    const response = await fetch(videoUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    return response.ok && contentType.startsWith('video/');
  } catch {
    return false;
  }
}

/**
 * Get video duration from URL (basic implementation using HEAD request).
 * Note: This doesn't return actual duration, just validates the URL is a video.
 * For actual duration, use Gemini vision analysis.
 */
export async function getVideoInfo(videoUrl: string): Promise<{ valid: boolean; contentType?: string }> {
  try {
    const response = await fetch(videoUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return {
      valid: response.ok,
      contentType: contentType || undefined,
    };
  } catch {
    return { valid: false };
  }
}
