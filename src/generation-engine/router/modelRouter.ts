// Model Router - selects providers based on availability, latency, cost

import { CircuitBreaker } from './circuitBreaker';

export type ModelCapability = 'image' | 'video' | 'voice' | 'script';

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  latency?: number;
  cost?: number;
  isAvailable?: boolean;
}

export interface FallbackChain {
  primary: string;
  fallback: string[];
}

export class ModelRouter {
  private models: Map<ModelCapability, ModelConfig[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    this.models.set('image', [
      { id: 'black-forest-labs/flux-schnell', name: 'Flux Schnell', provider: 'replicate', cost: 0.003 },
      { id: 'xai/grok-imagine-image', name: 'Grok Imagine', provider: 'replicate', cost: 0.002 },
      { id: 'stability-ai/stable-diffusion-3-medium', name: 'SD3', provider: 'replicate', cost: 0.004 },
    ]);

    this.models.set('video', [
      { id: 'wan-video/wan-2.5-t2v-fast', name: 'Wan 2.5 T2V', provider: 'replicate', cost: 0.01 },
      { id: 'minimax-video-01', name: 'MiniMax Video', provider: 'replicate', cost: 0.02 },
      { id: 'recraft-ai/recraft-v2', name: 'Recraft V2', provider: 'replicate', cost: 0.015 },
    ]);

    this.models.set('voice', [
      { id: 'eleven_multilingual_v2', name: 'ElevenLabs v2', provider: 'elevenlabs', cost: 0.01 },
      { id: 'tts-1', name: 'OpenAI TTS', provider: 'openai', cost: 0.005 },
    ]);

    this.models.set('script', [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', cost: 0.005 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', cost: 0.001 },
    ]);
  }

  registerModel(capability: ModelCapability, model: ModelConfig): void {
    const existing = this.models.get(capability) || [];
    const index = existing.findIndex(m => m.id === model.id);
    if (index >= 0) {
      existing[index] = model;
    } else {
      existing.push(model);
    }
    this.models.set(capability, existing);
  }

  selectModel(capability: ModelCapability, preference?: 'lowest-cost' | 'fastest'): string {
    const models = this.models.get(capability) || [];
    if (models.length === 0) {
      throw new Error(`No models registered for capability: ${capability}`);
    }

    const available = models.filter(m => {
      const cb = this.circuitBreakers.get(m.id);
      return !cb || cb.isAvailable();
    });

    if (available.length === 0) {
      throw new Error(`All models for ${capability} are unavailable (circuit open)`);
    }

    if (preference === 'lowest-cost') {
      available.sort((a, b) => (a.cost || 0) - (b.cost || 0));
    } else if (preference === 'fastest') {
      available.sort((a, b) => (a.latency || 100) - (b.latency || 100));
    }

    return available[0].id;
  }

  getFallbackChain(capability: ModelCapability, primaryModel: string): string[] {
    const models = this.models.get(capability) || [];
    const index = models.findIndex(m => m.id === primaryModel);
    if (index < 0 || index >= models.length - 1) {
      return [];
    }
    return models.slice(index + 1).filter(m => {
      const cb = this.circuitBreakers.get(m.id);
      return !cb || cb.isAvailable();
    }).map(m => m.id);
  }

  recordSuccess(modelId: string): void {
    const cb = this.circuitBreakers.get(modelId);
    cb?.recordSuccess();
  }

  recordFailure(modelId: string): void {
    let cb = this.circuitBreakers.get(modelId);
    if (!cb) {
      cb = new CircuitBreaker(modelId);
      this.circuitBreakers.set(modelId, cb);
    }
    cb.recordFailure();
  }

  getCircuitState(modelId: string): 'closed' | 'open' | 'half-open' {
    const cb = this.circuitBreakers.get(modelId);
    return cb?.getState() || 'closed';
  }

  getModels(capability: ModelCapability): ModelConfig[] {
    return this.models.get(capability) || [];
  }
}

export function createModelRouter(): ModelRouter {
  return new ModelRouter();
}
