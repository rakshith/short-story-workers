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
  
  // Seedance 2.0 specific config
  SEEDANCE_PROVIDER: 'SEEDANCE_PROVIDER',
  SEEDANCE_GENERATION_TYPE: 'SEEDANCE_GENERATION_TYPE',
  
  // Replicate (Cloudflare Workers use REPLICATE_API_TOKEN, Next.js apps use REPLICATE_API_KEY)
  REPLICATE_API_KEY: 'REPLICATE_API_KEY',
  REPLICATE_API_TOKEN: 'REPLICATE_API_TOKEN',
  NEXT_PUBLIC_REPLICATE_API_KEY: 'NEXT_PUBLIC_REPLICATE_API_KEY', // Public fallback
  REPLICATE_WEBHOOK_URL: 'REPLICATE_WEBHOOK_URL',
  
  // Fal.ai
  FAL_API_KEY: 'FAL_API_KEY',
  FAL_WEBHOOK_URL: 'FAL_WEBHOOK_URL',
  
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
 * @param workerEnv - Optional env object for Cloudflare Workers (bypasses process.env)
 */
export function getApiKeys(workerEnv?: Record<string, any>): Record<string, string | undefined> {
  // Priority: explicit workerEnv > browser window.__ENV__ > Node.js process.env
  const env = workerEnv
    ?? (typeof window !== 'undefined'
      ? (window as any).__ENV__
      : (typeof process !== 'undefined' ? process.env : {}));
  
  return {
    // Primary config
    PRIMARY_PROVIDER: env?.[ENV_KEYS.PRIMARY_PROVIDER],
    FALLBACK_PROVIDER: env?.[ENV_KEYS.FALLBACK_PROVIDER],
    RETRY_ATTEMPTS: env?.[ENV_KEYS.RETRY_ATTEMPTS],
    USE_GATEWAY: env?.[ENV_KEYS.USE_GATEWAY],
    GATEWAY_URL: env?.[ENV_KEYS.GATEWAY_URL],
    
    // Seedance 2.0 specific config
    SEEDANCE_PROVIDER: env?.[ENV_KEYS.SEEDANCE_PROVIDER],
    SEEDANCE_GENERATION_TYPE: env?.[ENV_KEYS.SEEDANCE_GENERATION_TYPE],
    
    // Replicate (supports REPLICATE_API_KEY, REPLICATE_API_TOKEN, and NEXT_PUBLIC_REPLICATE_API_KEY)
    REPLICATE_API_KEY: env?.[ENV_KEYS.REPLICATE_API_KEY] || env?.[ENV_KEYS.REPLICATE_API_TOKEN] || env?.[ENV_KEYS.NEXT_PUBLIC_REPLICATE_API_KEY],
    REPLICATE_WEBHOOK_URL: env?.[ENV_KEYS.REPLICATE_WEBHOOK_URL],
    
    // Fal.ai
    FAL_API_KEY: env?.[ENV_KEYS.FAL_API_KEY],
    FAL_WEBHOOK_URL: env?.[ENV_KEYS.FAL_WEBHOOK_URL],
    
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
export function getReplicateKey(env?: Record<string, any>): string | undefined {
  return getApiKeys(env).REPLICATE_API_KEY;
}

/**
 * Get Fal.ai API key
 */
export function getFalKey(env?: Record<string, any>): string | undefined {
  return getApiKeys(env).FAL_API_KEY;
}

/**
 * Get Fal.ai webhook URL
 */
export function getFalWebhookUrl(env?: Record<string, any>): string | undefined {
  return getApiKeys(env).FAL_WEBHOOK_URL;
}

/**
 * Get Cloudflare API keys
 */
export function getCloudflareKeys(env?: Record<string, any>): {
  apiToken?: string;
  accountId?: string;
  gatewayUrl?: string;
  auth?: string;
} {
  const keys = getApiKeys(env);
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
export function getElevenLabsKey(env?: Record<string, any>): string | undefined {
  return getApiKeys(env).ELEVENLABS_API_KEY;
}

// ============================================================================
// Check Configured Keys
// ============================================================================

/**
 * Get list of configured API keys
 */
export function getConfiguredKeys(env?: Record<string, any>): string[] {
  const keys = getApiKeys(env);
  return Object.entries(keys)
    .filter(([_, value]) => value && value !== '' && value !== undefined)
    .map(([key]) => key);
}

/**
 * Check if a specific provider has its API key configured
 */
export function isProviderConfigured(provider: ProviderType, env?: Record<string, any>): boolean {
  const keys = getApiKeys(env);
  
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
export function validateProviderKeys(provider: ProviderType, env?: Record<string, any>): { valid: boolean; missing: string[] } {
  const keys = getApiKeys(env);
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
export function validateAllKeys(env?: Record<string, any>): Record<ProviderType, { valid: boolean; missing: string[] }> {
  return {
    replicate: validateProviderKeys(PROVIDER_NAMES.REPLICATE, env),
    falai: validateProviderKeys(PROVIDER_NAMES.FALAI, env),
    gateway: validateProviderKeys(PROVIDER_NAMES.GATEWAY, env),
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