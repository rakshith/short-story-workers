# @artflicks/model-provider

Unified model provider abstraction layer for ArtFlicks. Supports multiple AI providers with automatic fallback.

## Supported Providers

- **Replicate** - Video, Image, Audio generation
- **Fal.ai** - Video, Image, Audio generation  
- **Cloudflare AI Gateway** - Unified gateway with routing and fallback

## Supported Models

### Video
- `kling-v2` - Kling video generation
- `wan-video/wan-2.6` - Wan 2.6 video generation
- `minimax/max-video` - MiniMax video generation

### Image
- `black-forest-labs/flux-1.1-pro` - FLUX image generation
- `black-forest-labs/flux-pro` - FLUX Pro
- `fal-ai/flux` - Fal.ai FLUX

### Audio
- `openai/tts-1` - OpenAI TTS
- `elevenlabs/eleven-monolingual` - ElevenLabs TTS

## Installation

```bash
npm install @artflicks/model-provider
```

## API Keys Configuration

All API keys are centralized in one file. You can set them in two ways:

### Option 1: Set API Keys Programmatically (Recommended for Client)

Set API keys directly from your client project code:

```typescript
import { setApiKeys } from '@artflicks/model-provider';

// Set all API keys at once
setApiKeys({
  REPLICATE_API_KEY: 'your_replicate_key',
  FAL_API_KEY: 'your_fal_key',
  CF_API_TOKEN: 'your_cloudflare_token',
  CF_ACCOUNT_ID: 'your_account_id',
  CF_AI_GATEWAY_URL: 'your_gateway_url',
  // ... other keys
});
```

Or set keys individually:

```typescript
import { setApiKeys, ENV_KEYS } from '@artflicks/model-provider';

// Set specific key
setApiKeys({ 
  [ENV_KEYS.REPLICATE_API_KEY]: 'your_key',
  [ENV_KEYS.FAL_API_KEY]: 'your_fal_key',
});
```

### Option 2: Environment Variables (Node.js / Server-side)

```bash
# Replicate
REPLICATE_API_KEY=your_replicate_key
REPLICATE_WEBHOOK_URL=your_webhook_url

# Fal.ai (supports both FAL_API_KEY and FAL_KEY)
FAL_API_KEY=your_fal_key

# Cloudflare AI Gateway
CF_API_TOKEN=your_cloudflare_token
CF_ACCOUNT_ID=your_account_id
CF_AI_GATEWAY_URL=your_gateway_url
CF_AIG_AUTHORIZATION=your_auth

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_key

# WaveSpeed
WAVESPEED_API_KEY=your_wavespeed_key

# Provider config (optional)
PRIMARY_PROVIDER=fal
FALLBACK_PROVIDER=replicate
RETRY_ATTEMPTS=2
USE_GATEWAY=false
```

Note: For Next.js client-side code, use `setApiKeys()` - environment variables work only in server-side code.

## Validate API Keys

Check if your API keys are configured correctly:

```typescript
import { validateAllKeys, isProviderConfigured, getConfiguredKeys } from '@artflicks/model-provider';

// Validate all provider keys
const validation = await validateAllKeys();
console.log(validation);
// {
//   replicate: { valid: true, missing: [] },
//   fal: { valid: true, missing: [] },
//   gateway: { valid: false, missing: ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_AI_GATEWAY_URL'] }
// }

// Check specific provider
const replicateReady = isProviderConfigured('replicate');
const falReady = isProviderConfigured('fal');
console.log('Replicate ready:', replicateReady);
console.log('Fal.ai ready:', falReady);

// Get list of configured keys
const configured = getConfiguredKeys();
console.log('Configured keys:', configured);
// ['REPLICATE_API_KEY', 'FAL_API_KEY']
```

## Usage

### Quick Start

```typescript
import { getReplicateProvider } from '@artflicks/model-provider';

// Get a specific provider
const replicate = getReplicateProvider();
const result = await replicate.generateVideo('kling-v2', {
  prompt: 'A cat walking in the snow',
});
console.log(result.videoUrl);
```

### Using Factory

```typescript
import { ModelProviderFactory } from '@artflicks/model-provider';

// Get provider with automatic fallback
const provider = ModelProviderFactory.getProvider('replicate', 'fal');

// Generate video - automatically uses fallback if primary fails
const result = await provider.generateVideo('kling-v2', {
  prompt: 'Your prompt here',
});

// Or for images
const imageResult = await provider.generateImage('black-forest-labs/flux-1.1-pro', {
  prompt: 'A beautiful sunset',
});

// Or for audio
const audioResult = await provider.generateAudio('openai/tts-1', {
  text: 'Hello, this is a test message',
});
```

