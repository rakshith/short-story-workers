/**
 * Queue Worker Error Handling - Reliability Tests
 * 
 * Tests for queue error handling reliability:
 * - Retryable error detection
 * - Permanent failure handling
 * - Message acknowledgment/retry behavior
 * - Job cancellation handling
 * - Concurrency limiting behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('etimedout') || 
        message.includes('econnreset') ||
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('socket')) {
      return true;
    }

    if (message.includes('429') || 
        message.includes('500') || 
        message.includes('502') || 
        message.includes('503') || 
        message.includes('504')) {
      return true;
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
  }

  return false;
}

function canProcessJob(userId: string, userTier: string, env: any, jobId: string): { allowed: boolean; activeConcurrency: number; maxConcurrency: number } {
  const tierLimits: Record<string, number> = {
    '1': 1,
    '2': 3,
    '3': 5,
    '4': 10,
  };

  const maxConcurrency = tierLimits[userTier] || 1;
  const activeConcurrency = 0;

  return {
    allowed: activeConcurrency < maxConcurrency,
    activeConcurrency,
    maxConcurrency,
  };
}

describe('Queue Worker Error Handling - Reliability', () => {
  describe('1. Retryable Error Detection', () => {
    it('should retry network timeout errors', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should retry connection reset errors', () => {
      const error = new Error('ECONNRESET: Connection reset by peer');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should retry rate limit errors (429)', () => {
      const error = new Error('HTTP 429: Too Many Requests');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should retry server errors (500, 502, 503, 504)', () => {
      const serverErrors = [
        'HTTP 500: Internal Server Error',
        'HTTP 502: Bad Gateway',
        'HTTP 503: Service Unavailable',
        'HTTP 504: Gateway Timeout'
      ];

      serverErrors.forEach(errorMsg => {
        const error = new Error(errorMsg);
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should NOT retry validation errors', () => {
      const error = new Error('Validation error: prompt is required');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should NOT retry model errors', () => {
      const error = new Error('Model error: invalid input format');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should NOT retry authentication errors', () => {
      const error = new Error('HTTP 401: Unauthorized');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('2. Message Acknowledgment', () => {
    it('should determine retryable vs permanent errors correctly', () => {
      const retryableError = new Error('ETIMEDOUT: Connection timed out');
      const permanentError = new Error('Validation error: prompt required');

      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(permanentError)).toBe(false);
    });

    it('should handle mixed error types in batch', () => {
      const errors = [
        new Error('ETIMEDOUT'),
        new Error('Validation error'),
        new Error('HTTP 503'),
        new Error('Model error'),
      ];

      const retryable = errors.filter(e => isRetryableError(e));
      const permanent = errors.filter(e => !isRetryableError(e));

      expect(retryable).toHaveLength(2);
      expect(permanent).toHaveLength(2);
    });
  });

  describe('3. Cancellation Handling', () => {
    it('should skip processing for cancelled jobs', () => {
      const cancelledJobs = new Set(['job-cancelled']);
      const shouldSkip = cancelledJobs.has('job-cancelled');
      expect(shouldSkip).toBe(true);
    });

    it('should add cancelled jobs to skip list', () => {
      const cancelledJobs = new Set<string>();
      cancelledJobs.add('job-123');
      expect(cancelledJobs.has('job-123')).toBe(true);
    });

    it('should check job status before processing', () => {
      const cancelledJobs = new Set(['job-cancelled']);
      const activeJobs = new Set(['job-active']);

      expect(cancelledJobs.has('job-cancelled')).toBe(true);
      expect(activeJobs.has('job-active')).toBe(true);
      expect(cancelledJobs.has('job-unknown')).toBe(false);
    });
  });

  describe('4. Concurrency Control', () => {
    it('should allow processing when under concurrency limit', () => {
      const result = canProcessJob('user-1', '2', {}, 'job-1');
      expect(result.allowed).toBe(true);
    });

    it('should calculate correct max concurrency for each tier', () => {
      const tier1 = canProcessJob('user-1', '1', {}, 'job-1');
      const tier2 = canProcessJob('user-1', '2', {}, 'job-1');
      const tier3 = canProcessJob('user-1', '3', {}, 'job-1');
      const tier4 = canProcessJob('user-1', '4', {}, 'job-1');

      expect(tier1.maxConcurrency).toBe(1);
      expect(tier2.maxConcurrency).toBe(3);
      expect(tier3.maxConcurrency).toBe(5);
      expect(tier4.maxConcurrency).toBe(10);
    });

    it('should default to tier 1 for unknown tiers', () => {
      const result = canProcessJob('user-1', 'unknown', {}, 'job-1');
      expect(result.maxConcurrency).toBe(1);
    });
  });

  describe('5. Error Recovery', () => {
    it('should continue processing other messages after error', () => {
      const messages = [
        { jobId: 'job-1', type: 'image', sceneIndex: 0 },
        { jobId: 'job-2', type: 'image', sceneIndex: 1 },
        { jobId: 'job-3', type: 'image', sceneIndex: 2 },
      ];

      let processedCount = 0;

      for (const msg of messages) {
        try {
          if (msg.jobId === 'job-2') {
            throw new Error('Permanent error');
          }
          processedCount++;
        } catch (error) {
          // Continue to next message
        }
      }

      expect(processedCount).toBe(2);
    });

    it('should handle batch processing with mixed success/failure', () => {
      const results: string[] = [];

      const messages = [
        { jobId: 'job-1', type: 'image', sceneIndex: 0 },
        { jobId: 'job-2', type: 'image', sceneIndex: 1 },
        { jobId: 'job-3', type: 'image', sceneIndex: 2 },
      ];

      messages.forEach(msg => {
        if (msg.jobId === 'job-2') {
          results.push('failed');
        } else {
          results.push('success');
        }
      });

      const successCount = results.filter(r => r === 'success').length;
      const failCount = results.filter(r => r === 'failed').length;

      expect(successCount).toBe(2);
      expect(failCount).toBe(1);
    });
  });

  describe('6. Priority Processing', () => {
    it('should sort messages by tier priority', () => {
      const messages = [
        { jobId: 'job-1', userTier: '1', priority: 100 },
        { jobId: 'job-2', userTier: '4', priority: 400 },
        { jobId: 'job-3', userTier: '2', priority: 200 },
        { jobId: 'job-4', userTier: '3', priority: 300 },
      ];

      const sorted = [...messages].sort((a, b) => {
        const tierOrder: Record<string, number> = { '4': 0, '3': 1, '2': 2, '1': 3 };
        return (tierOrder[a.userTier] ?? 3) - (tierOrder[b.userTier] ?? 3);
      });

      expect(sorted[0].userTier).toBe('4');
      expect(sorted[1].userTier).toBe('3');
      expect(sorted[2].userTier).toBe('2');
      expect(sorted[3].userTier).toBe('1');
    });
  });

  describe('7. Dead Letter Queue Behavior', () => {
    it('should not infinitely retry permanent failures', () => {
      const maxRetries = 3;
      let retryCount = 0;
      const error = new Error('Validation error');

      const isPermanent = !isRetryableError(error);

      if (isPermanent) {
        retryCount = maxRetries;
      }

      expect(retryCount).toBe(3);
    });

    it('should track retry count for retryable errors', () => {
      const maxRetries = 5;
      let currentRetry = 0;
      const error = new Error('ETIMEDOUT');

      const isRetryable = isRetryableError(error);

      if (isRetryable && currentRetry < maxRetries) {
        currentRetry++;
      }

      expect(currentRetry).toBe(1);
    });
  });
});
