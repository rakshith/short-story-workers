/**
 * Video Pricing Utilities
 * Centralized credit cost calculation for video generation models.
 * Shared between Next.js client and Cloudflare Workers.
 */

import videoModelsJson from './video-models.json';

export interface VideoModelConfig {
  id: string;
  name: string;
  provider: string;
  providerId: string;
  enabled: boolean;
  paid?: boolean;
  defaultConfig: Record<string, any>;
  description: string;
  costPerImage: string;
  creditCost: number;
  pixelsPerSecond: number;
  resPerSecond: Record<string, number>;
}

const allVideoModels: VideoModelConfig[] = videoModelsJson.models as VideoModelConfig[];

/**
 * Get full video model configuration by model ID.
 * @param modelId - e.g. 'bytedance/seedance-2.0'
 * @returns VideoModelConfig or null
 */
export function getVideoModelConfig(modelId: string): VideoModelConfig | null {
  const model = allVideoModels.find(m => m.id === modelId);
  return model ?? null;
}

/**
 * Get the per-second credit cost for a specific resolution.
 * Falls back to model.creditCost if resolution is not found in resPerSecond.
 *
 * @param modelId - e.g. 'bytedance/seedance-2.0'
 * @param resolution - e.g. '480p', '720p', '1080p'
 * @returns credits per second
 */
export function getResolutionCreditCost(
  modelId: string,
  resolution: string
): number {
  const model = getVideoModelConfig(modelId);
  if (!model) return 0;

  // Normalize resolution: handle both '720p' and '1280*720' formats
  const normalized = normalizeResolution(resolution);
  const cost = model.resPerSecond[normalized];

  if (cost !== undefined) {
    return cost * model.creditCost;
  }

  // Fallback: use base creditCost if resolution not explicitly defined
  return model.creditCost;
}

/**
 * Calculate total credit cost for video generation.
 *
 * Formula: creditCostPerSecond × duration × numClips
 * where creditCostPerSecond = resPerSecond[resolution] || creditCost
 *
 * @param modelId - e.g. 'bytedance/seedance-2.0'
 * @param resolution - e.g. '720p' or '1280*720'
 * @param duration - in seconds
 * @param numClips - number of clips (default 1)
 * @returns total credits (rounded)
 */
export function getVideoCreditCost(
  modelId: string,
  resolution: string,
  duration: number,
  numClips: number = 1
): number {
  const costPerSecond = getResolutionCreditCost(modelId, resolution);
  if (costPerSecond <= 0 || duration <= 0) return 0;
  return Math.round(costPerSecond * duration * numClips);
}

/**
 * Normalize resolution string to a standard key used in resPerSecond.
 * Handles '720p', '1280*720', '480', etc.
 */
function normalizeResolution(resolution: string): string {
  const lowered = resolution.toLowerCase().trim();

  // Direct match: 480p, 720p, 1080p
  if (['480p', '720p', '1080p'].includes(lowered)) {
    return lowered;
  }

  // Size format: 1280*720, 854*480, 1920*1080
  if (lowered.includes('*')) {
    const parts = lowered.split('*');
    if (parts.length === 2) {
      const height = parseInt(parts[1], 10);
      if (height <= 480) return '480p';
      if (height <= 720) return '720p';
      return '1080p';
    }
  }

  // Numeric fallback: extract number and map
  const match = lowered.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 480) return '480p';
    if (num <= 720) return '720p';
    return '1080p';
  }

  return lowered;
}

/**
 * Get all available video models.
 */
export function getAllVideoModels(): VideoModelConfig[] {
  return allVideoModels;
}

/**
 * Check if a model ID is a known video model.
 */
export function isVideoModel(modelId: string): boolean {
  return allVideoModels.some(m => m.id === modelId);
}
