/**
 * Operation cost functions
 * Get credit costs for operations (voice, music, script, etc.)
 */

import { pricingData } from './types';

/**
 * Get operation cost
 */
export function getOperationCost(operation: string): number {
  const operations: Record<string, number> = pricingData.operations;
  return operations[operation] ?? 0;
}

// Operation cost constants (for convenience)
export const SCRIPT_GENERATION_COST = pricingData.operations['script-generation'] ?? 8;
export const VOICE_GENERATION_COST = pricingData.operations['voice-generation'] ?? 1;
export const BACKGROUND_MUSIC_COST = pricingData.operations['background-music'] ?? 1;
export const IMMERSIVE_AUDIO_COST = pricingData.operations['immersive-audio'] ?? 3;
export const STORY_EXPORT_COST = pricingData.operations['story-export'] ?? 2;
export const YOUTUBE_EXTRACT_COST = pricingData.operations['youtube-extract'] ?? 5;

// Default values
export const DEFAULT_TIER = 'basic';
export const BASE_DURATION_PER_CREDIT = 40;
