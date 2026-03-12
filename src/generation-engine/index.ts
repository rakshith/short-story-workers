// Generation Engine - Main entry point

// Types
export * from './types/index';

// Templates
export * from './templates/index';

// Profiles
export * from './profiles/index';

// Blocks
export * from './blocks/index';

// Workflow
export * from './workflow/index';

// Providers
export * from './providers/index';

// Services
export * from './services/index';

// State
export { JobDurableObject, createJobDurableObject } from './state/jobDurableObject';

// Queue
export * from './queue/index';

// Router
export * from './router/index';

// Storage
export * from './storage/index';

// API
export * from './api/index';

// Configuration
export function isMockMode(env?: { GEN_PROVIDER?: string }): boolean {
  return env?.GEN_PROVIDER === 'mock';
}

export function createMockEnv(): Record<string, any> {
  return {
    GEN_PROVIDER: 'mock',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-key',
    REPLICATE_API_TOKEN: 'mock-token',
    OPENAI_API_KEY: 'mock-key',
    ELEVENLABS_API_KEY: 'mock-key',
    ELEVENLABS_DEFAULT_VOICE_ID: 'mock-voice',
    APP_URL: 'http://localhost:8787',
  };
}