### Get Provider by Model

```typescript
import { getProviderForVideo, getProviderForImage, getProviderForAudio } from '@artflicks/model-provider';

// Automatically choose provider based on model
const videoProvider = getProviderForVideo('wan-video/wan-2.6');
const result = await videoProvider.generateVideo('wan-video/wan-2.6', {
  prompt: 'Your prompt',
});
```

### Health Check

```typescript
import { checkProviderHealth } from '@artflicks/model-provider';

// Check all providers
const health = await checkProviderHealth();
console.log(health);
// {
//   replicate: { provider: 'replicate', healthy: true },
//   fal: { provider: 'fal', healthy: true },
//   gateway: { provider: 'gateway', healthy: false }
// }
```

### Using Factory Directly

```typescript
import { ModelProviderFactory } from '@artflicks/model-provider';

// Create specific provider with custom config
const replicate = ModelProviderFactory.createProvider('replicate', {
  apiKey: process.env.REPLICATE_API_KEY,
});

// Get provider for specific model with fallback
const provider = ModelProviderFactory.getProviderForModel(
  'kling-v2',
  'video',
  {
    primary: 'replicate',
    fallback: 'fal',
    retryAttempts: 2,
  }
);
```

## ENV_KEYS Reference

All API key constants are exported from the package:

```typescript
import { 
  ENV_KEYS,
  getApiKeys,
  getReplicateKey,
  getFalKey,
  getCloudflareKeys,
  getElevenLabsKey,
  setApiKeys,
  clearApiKeys,
  validateAllKeys,
  isProviderConfigured,
  getConfiguredKeys,
} from '@artflicks/model-provider';

// All environment variable names
ENV_KEYS.REPLICATE_API_KEY    // 'REPLICATE_API_KEY'
ENV_KEYS.FAL_API_KEY       // 'FAL_API_KEY'
ENV_KEYS.CF_API_TOKEN    // 'CF_API_TOKEN'
ENV_KEYS.CF_ACCOUNT_ID   // 'CF_ACCOUNT_ID'
ENV_KEYS.CF_AI_GATEWAY_URL  // 'CF_AI_GATEWAY_URL'
// ... and more

// Get all keys as object
const keys = getApiKeys();
console.log(keys.REPLICATE_API_KEY);

// Get specific keys
const replicateKey = getReplicateKey();
const falKey = getFalKey();
const cfKeys = getCloudflareKeys();
// cfKeys = { apiToken, accountId, gatewayUrl, auth }

// Clear keys (client-side)
clearApiKeys();
```

## API Reference

### Factory Methods

#### `ModelProviderFactory.createProvider(type, config?)`
Create a specific provider instance.

```typescript
const provider = ModelProviderFactory.createProvider('replicate', {
  apiKey: 'your-key',
});
```

#### `ModelProviderFactory.getProvider(primary, fallback?)`
Get provider with optional fallback.

```typescript
const provider = ModelProviderFactory.getProvider('replicate', 'fal');
```

#### `ModelProviderFactory.getProviderForModel(modelId, mediaType, config?)`
Get provider automatically based on model ID.

```typescript
const provider = ModelProviderFactory.getProviderForModel('kling-v2', 'video');
```

#### `ModelProviderFactory.getHealthStatus()`
Check health of all providers.

```typescript
const health = await ModelProviderFactory.getHealthStatus();
```

### Provider Methods

All providers implement the `ModelProvider` interface:

```typescript
interface ModelProvider {
  getProviderType(): 'replicate' | 'fal' | 'gateway';
  
  healthCheck(): Promise<boolean>;
  
  generateVideo(model: string, input: VideoInput, options?): Promise<VideoResult>;
  generateImage(model: string, input: ImageInput, options?): Promise<ImageResult>;
  generateAudio(model: string, input: AudioInput, options?): Promise<AudioResult>;
}
```

### Input Types

```typescript
interface VideoInput {
  prompt: string;
  imageUrl?: string;
  duration?: number;
}

interface ImageInput {
  prompt: string;
  imageSize?: 'square' | 'portrait' | 'landscape';
  numImages?: number;
}

interface AudioInput {
  text: string;
  voiceId?: string;
  model?: string;
}
```

### Result Types

```typescript
interface VideoResult {
  videoUrl: string;
  duration?: number;
  status?: 'processing' | 'completed' | 'failed';
}

interface ImageResult {
  imageUrls: string[];
  seed?: number;
}

interface AudioResult {
  audioUrl: string;
  duration?: number;
}
```

## Building

```bash
npm run build
```

Builds to `dist/` folder with ESM, CJS, and TypeScript definitions.

## License

MIT