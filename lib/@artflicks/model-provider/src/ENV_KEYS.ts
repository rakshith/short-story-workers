/**
 * Centralized API Keys Configuration
 * 
 * All provider credentials in one file
 * Update API keys from here - single point of change
 */

import { ProviderType, PROVIDER_NAMES } from './types';

// ============================================================================
// Environment Variable Names
// ============================================================================

export const ENV_KEYS = {
  // Primary provider config
  PRIMARY_PROVIDER: 'PRIMARY_PROVIDER',
  FALLBACK_PROVIDER: 'FALLBACK_PROVIDER',
  RETRY_ATTEMPTS: 'RETRY_ATTEMPTS',
  USE_GATEWAY: 'USE_GATEWAY',
  GATEWAY_URL: 'GATEWAY_URL',
  
  // Replicate
  REPLICATE_API_KEY: 'REPLICATE_API_KEY',
  REPLICATE_WEBHOOK_URL: 'REPLICATE_WEBHOOK_URL',
  
  // Fal.ai
  FAL_API_KEY: 'FAL_API_KEY',
  FAL_KEY: 'FAL_KEY', // Alias for FAL_API_KEY
  
  // Cloudflare
  CF_API_TOKEN: 'CF_API_TOKEN',
  CF_ACCOUNT_ID: 'CF_ACCOUNT_ID',
  CF_AI_GATEWAY_URL: 'CF_AI_GATEWAY_URL',
  CF_AIG_AUTHORIZATION: 'CF_AIG_AUTHORIZATION',
  
  // ElevenLabs
  ELEVENLABS_API_KEY: 'ELEVENLABS_API_KEY',
  
  // WaveSpeed
  WAVESPEED_API_KEY: 'WAVESPEED_API_KEY',
} as const;

// ============================================================================
// Get API Keys from Environment
// ============================================================================

/**
 * Get all API keys from environment
 */
export function getApiKeys(): Record<string, string | undefined> {
  // Use dynamic import for environment access
  // In Node.js: process.env
  // In browser: window.__ENV__
  const env = typeof window !== 'undefined' 
    ? (window as any).__ENV__ 
    : (typeof process !== 'undefined' ? process.env : {});
  
  return {
    // Primary config
    PRIMARY_PROVIDER: env?.[ENV_KEYS.PRIMARY_PROVIDER],
    FALLBACK_PROVIDER: env?.[ENV_KEYS.FALLBACK_PROVIDER],
    RETRY_ATTEMPTS: env?.[ENV_KEYS.RETRY_ATTEMPTS],
    USE_GATEWAY: env?.[ENV_KEYS.USE_GATEWAY],
    GATEWAY_URL: env?.[ENV_KEYS.GATEWAY_URL],
    
    // Replicate
    REPLICATE_API_KEY: env?.[ENV_KEYS.REPLICATE_API_KEY],
    REPLICATE_WEBHOOK_URL: env?.[ENV_KEYS.REPLICATE_WEBHOOK_URL],
    
    // Fal.ai (supports both FAL_API_KEY and FAL_KEY)
    FAL_API_KEY: env?.[ENV_KEYS.FAL_API_KEY] || env?.[ENV_KEYS.FAL_KEY],
    
    // Cloudflare
    CF_API_TOKEN: env?.[ENV_KEYS.CF_API_TOKEN],
    CF_ACCOUNT_ID: env?.[ENV_KEYS.CF_ACCOUNT_ID],
    CF_AI_GATEWAY_URL: env?.[ENV_KEYS.CF_AI_GATEWAY_URL],
    CF_AIG_AUTHORIZATION: env?.[ENV_KEYS.CF_AIG_AUTHORIZATION],
    
    // ElevenLabs
    ELEVENLABS_API_KEY: env?.[ENV_KEYS.ELEVENLABS_API_KEY],
    
    // WaveSpeed
    WAVESPEED_API_KEY: env?.[ENV_KEYS.WAVESPEED_API_KEY],
  };
}

// ============================================================================
// Get Specific API Keys
// ============================================================================

