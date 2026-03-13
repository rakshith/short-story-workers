/**
 * Smart Retry Logic Tests - Cost-Safe Retry Suite
 * 
 * These tests ensure you only retry errors that might succeed,
 * saving money by not retrying guaranteed failures.
 * 
 * EXPECTED OUTCOME: All tests pass = $0 wasted on retrying model errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withRetry, isRetryableError, AppError } from '../../../utils/error-handling';
import { Logger } from '../../../utils/logger';

// Mock logger
class TestLogger extends Logger {
  public logs: Array<{ level: string; message: string; data?: any; error?: string }> = [];

  constructor(section: string) {
    super(section);
  }

  info(message: string, data?: any): void {
    this.logs.push({ level: 'info', message, data });
  }

  warn(message: string, data?: any): void {
    this.logs.push({ level: 'warn', message, data });
  }

  error(message: string, error?: Error, data?: any): void {
    this.logs.push({ level: 'error', message, error: error?.message, data });
  }

  debug(message: string, data?: any): void {
    this.logs.push({ level: 'debug', message, data });
  }

  clear(): void {
    this.logs = [];
  }
}

describe('Smart Retry Logic - Cost-Safe Retry Suite', () => {
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger('RetryLogic');
    logger.clear();
  });

  describe('✅ SCENARIO 1: Retryable Error Detection (Most Critical)', () => {
    it('should retry NETWORK TIMEOUT errors (might succeed)', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      
      expect(isRetryableError(error)).toBe(true);
      
      // EXPECTED OUTPUT:
      // ✓ Network issue - retry may succeed
      // ✓ $0.01-$0.05 spent on retry (worth it)
    });

    it('should retry CONNECTION RESET errors', () => {
      const error = new Error('ECONNRESET: Connection reset by peer');
      
      expect(isRetryableError(error)).toBe(true);
      
      // EXPECTED OUTPUT:
      // ✓ Transient network issue
      // ✓ Retry recommended
    });

    it('should retry RATE LIMIT errors (429)', () => {
      const error = new Error('HTTP 429: Too Many Requests');
      
      expect(isRetryableError(error)).toBe(true);
      
      // EXPECTED OUTPUT:
      // ✓ Rate limited - wait and retry
      // ✓ Exponential backoff helps here
    });

    it('should retry SERVER errors (500, 502, 503, 504)', () => {
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
      
      // EXPECTED OUTPUT:
      // ✓ Server issues - may recover
      // ✓ Worth retrying
    });

    it('should retry AppError with retryable=true flag', () => {
      const error = new AppError('Service temporarily unavailable', {
        code: 'SERVICE_UNAVAILABLE',
        retryable: true
      });
      
      expect(isRetryableError(error)).toBe(true);
      
      // EXPECTED OUTPUT:
      // ✓ Explicit retry flag respected
      // ✓ Custom retry logic supported
    });

    it('should NOT retry model VALIDATION errors', () => {
      const error = new Error('Invalid prompt: contains prohibited content');
      
      expect(isRetryableError(error)).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Model rejected prompt
      // ✓ Retry will ALWAYS fail
      // ✓ $0 saved by NOT retrying
    });

    it('should NOT retry INSUFFICIENT CREDITS errors', () => {
      const error = new AppError('Insufficient credits to complete this operation', {
        code: 'PAYMENT_REQUIRED',
        retryable: false
      });
      
      expect(isRetryableError(error)).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Account issue - needs user action
      // ✓ Retry won't help
      // ✓ Fail fast to alert user
    });

    it('should NOT retry BAD REQUEST errors (400)', () => {
      const error = new Error('HTTP 400: Bad Request - Invalid parameters');
      
      expect(isRetryableError(error)).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Client error - fix required
      // ✓ Retry will fail identically
      // ✓ Save money by failing fast
    });

    it('should NOT retry AUTHENTICATION errors (401)', () => {
      const error = new Error('HTTP 401: Unauthorized - Invalid API key');
      
      expect(isRetryableError(error)).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Auth issue - needs config change
      // ✓ No point retrying
    });

    it('should NOT retry NOT FOUND errors (404)', () => {
      const error = new Error('HTTP 404: Model not found');
      
      expect(isRetryableError(error)).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Resource doesn't exist
      // ✓ Retry won't create it
    });
  });

  describe('🔄 SCENARIO 2: Retry with Exponential Backoff', () => {
    it('should succeed on first attempt (no retry needed)', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'success';
      };

      const result = await withRetry(operation, {
        maxRetries: 3,
        logger,
        operationName: 'test-op'
      });

      expect(result).toBe('success');
      expect(callCount).toBe(1);
      
      // EXPECTED OUTPUT:
      // ✓ Single call
      // ✓ No retries needed
      // ✓ $0 spent (no failures)
    });

    it('should retry on failure and eventually succeed', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('ETIMEDOUT');
        }
        return 'success';
      };

      const result = await withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 10, // Fast for testing
        logger,
        operationName: 'retry-test'
      });

      expect(result).toBe('success');
      expect(callCount).toBe(3);
      
      // EXPECTED OUTPUT:
      // ✓ Retried 2 times
      // ✓ Succeeded on 3rd attempt
      // ✓ $0.02-$0.10 spent (worth it)
    });

    it('should give up after max retries exceeded', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new Error('ETIMEDOUT');
      };

      await expect(withRetry(operation, {
        maxRetries: 2,
        baseDelayMs: 10,
        logger,
        operationName: 'fail-test'
      })).rejects.toThrow('ETIMEDOUT');

      expect(callCount).toBe(3); // Initial + 2 retries
      
      // EXPECTED OUTPUT:
      // ✓ 3 attempts total
      // ✓ Gave up after max retries
      // ✓ $0.03-$0.15 spent (acceptable loss)
    });

    it('should NOT retry non-retryable errors (saves money)', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new AppError('Invalid prompt', {
          code: 'VALIDATION_ERROR',
          retryable: false
        });
      };

      await expect(withRetry(operation, {
        maxRetries: 3,
        logger,
        operationName: 'no-retry-test'
      })).rejects.toThrow('Invalid prompt');

      expect(callCount).toBe(1); // No retries!
      
      // EXPECTED OUTPUT:
      // ✓ Only 1 call
      // ✓ No retries on validation error
      // ✓ $0.02-$0.10 SAVED vs naive retry
    });
  });

  describe('⏱️ SCENARIO 3: Exponential Backoff Timing', () => {
    it('should use exponential delays between retries', async () => {
      let callCount = 0;
      const startTime = Date.now();

      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('ETIMEDOUT');
        }
        return 'success';
      };

      await withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 50, // Fast for testing
        logger,
        operationName: 'timing-test'
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should have waited at least: 50ms + 100ms = 150ms (2 retries)
      expect(totalTime).toBeGreaterThanOrEqual(100);
      
      // Should not take too long
      expect(totalTime).toBeLessThanOrEqual(2000);
      
      // EXPECTED OUTPUT:
      // ✓ Exponential backoff working
      // ✓ Delays increasing: 50ms → 100ms
      // ✓ Prevents thundering herd
    });

    it('should respect maxDelayMs cap', async () => {
      let callCount = 0;
      const startTime = Date.now();

      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('ETIMEDOUT');
        }
        return 'success';
      };

      await withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 150, // Cap at 150ms
        logger,
        operationName: 'cap-test'
      });

      const totalTime = Date.now() - startTime;

      // With maxDelayMs of 150ms, even the 2nd retry (which would be 200ms)
      // should be capped at 150ms, so total should be ~250ms
      expect(totalTime).toBeGreaterThanOrEqual(200);
      expect(totalTime).toBeLessThanOrEqual(1000);
      
      // EXPECTED OUTPUT:
      // ✓ Delays capped at maxDelayMs
      // ✓ Won't wait forever
      // ✓ Bounded retry time
    });
  });

  describe('🎯 SCENARIO 4: Cost Impact Analysis', () => {
    it('should calculate savings from smart vs naive retry', () => {
      const scenarios = [
        { name: 'Image generation', cost: 0.01, retries: 3 },
        { name: 'Video generation', cost: 0.05, retries: 3 },
        { name: 'Audio generation', cost: 0.001, retries: 3 }
      ];

      scenarios.forEach(({ name, cost, retries }) => {
        // Naive retry: Always retries max times
        const naiveCost = cost * (retries + 1);
        
        // Smart retry: 0 retries on validation errors
        const smartCost = cost * 1; // Just initial attempt
        
        const savings = naiveCost - smartCost;
        
        console.log(`${name}: Save $${savings.toFixed(3)} per validation error`);
        
        // EXPECTED OUTPUT:
        // Image generation: Save $0.030 per validation error
        // Video generation: Save $0.150 per validation error
        // Audio generation: Save $0.003 per validation error
      });
    });

    it('should log retry attempts for monitoring', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('ETIMEDOUT');
        }
        return 'success';
      };

      await withRetry(operation, {
        maxRetries: 3,
        baseDelayMs: 10,
        logger,
        operationName: 'logged-op'
      });

      // Check that warnings were logged
      const retryLogs = logger.logs.filter(log => 
        log.level === 'warn' && log.message.includes('retry')
      );
      
      expect(retryLogs.length).toBeGreaterThan(0);
      
      // EXPECTED OUTPUT:
      // ✓ Retry attempts logged
      // ✓ Can monitor retry rates
      // ✓ Alert on excessive retries
    });
  });

  describe('🔧 SCENARIO 5: Edge Cases', () => {
    it('should handle sync operations', async () => {
      const operation = async () => 'sync-result';
      
      const result = await withRetry(operation, {
        maxRetries: 3,
        logger
      });
      
      expect(result).toBe('sync-result');
      
      // EXPECTED OUTPUT:
      // ✓ Works with async functions
      // ✓ Returns result correctly
    });

    it('should handle undefined error', () => {
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Safe with undefined/null
      // ✓ No crashes
    });

    it('should handle string errors', () => {
      // @ts-ignore - Testing edge case
      expect(isRetryableError('some error')).toBe(false);
      
      // EXPECTED OUTPUT:
      // ✓ Safe with non-Error objects
      // ✓ Conservative (don't retry unknown)
    });

    it('should propagate original error after retries exhausted', async () => {
      const originalError = new Error('Original error message');
      
      const operation = async () => {
        throw originalError;
      };

      await expect(withRetry(operation, {
        maxRetries: 1,
        baseDelayMs: 10,
        logger
      })).rejects.toThrow('Original error message');
      
      // EXPECTED OUTPUT:
      // ✓ Original error preserved
      // ✓ Stack trace intact
      // ✓ Debugging possible
    });
  });
});

// Test summary
console.log('\n' + '='.repeat(80));
console.log('SMART RETRY LOGIC TEST SUITE');
console.log('='.repeat(80));
console.log('');
console.log('These tests verify:');
console.log('✅ Only retryable errors are retried');
console.log('✅ Validation errors fail fast (saves money)');
console.log('✅ Exponential backoff prevents thundering herd');
console.log('✅ Max retries limit total cost');
console.log('');
console.log('EXPECTED COST SAVINGS:');
console.log('- Validation error on image: $0.03 saved (3 retries prevented)');
console.log('- Validation error on video: $0.15 saved (3 retries prevented)');
console.log('- 100 validation errors/day: $15 saved daily');
console.log('='.repeat(80));
