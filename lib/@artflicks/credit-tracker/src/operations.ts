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
export const SCRIPT_GENERATION_COST = pricingData.operations['script-generation'] ?? 12;
export const VOICE_GENERATION_COST = pricingData.operations['voice-generation'] ?? 2;
export const VOICE_GENERATION_COST_PER_CHAR = pricingData.operations['voice-generation-per-char'] ?? 0.002;
export const SPEECH_TO_TEXT_COST = pricingData.operations['speech-to-text'] ?? 1;
export const BACKGROUND_MUSIC_COST = pricingData.operations['background-music'] ?? 1;
export const IMMERSIVE_AUDIO_COST = pricingData.operations['immersive-audio'] ?? 5;
export const STORY_EXPORT_COST = pricingData.operations['story-export'] ?? 2;
export const YOUTUBE_EXTRACT_COST = pricingData.operations['youtube-extract'] ?? 5;

// Default values
export const DEFAULT_TIER = 'basic';
export const BASE_DURATION_PER_CREDIT = 40;
