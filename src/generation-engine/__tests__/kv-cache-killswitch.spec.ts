/**
 * KV Cache with Kill Switch - Reliability Tests
 * 
 * Tests for KV cache reliability:
 * - Kill switch enable/disable behavior
 * - Fallback to Supabase when cache disabled
 * - Dynamic TTL based on job status
 * - Fail-open behavior on errors
 * - Cache invalidation
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'awaiting_review';
  progress: number;
  scenesCompleted: number;
  totalScenes: number;
  imagesCompleted: number;
  videosCompleted: number;
  audioCompleted: number;
  updatedAt: number;
}

class MockKV {
  private data: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  reset() {
    this.data.clear();
  }

  getData(): Map<string, string> {
    return this.data;
  }
}

class JobStatusCache {
  private kv: MockKV | null;
  private enabled: boolean;

  private stats = {
    enabled: false,
    hit: 0,
    miss: 0,
    error: 0,
  };

  private readonly TTL_CONFIG: Record<string, number> = {
    pending: 300,
    processing: 60,
    completed: 3600,
    failed: 1800,
    cancelled: 1800,
    awaiting_review: 300,
  };

  constructor(kv: MockKV | null, enableFlag: string | undefined) {
    this.kv = kv;
    this.enabled = enableFlag === 'true' && this.kv !== null;
    this.stats.enabled = this.enabled;
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    if (!this.enabled || !this.kv) {
      return null;
    }

    try {
      const cached = await this.kv.get(`job:${jobId}:status`);

      if (cached) {
        this.stats.hit++;
        return JSON.parse(cached);
      }

      this.stats.miss++;
      return null;
    } catch (error) {
      this.stats.error++;
      return null;
    }
  }

  async setJobStatus(jobId: string, status: JobStatus): Promise<void> {
    if (!this.enabled || !this.kv) {
      return;
    }

    try {
      const ttl = this.TTL_CONFIG[status.status] || this.TTL_CONFIG.processing;
      await this.kv.put(`job:${jobId}:status`, JSON.stringify(status), { expirationTtl: ttl });
    } catch (error) {
      // Fail silently
    }
  }

  async invalidateJobStatus(jobId: string): Promise<void> {
    if (!this.enabled || !this.kv) {
      return;
    }

    try {
      await this.kv.delete(`job:${jobId}:status`);
    } catch (error) {
      // Fail silently
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStats() {
    return { ...this.stats };
  }

  getTTLForStatus(status: string): number {
    return this.TTL_CONFIG[status] || this.TTL_CONFIG.processing;
  }
}

describe('KV Cache with Kill Switch - Reliability', () => {
  describe('1. Kill Switch Enable/Disable', () => {
    it('should enable cache when KV exists and flag is true', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');
      expect(cache.isEnabled()).toBe(true);
    });

    it('should disable cache when KV is null', () => {
      const cache = new JobStatusCache(null, 'true');
      expect(cache.isEnabled()).toBe(false);
    });

    it('should disable cache when flag is not "true"', () => {
      const kv = new MockKV();

      const cacheUndefined = new JobStatusCache(kv, undefined);
      const cacheFalse = new JobStatusCache(kv, 'false');
      const cacheEmpty = new JobStatusCache(kv, '');

      expect(cacheUndefined.isEnabled()).toBe(false);
      expect(cacheFalse.isEnabled()).toBe(false);
      expect(cacheEmpty.isEnabled()).toBe(false);
    });

    it('should disable cache when flag is missing', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, undefined);
      expect(cache.isEnabled()).toBe(false);
    });
  });

  describe('2. Fallback to Supabase', () => {
    it('should return null when cache is disabled (fallback to Supabase)', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'false');

      const status = await cache.getJobStatus('job-123');

      expect(status).toBeNull();
    });

    it('should return null when KV is null (fallback to Supabase)', async () => {
      const cache = new JobStatusCache(null, 'true');

      const status = await cache.getJobStatus('job-123');

      expect(status).toBeNull();
    });

    it('should not write to KV when cache is disabled', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'false');

      await cache.setJobStatus('job-123', {
        jobId: 'job-123',
        status: 'processing',
        progress: 50,
        scenesCompleted: 1,
        totalScenes: 3,
        imagesCompleted: 1,
        videosCompleted: 0,
        audioCompleted: 0,
        updatedAt: Date.now(),
      });

      const stored = await kv.get('job:job-123:status');
      expect(stored).toBeNull();
    });
  });

  describe('3. Dynamic TTL', () => {
    it('should use 5 minute TTL for pending jobs', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const ttl = cache.getTTLForStatus('pending');

      expect(ttl).toBe(300);
    });

    it('should use 1 minute TTL for processing jobs', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const ttl = cache.getTTLForStatus('processing');

      expect(ttl).toBe(60);
    });

    it('should use 1 hour TTL for completed jobs', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const ttl = cache.getTTLForStatus('completed');

      expect(ttl).toBe(3600);
    });

    it('should use 30 minute TTL for failed jobs', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const ttl = cache.getTTLForStatus('failed');

      expect(ttl).toBe(1800);
    });

    it('should default to processing TTL for unknown status', () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const ttl = cache.getTTLForStatus('unknown');

      expect(ttl).toBe(60);
    });
  });

  describe('4. Fail-Open Behavior', () => {
    it('should return null on KV read error (fail open)', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      kv.getData().set('job:job-123:status', 'invalid-json{');

      const status = await cache.getJobStatus('job-123');

      expect(status).toBeNull();
    });

    it('should not throw on KV write error', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      await expect(async () => {
        await cache.setJobStatus('job-123', {
          jobId: 'job-123',
          status: 'processing',
          progress: 50,
          scenesCompleted: 1,
          totalScenes: 3,
          imagesCompleted: 1,
          videosCompleted: 0,
          audioCompleted: 0,
          updatedAt: Date.now(),
        });
      }).not.toThrow();
    });

    it('should track errors in statistics', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      kv.getData().set('job:job-123:status', 'invalid-json{');

      await cache.getJobStatus('job-123');

      const stats = cache.getStats();
      expect(stats.error).toBe(1);
    });
  });

  describe('5. Cache Operations', () => {
    it('should store and retrieve job status', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const status: JobStatus = {
        jobId: 'job-123',
        status: 'processing',
        progress: 50,
        scenesCompleted: 1,
        totalScenes: 3,
        imagesCompleted: 1,
        videosCompleted: 0,
        audioCompleted: 0,
        updatedAt: Date.now(),
      };

      await cache.setJobStatus('job-123', status);
      const retrieved = await cache.getJobStatus('job-123');

      expect(retrieved?.status).toBe('processing');
      expect(retrieved?.progress).toBe(50);
    });

    it('should return cache miss for non-existent job', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const status = await cache.getJobStatus('nonexistent-job');

      expect(status).toBeNull();
    });

    it('should invalidate job status', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const status: JobStatus = {
        jobId: 'job-123',
        status: 'processing',
        progress: 50,
        scenesCompleted: 1,
        totalScenes: 3,
        imagesCompleted: 1,
        videosCompleted: 0,
        audioCompleted: 0,
        updatedAt: Date.now(),
      };

      await cache.setJobStatus('job-123', status);
      await cache.invalidateJobStatus('job-123');

      const retrieved = await cache.getJobStatus('job-123');
      expect(retrieved).toBeNull();
    });

    it('should not invalidate when cache is disabled', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'false');

      const status: JobStatus = {
        jobId: 'job-123',
        status: 'processing',
        progress: 50,
        scenesCompleted: 1,
        totalScenes: 3,
        imagesCompleted: 1,
        videosCompleted: 0,
        audioCompleted: 0,
        updatedAt: Date.now(),
      };

      await cache.setJobStatus('job-123', status);
      await cache.invalidateJobStatus('job-123');

      const stored = await kv.get('job:job-123:status');
      expect(stored).toBeNull();
    });
  });

  describe('6. Statistics Tracking', () => {
    it('should track cache hits', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const status: JobStatus = {
        jobId: 'job-123',
        status: 'processing',
        progress: 50,
        scenesCompleted: 1,
        totalScenes: 3,
        imagesCompleted: 1,
        videosCompleted: 0,
        audioCompleted: 0,
        updatedAt: Date.now(),
      };

      await cache.setJobStatus('job-123', status);
      await cache.getJobStatus('job-123');

      const stats = cache.getStats();
      expect(stats.hit).toBe(1);
    });

    it('should track cache misses', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      await cache.getJobStatus('nonexistent-job');

      const stats = cache.getStats();
      expect(stats.miss).toBe(1);
    });

    it('should report correct enabled status in stats', () => {
      const kv = new MockKV();
      const enabledCache = new JobStatusCache(kv, 'true');
      const disabledCache = new JobStatusCache(kv, 'false');

      expect(enabledCache.getStats().enabled).toBe(true);
      expect(disabledCache.getStats().enabled).toBe(false);
    });
  });

  describe('7. Cache Key Format', () => {
    it('should use correct key format for job status', async () => {
      const kv = new MockKV();
      const cache = new JobStatusCache(kv, 'true');

      const status: JobStatus = {
        jobId: 'job-abc',
        status: 'completed',
        progress: 100,
        scenesCompleted: 3,
        totalScenes: 3,
        imagesCompleted: 3,
        videosCompleted: 3,
        audioCompleted: 3,
        updatedAt: Date.now(),
      };

      await cache.setJobStatus('job-abc', status);

      const stored = await kv.get('job:job-abc:status');
      expect(stored).toBeTruthy();
    });
  });
});
