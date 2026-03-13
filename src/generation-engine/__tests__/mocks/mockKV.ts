// MockKV - In-memory KV store for testing
// Simulates Cloudflare KV behavior for unit tests

export interface MockKVOptions {
  simulateFailures?: boolean;
  latencyMs?: number;
}

export class MockKV {
  private store: Map<string, { value: string; expiresAt: number | null }> = new Map();
  private simulateFailures: boolean;
  private latencyMs: number;

  constructor(options: MockKVOptions = {}) {
    this.simulateFailures = options.simulateFailures || false;
    this.latencyMs = options.latencyMs || 0;
  }

  async get(key: string, type?: 'text' | 'json' | 'arrayBuffer'): Promise<any> {
    await this.simulateLatency();
    
    if (this.simulateFailures) {
      throw new Error('Simulated KV failure');
    }

    const item = this.store.get(key);
    
    if (!item) {
      return null;
    }

    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    if (type === 'json') {
      try {
        return JSON.parse(item.value);
      } catch {
        return null;
      }
    }

    return item.value;
  }

  async put(key: string, value: string | ArrayBuffer, options?: { expirationTtl?: number }): Promise<void> {
    await this.simulateLatency();
    
    if (this.simulateFailures) {
      throw new Error('Simulated KV failure');
    }

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const expiresAt = options?.expirationTtl ? Date.now() + (options.expirationTtl * 1000) : null;
    
    this.store.set(key, { value: valueStr, expiresAt });
  }

  async delete(key: string): Promise<void> {
    await this.simulateLatency();
    
    if (this.simulateFailures) {
      throw new Error('Simulated KV failure');
    }

    this.store.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<{ keys: Array<{ name: string }> }> {
    await this.simulateLatency();
    
    if (this.simulateFailures) {
      throw new Error('Simulated KV failure');
    }

    let keys = Array.from(this.store.keys());
    
    if (options?.prefix) {
      keys = keys.filter(k => k.startsWith(options.prefix!));
    }

    if (options?.limit) {
      keys = keys.slice(0, options.limit);
    }

    // Filter out expired keys
    const now = Date.now();
    keys = keys.filter(key => {
      const item = this.store.get(key);
      if (!item) return false;
      if (item.expiresAt && now > item.expiresAt) {
        this.store.delete(key);
        return false;
      }
      return true;
    });

    return { keys: keys.map(name => ({ name })) };
  }

  // Test helper methods
  clear(): void {
    this.store.clear();
  }

  size(): number {
    // Clean up expired items first
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.store.delete(key);
      }
    }
    return this.store.size;
  }

  getTTL(key: string): number | null {
    const item = this.store.get(key);
    if (!item || !item.expiresAt) return null;
    
    const ttl = Math.floor((item.expiresAt - Date.now()) / 1000);
    return ttl > 0 ? ttl : 0;
  }

  setSimulateFailures(simulate: boolean): void {
    this.simulateFailures = simulate;
  }

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }
  }
}

// Factory function for creating mock KV
export function createMockKV(options?: MockKVOptions): MockKV {
  return new MockKV(options);
}
