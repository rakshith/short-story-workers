// Job Status Cache Service with Kill Switch
// Provides KV caching with automatic fallback to Supabase
// Kill switch via ENABLE_KV_CACHE environment variable

import { Logger } from '../utils/logger';

export interface JobStatus {
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

export interface CacheStats {
  enabled: boolean;
  hit: number;
  miss: number;
  error: number;
  lastError?: string;
}

export class JobStatusCache {
  private kv: KVNamespace | null;
  private enabled: boolean;
  private logger: Logger;
  private stats: CacheStats;

  // TTL configuration (seconds)
  private readonly TTL_CONFIG = {
    pending: 300,        // 5 minutes for pending jobs
    processing: 60,      // 1 minute for active jobs (frequent updates)
    completed: 3600,     // 1 hour for completed jobs
    failed: 1800,        // 30 minutes for failed jobs
    cancelled: 1800,     // 30 minutes for cancelled jobs
    awaiting_review: 300, // 5 minutes for review mode
  };

  constructor(kv: KVNamespace | null, enableFlag: string | undefined, logger?: Logger) {
    this.kv = kv;
    this.enabled = enableFlag === 'true' && this.kv !== null;
    this.logger = logger || new Logger('JobStatusCache');
    this.stats = {
      enabled: this.enabled,
      hit: 0,
      miss: 0,
      error: 0,
    };

    if (this.enabled) {
      this.logger.info('[Cache] KV cache ENABLED - dynamic TTL active');
    } else {
      const reason = !this.kv ? 'KV binding missing' : 'ENABLE_KV_CACHE not set to true';
      this.logger.info(`[Cache] KV cache DISABLED (${reason}) - using Supabase only`);
    }
  }

  /**
   * Get job status from cache
   * Returns null if cache disabled, expired, or error (fall back to Supabase)
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    // Kill switch: if disabled, return null immediately
    if (!this.enabled || !this.kv) {
      return null;
    }

    try {
      const cached = await this.kv.get(`job:${jobId}:status`, 'json');
      
      if (cached) {
        this.stats.hit++;
        this.logger.debug('[Cache] HIT', { jobId, status: (cached as JobStatus).status });
        return cached as JobStatus;
      }

      this.stats.miss++;
      this.logger.debug('[Cache] MISS', { jobId });
      return null;
    } catch (error) {
      // Fail open - if KV fails, return null to use Supabase
      this.stats.error++;
      this.stats.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn('[Cache] Read failed, falling back to Supabase', { 
        jobId, 
        error: this.stats.lastError 
      });
      return null;
    }
  }

  /**
   * Set job status in cache with dynamic TTL based on status
   */
  async setJobStatus(jobId: string, status: JobStatus): Promise<void> {
    // Kill switch: if disabled, don't write to KV
    if (!this.enabled || !this.kv) {
      return;
    }

    try {
      // Determine TTL based on job status
      const ttl = this.getTTLForStatus(status.status);
      
      await this.kv.put(
        `job:${jobId}:status`,
        JSON.stringify(status),
        { expirationTtl: ttl }
      );
      
      this.logger.debug('[Cache] SET', { 
        jobId, 
        status: status.status, 
        ttl,
        progress: status.progress 
      });
    } catch (error) {
      // Fail silently - don't block on cache write failures
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('[Cache] Write failed (non-critical)', { jobId, error: errorMsg });
    }
  }

  /**
   * Invalidate job status from cache
   * Call this when job is updated via webhook or manual action
   */
  async invalidateJobStatus(jobId: string): Promise<void> {
    if (!this.enabled || !this.kv) {
      return;
    }

    try {
      await this.kv.delete(`job:${jobId}:status`);
      this.logger.debug('[Cache] INVALIDATE', { jobId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('[Cache] Delete failed (non-critical)', { jobId, error: errorMsg });
    }
  }

  /**
   * Batch invalidate multiple jobs
   */
  async invalidateMultipleJobStatuses(jobIds: string[]): Promise<void> {
    if (!this.enabled || !this.kv) {
      return;
    }

    await Promise.all(
      jobIds.map(jobId => this.invalidateJobStatus(jobId))
    );
    
    this.logger.debug('[Cache] INVALIDATE_BATCH', { count: jobIds.length });
  }

  /**
   * Get dynamic TTL based on job status
   * Active jobs get shorter TTL for fresher data
   */
  private getTTLForStatus(status: JobStatus['status']): number {
    return this.TTL_CONFIG[status] || this.TTL_CONFIG.processing;
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      enabled: this.enabled,
      hit: 0,
      miss: 0,
      error: 0,
    };
  }

  /**
   * Get cache key for job status
   */
  private getCacheKey(jobId: string): string {
    return `job:${jobId}:status`;
  }

  /**
   * Warm cache with job status
   * Useful for pre-populating cache on job creation
   */
  async warmCache(jobId: string, initialStatus: Partial<JobStatus>): Promise<void> {
    if (!this.enabled || !this.kv) {
      return;
    }

    try {
      const status: JobStatus = {
        jobId,
        status: initialStatus.status || 'pending',
        progress: initialStatus.progress || 0,
        scenesCompleted: initialStatus.scenesCompleted || 0,
        totalScenes: initialStatus.totalScenes || 0,
        imagesCompleted: initialStatus.imagesCompleted || 0,
        videosCompleted: initialStatus.videosCompleted || 0,
        audioCompleted: initialStatus.audioCompleted || 0,
        updatedAt: Date.now(),
      };

      await this.setJobStatus(jobId, status);
      this.logger.debug('[Cache] WARM', { jobId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('[Cache] Warm failed (non-critical)', { jobId, error: errorMsg });
    }
  }
}

// Factory function for creating cache instance
export function createJobStatusCache(
  env: { JOB_STATUS_CACHE?: KVNamespace; ENABLE_KV_CACHE?: string },
  logger?: Logger
): JobStatusCache {
  return new JobStatusCache(
    env.JOB_STATUS_CACHE || null,
    env.ENABLE_KV_CACHE,
    logger
  );
}