/**
 * Get Replicate API key
 */
export function getReplicateKey(): string | undefined {
  return getApiKeys().REPLICATE_API_KEY;
}

/**
 * Get Fal.ai API key (supports FAL_API_KEY and FAL_KEY)
 */
export function getFalKey(): string | undefined {
  return getApiKeys().FAL_API_KEY;
}

/**
 * Get Cloudflare API keys
 */
export function getCloudflareKeys(): {
  apiToken?: string;
  accountId?: string;
  gatewayUrl?: string;
  auth?: string;
} {
  const keys = getApiKeys();
  return {
    apiToken: keys.CF_API_TOKEN,
    accountId: keys.CF_ACCOUNT_ID,
    gatewayUrl: keys.CF_AI_GATEWAY_URL,
    auth: keys.CF_AIG_AUTHORIZATION,
  };
}

/**
 * Get ElevenLabs API key
 */
export function getElevenLabsKey(): string | undefined {
  return getApiKeys().ELEVENLABS_API_KEY;
}

// ============================================================================
// Check Configured Keys
// ============================================================================

/**
 * Get list of configured API keys
 */
export function getConfiguredKeys(): string[] {
  const keys = getApiKeys();
  return Object.entries(keys)
    .filter(([_, value]) => value && value !== '' && value !== undefined)
    .map(([key]) => key);
}

/**
 * Check if a specific provider has its API key configured
 */
export function isProviderConfigured(provider: ProviderType): boolean {
  const keys = getApiKeys();
  
  switch (provider) {
    case PROVIDER_NAMES.REPLICATE:
      return !!keys.REPLICATE_API_KEY;
    case PROVIDER_NAMES.FALAI:
      return !!keys.FAL_API_KEY;
    case PROVIDER_NAMES.GATEWAY:
      return !!(keys.CF_API_TOKEN && keys.CF_ACCOUNT_ID && keys.CF_AI_GATEWAY_URL);
    default:
      return false;
  }
}

// ============================================================================
// Validate Provider Keys
// ============================================================================

/**
 * Validate required keys for a provider
 */
export function validateProviderKeys(provider: ProviderType): { valid: boolean; missing: string[] } {
  const keys = getApiKeys();
  const missing: string[] = [];
  
  switch (provider) {
    case PROVIDER_NAMES.REPLICATE:
      if (!keys.REPLICATE_API_KEY) missing.push('REPLICATE_API_KEY');
      break;
    case PROVIDER_NAMES.FALAI:
      if (!keys.FAL_API_KEY) missing.push('FAL_API_KEY');
      break;
    case PROVIDER_NAMES.GATEWAY:
      if (!keys.CF_API_TOKEN) missing.push('CF_API_TOKEN');
      if (!keys.CF_ACCOUNT_ID) missing.push('CF_ACCOUNT_ID');
      if (!keys.CF_AI_GATEWAY_URL) missing.push('CF_AI_GATEWAY_URL');
      break;
  }
  
  return { valid: missing.length === 0, missing };
}

/**
 * Validate all provider keys
 */
export function validateAllKeys(): Record<ProviderType, { valid: boolean; missing: string[] }> {
  return {
    replicate: validateProviderKeys(PROVIDER_NAMES.REPLICATE),
    falai: validateProviderKeys(PROVIDER_NAMES.FALAI),
    gateway: validateProviderKeys(PROVIDER_NAMES.GATEWAY),
  };
}

// ============================================================================
// Client-Side Key Setting (for browser/Next.js)
// ============================================================================

/**
 * Set API keys programmatically (client-side)
 * Useful for Next.js or browser environments
 */
export function setApiKeys(keys: Record<string, string>): void {
  if (typeof window !== 'undefined') {
    (window as any).__ENV__ = {
      ...(window as any).__ENV__,
      ...keys,
    };
  }
}

/**
 * Clear all API keys (client-side)
 */
export function clearApiKeys(): void {
  if (typeof window !== 'undefined') {
    (window as any).__ENV__ = {};
  }
}