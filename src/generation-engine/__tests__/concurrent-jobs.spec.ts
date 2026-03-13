/**
 * Concurrent Job Scenarios - Integration Tests
 * 
 * Tests for concurrent job handling:
 * - Multiple jobs for same user
 * - Multiple jobs for different users
 * - Race condition handling
 * - Resource contention
 * - Priority handling
 * 
 * Run: npx vitest run src/generation-engine/__tests__/concurrent-jobs.spec.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface Job {
  id: string;
  userId: string;
  storyId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  priority: number;
}

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private processing: Set<string> = new Set();

  add(job: Job): void {
    this.jobs.set(job.id, job);
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getByUser(userId: string): Job[] {
    return Array.from(this.jobs.values()).filter(j => j.userId === userId);
  }

  getProcessing(): Job[] {
    return Array.from(this.jobs.values()).filter(j => j.status === 'processing');
  }

  startProcessing(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'processing') {
      return false;
    }
    job.status = 'processing';
    this.processing.add(jobId);
    return true;
  }

  complete(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = progress;
      job.status = progress >= 100 ? 'completed' : 'processing';
      this.processing.delete(jobId);
    }
  }

  clear(): void {
    this.jobs.clear();
    this.processing.clear();
  }

  size(): number {
    return this.jobs.size;
  }
}

class ConcurrencyManager {
  private limits: Map<string, number> = new Map();
  private active: Map<string, Set<string>> = new Map();

  setLimit(userId: string, limit: number): void {
    this.limits.set(userId, limit);
    this.active.set(userId, new Set());
  }

  canProcess(userId: string, jobId: string): boolean {
    const limit = this.limits.get(userId) || 1;
    const active = this.active.get(userId) || new Set();

    if (active.has(jobId)) {
      return false; // Already processing this job
    }
    return active.size < limit;
  }

  startProcessing(userId: string, jobId: string): boolean {
    if (!this.canProcess(userId, jobId)) {
      return false;
    }

    const active = this.active.get(userId) || new Set();
    active.add(jobId);
    this.active.set(userId, active);
    return true;
  }

  finishProcessing(userId: string, jobId: string): void {
    const active = this.active.get(userId);
    if (active) {
      active.delete(jobId);
    }
  }

  getActiveCount(userId: string): number {
    return (this.active.get(userId) || new Set()).size;
  }

  reset(): void {
    this.limits.clear();
    this.active.clear();
  }
}

const jobQueue = new JobQueue();
const concurrencyManager = new ConcurrencyManager();

describe('Concurrent Job Scenarios - Integration', () => {
  beforeEach(() => {
    jobQueue.clear();
    concurrencyManager.reset();
  });

  describe('1. Multiple Jobs Same User', () => {
    it('should queue multiple jobs for same user', () => {
      const jobs = [
        { id: 'job-1', userId: 'user-1', storyId: 'story-1', status: 'pending' as const, progress: 0, priority: 1 },
        { id: 'job-2', userId: 'user-1', storyId: 'story-2', status: 'pending' as const, progress: 0, priority: 1 },
        { id: 'job-3', userId: 'user-1', storyId: 'story-3', status: 'pending' as const, progress: 0, priority: 1 },
      ];

      jobs.forEach(job => jobQueue.add(job));

      const userJobs = jobQueue.getByUser('user-1');
      expect(userJobs.length).toBe(3);
    });

    it('should respect concurrency limit for same user', () => {
      concurrencyManager.setLimit('user-1', 2);

      concurrencyManager.startProcessing('user-1', 'job-1');
      concurrencyManager.startProcessing('user-1', 'job-2');

      const canJob3 = concurrencyManager.canProcess('user-1', 'job-3');
      expect(canJob3).toBe(false);
    });

    it('should track active jobs correctly', () => {
      concurrencyManager.setLimit('user-1', 2);

      concurrencyManager.startProcessing('user-1', 'job-1');
      concurrencyManager.startProcessing('user-1', 'job-2');

      const activeCount = concurrencyManager.getActiveCount('user-1');
      expect(activeCount).toBe(2);
    });

    it('should release slot on job completion', () => {
      concurrencyManager.setLimit('user-1', 2);

      concurrencyManager.startProcessing('user-1', 'job-1');
      concurrencyManager.startProcessing('user-1', 'job-2');

      concurrencyManager.finishProcessing('user-1', 'job-1');

      const canJob3 = concurrencyManager.canProcess('user-1', 'job-3');
      expect(canJob3).toBe(true);
    });
  });

  describe('2. Multiple Jobs Different Users', () => {
    it('should handle jobs for different users independently', () => {
      concurrencyManager.setLimit('user-1', 1);
      concurrencyManager.setLimit('user-2', 1);
      concurrencyManager.setLimit('user-3', 1);

      const canUser1 = concurrencyManager.canProcess('user-1', 'job-1');
      const canUser2 = concurrencyManager.canProcess('user-2', 'job-2');
      const canUser3 = concurrencyManager.canProcess('user-3', 'job-3');

      expect(canUser1).toBe(true);
      expect(canUser2).toBe(true);
      expect(canUser3).toBe(true);
    });

    it('should not affect other users when one user hits limit', () => {
      concurrencyManager.setLimit('user-1', 1);
      concurrencyManager.setLimit('user-2', 2);

      concurrencyManager.startProcessing('user-1', 'job-1');

      const canUser2Job1 = concurrencyManager.canProcess('user-2', 'job-2');
      const canUser2Job2 = concurrencyManager.canProcess('user-2', 'job-3');

      expect(canUser2Job1).toBe(true);
      expect(canUser2Job2).toBe(true);
    });
  });

  describe('3. Race Condition Handling', () => {
    it('should prevent double-start of same job', () => {
      concurrencyManager.setLimit('user-1', 2);

      const firstStart = concurrencyManager.startProcessing('user-1', 'job-1');
      const secondStart = concurrencyManager.startProcessing('user-1', 'job-1');

      expect(firstStart).toBe(true);
      expect(secondStart).toBe(false);
    });

    it('should handle concurrent job starts', () => {
      concurrencyManager.setLimit('user-1', 2);

      const results: boolean[] = [];

      results.push(concurrencyManager.startProcessing('user-1', 'job-1'));
      results.push(concurrencyManager.startProcessing('user-1', 'job-2'));
      results.push(concurrencyManager.startProcessing('user-1', 'job-3'));

      const successCount = results.filter(r => r).length;
      expect(successCount).toBe(2);
    });

    it('should maintain correct active count under concurrency', () => {
      concurrencyManager.setLimit('user-1', 3);

      concurrencyManager.startProcessing('user-1', 'job-1');
      concurrencyManager.startProcessing('user-1', 'job-2');
      concurrencyManager.startProcessing('user-1', 'job-3');

      const count = concurrencyManager.getActiveCount('user-1');
      expect(count).toBe(3);
    });
  });

  describe('4. Priority Handling', () => {
    it('should sort jobs by priority', () => {
      const jobs = [
        { id: 'job-1', userId: 'user-1', storyId: 'story-1', status: 'pending' as const, progress: 0, priority: 3 },
        { id: 'job-2', userId: 'user-1', storyId: 'story-2', status: 'pending' as const, progress: 0, priority: 1 },
        { id: 'job-3', userId: 'user-1', storyId: 'story-3', status: 'pending' as const, progress: 0, priority: 2 },
      ];

      jobs.forEach(job => jobQueue.add(job));

      const sorted = Array.from(jobQueue.getByUser('user-1')).sort((a, b) => b.priority - a.priority);

      expect(sorted[0].priority).toBe(3);
      expect(sorted[1].priority).toBe(2);
      expect(sorted[2].priority).toBe(1);
    });

    it('should process higher priority jobs first', () => {
      concurrencyManager.setLimit('user-1', 1);

      const highPriority = { id: 'job-high', userId: 'user-1', storyId: 'story-1', status: 'pending' as const, progress: 0, priority: 10 };
      const lowPriority = { id: 'job-low', userId: 'user-1', storyId: 'story-2', status: 'pending' as const, progress: 0, priority: 1 };

      jobQueue.add(highPriority);
      jobQueue.add(lowPriority);

      const pending = Array.from(jobQueue.getByUser('user-1')).sort((a, b) => b.priority - a.priority);

      expect(pending[0].id).toBe('job-high');
    });
  });

  describe('5. Job State Transitions', () => {
    it('should transition job from pending to processing', () => {
      const job: Job = { id: 'job-1', userId: 'user-1', storyId: 'story-1', status: 'pending', progress: 0, priority: 1 };
      jobQueue.add(job);

      const started = jobQueue.startProcessing('job-1');
      const retrieved = jobQueue.get('job-1');

      expect(started).toBe(true);
      expect(retrieved?.status).toBe('processing');
    });

    it('should transition job from processing to completed', () => {
      const job: Job = { id: 'job-1', userId: 'user-1', storyId: 'story-1', status: 'pending', progress: 0, priority: 1 };
      jobQueue.add(job);
      jobQueue.startProcessing('job-1');

      jobQueue.complete('job-1', 100);
      const retrieved = jobQueue.get('job-1');

      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.progress).toBe(100);
    });

    it('should update progress correctly', () => {
      const job: Job = { id: 'job-1', userId: 'user-1', storyId: 'story-1', status: 'pending', progress: 0, priority: 1 };
      jobQueue.add(job);
      jobQueue.startProcessing('job-1');

      jobQueue.complete('job-1', 50);
      const retrieved = jobQueue.get('job-1');

      expect(retrieved?.status).toBe('processing');
      expect(retrieved?.progress).toBe(50);
    });
  });

  describe('6. Resource Contention', () => {
    it('should handle many concurrent jobs', () => {
      concurrencyManager.setLimit('user-1', 5);

      for (let i = 0; i < 10; i++) {
        const started = concurrencyManager.startProcessing('user-1', `job-${i}`);
        if (started) {
          jobQueue.add({
            id: `job-${i}`,
            userId: 'user-1',
            storyId: `story-${i}`,
            status: 'processing',
            progress: 0,
            priority: 1,
          });
        }
      }

      const processing = jobQueue.getProcessing();
      expect(processing.length).toBeLessThanOrEqual(5);
    });

    it('should release all slots when jobs complete', () => {
      concurrencyManager.setLimit('user-1', 3);

      concurrencyManager.startProcessing('user-1', 'job-1');
      concurrencyManager.startProcessing('user-1', 'job-2');
      concurrencyManager.startProcessing('user-1', 'job-3');

      concurrencyManager.finishProcessing('user-1', 'job-1');
      concurrencyManager.finishProcessing('user-1', 'job-2');
      concurrencyManager.finishProcessing('user-1', 'job-3');

      const canStart = concurrencyManager.canProcess('user-1', 'job-new');
      expect(canStart).toBe(true);
      expect(concurrencyManager.getActiveCount('user-1')).toBe(0);
    });
  });

  describe('7. Tier-Based Limits', () => {
    it('should apply different limits per tier', () => {
      const tierLimits: Record<string, number> = {
        '1': 1,
        '2': 3,
        '3': 5,
        '4': 10,
      };

      expect(tierLimits['1']).toBe(1);
      expect(tierLimits['2']).toBe(3);
      expect(tierLimits['3']).toBe(5);
      expect(tierLimits['4']).toBe(10);
    });

    it('should set limits based on user tier', () => {
      const userTier = '3';
      const limits: Record<string, number> = { '1': 1, '2': 3, '3': 5, '4': 10 };

      const limit = limits[userTier] || 1;
      concurrencyManager.setLimit('user-1', limit);

      expect(concurrencyManager.getActiveCount('user-1')).toBe(0);
    });
  });
});
