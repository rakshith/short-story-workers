// Concurrency Service - wraps tier-based concurrency control

export interface ConcurrencyCheckResult {
  allowed: boolean;
  activeConcurrency: number;
  maxConcurrency: number;
}

export class ConcurrencyService {
  private cache: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000;

  async check(
    userId: string,
    userTier: string,
    env: any,
    jobId?: string
  ): Promise<ConcurrencyCheckResult> {
    const { canProcessJob } = await import('../../services/concurrency-manager');
    const result = await canProcessJob(userId, userTier, env, jobId);
    return {
      allowed: result.allowed,
      activeConcurrency: result.activeConcurrency || 0,
      maxConcurrency: result.maxConcurrency || 1,
    };
  }

  getActiveCount(userId: string): number {
    const cached = this.cache.get(userId);
    if (!cached || Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      return 0;
    }
    return cached.count;
  }

  increment(userId: string): void {
    const current = this.cache.get(userId);
    this.cache.set(userId, {
      count: (current?.count || 0) + 1,
      timestamp: Date.now(),
    });
  }

  decrement(userId: string): void {
    const current = this.cache.get(userId);
    if (current) {
      this.cache.set(userId, {
        count: Math.max(0, current.count - 1),
        timestamp: Date.now(),
      });
    }
  }
}

export function createConcurrencyService(): ConcurrencyService {
  return new ConcurrencyService();
}
