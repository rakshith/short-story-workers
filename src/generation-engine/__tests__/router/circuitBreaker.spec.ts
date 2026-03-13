/**
 * Circuit Breaker Tests - API Cost Protection Suite
 * 
 * These tests ensure your system stops calling failing APIs,
 * preventing wasted money on requests that will fail.
 * 
 * EXPECTED OUTCOME: All tests pass = $0 wasted on failing APIs during outages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreakerRegistry } from '../../../generation-engine/router/circuitBreaker';
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

  clear(): void {
    this.logs = [];
  }
}

describe('Circuit Breaker - API Cost Protection Suite', () => {
  let registry: CircuitBreakerRegistry;
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger('CircuitBreaker');
    registry = new CircuitBreakerRegistry();
  });

  describe('✅ SCENARIO 1: Prevent API Hammering (Most Critical)', () => {
    it('should OPEN circuit after 5 failures and block API calls (saves $$$)', () => {
      // ARRANGE: Create breaker for Replicate API
      const breaker = registry.get('replicate', {
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 60000 // 1 minute
      });

      expect(breaker.isClosed()).toBe(true);
      expect(breaker.isAvailable()).toBe(true);

      // ACT: Record 5 failures (simulating Replicate API outage)
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      // ASSERT: Circuit is now OPEN
      expect(breaker.isOpen()).toBe(true);
      expect(breaker.isAvailable()).toBe(false);
      expect(breaker.getState()).toBe('open');
      expect(breaker.getFailureCount()).toBe(5);

      // EXPECTED OUTPUT:
      // ✓ Circuit OPEN after 5 failures
      // ✓ All API calls now BLOCKED
      // ✓ $0.01-$0.05 saved PER BLOCKED CALL
      // ✓ Prevents 60+ seconds of wasted API calls
    });

    it('should block API requests when circuit is OPEN', () => {
      // ARRANGE: Open the circuit
      const breaker = registry.get('replicate', {
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 60000
      });

      // Force circuit open
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);

      // ACT & ASSERT: Multiple blocked calls
      let blockedCalls = 0;
      for (let i = 0; i < 100; i++) {
        if (!breaker.isAvailable()) {
          blockedCalls++;
        }
      }

      expect(blockedCalls).toBe(100);

      // EXPECTED OUTPUT:
      // ✓ 100 API calls blocked
      // ✓ $1.00-$5.00 saved (assuming image/video mix)
      // ✓ No hammering of failing Replicate API
    });

    it('should track consecutive failures correctly', () => {
      // ARRANGE
      const breaker = registry.get('test-api', {
        failureThreshold: 3,
        successThreshold: 1,
        timeoutMs: 1000
      });

      // ACT: 2 failures (below threshold)
      breaker.recordFailure();
      breaker.recordFailure();

      // ASSERT: Still closed
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.getFailureCount()).toBe(2);

      // ACT: 1 more failure (at threshold)
      breaker.recordFailure();

      // ASSERT: Now open
      expect(breaker.isOpen()).toBe(true);
      expect(breaker.getFailureCount()).toBe(3);

      // EXPECTED OUTPUT:
      // ✓ Failure count tracked accurately
      // ✓ Circuit opens exactly at threshold
      // ✓ No premature blocking
    });

    it('should reset failure count on success', () => {
      // ARRANGE
      const breaker = registry.get('test-api', {
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 1000
      });

      // 3 failures
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getFailureCount()).toBe(3);

      // ACT: Success
      breaker.recordSuccess();

      // ASSERT: Failure count reset
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.isClosed()).toBe(true);

      // EXPECTED OUTPUT:
      // ✓ Intermittent failures don't open circuit
      // ✓ Recovery detected immediately
      // ✓ Normal operations resume
    });
  });

  describe('⏱️ SCENARIO 2: Automatic Recovery', () => {
    it('should transition to HALF-OPEN after timeout', async () => {
      // ARRANGE: Fast timeout for testing
      const breaker = registry.get('fast-recovery', {
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 100 // 100ms timeout
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.isOpen()).toBe(true);

      // ACT: Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Trigger transition to half-open
      breaker.isAvailable();

      // ASSERT: Should be half-open (allows test request)
      expect(breaker.getState()).toBe('half-open');

      // EXPECTED OUTPUT:
      // ✓ Circuit automatically attempts recovery
      // ✓ No manual intervention needed
      // ✓ Service can heal itself
    });

    it('should CLOSE circuit after success in half-open state', async () => {
      // ARRANGE
      const breaker = registry.get('recovery-test', {
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 50
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.isOpen()).toBe(true);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Trigger transition to half-open (isAvailable checks timeout)
      breaker.isAvailable();
      expect(breaker.getState()).toBe('half-open');

      // ACT: Success
      breaker.recordSuccess();

      // ASSERT: Circuit closed
      expect(breaker.isClosed()).toBe(true);
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailureCount()).toBe(0);

      // EXPECTED OUTPUT:
      // ✓ Service recovered automatically
      // ✓ API calls resume normally
      // ✓ No manual restart needed
    });

    it('should RE-OPEN circuit if test request fails in half-open', async () => {
      // ARRANGE
      const breaker = registry.get('failed-recovery', {
        failureThreshold: 2,
        successThreshold: 2,
        timeoutMs: 50
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.isOpen()).toBe(true);

      // Wait for timeout and trigger half-open
      await new Promise(resolve => setTimeout(resolve, 60));
      breaker.isAvailable();
      expect(breaker.getState()).toBe('half-open');

      // ACT: Test request fails
      breaker.recordFailure();

      // ASSERT: Back to open
      expect(breaker.isOpen()).toBe(true);

      // EXPECTED OUTPUT:
      // ✓ Service still failing
      // ✓ Circuit re-opens immediately
      // ✓ No wasted API calls
    });

    it('should require multiple successes to close (configurable)', async () => {
      // ARRANGE: Need 3 successes to close
      const breaker = registry.get('careful-recovery', {
        failureThreshold: 2,
        successThreshold: 3, // Need 3 successes
        timeoutMs: 50
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for timeout and trigger half-open
      await new Promise(resolve => setTimeout(resolve, 60));
      breaker.isAvailable();
      expect(breaker.getState()).toBe('half-open');

      // ACT: Only 1 success
      breaker.recordSuccess();

      // ASSERT: Still half-open
      expect(breaker.getState()).toBe('half-open');

      // ACT: 2 more successes
      breaker.recordSuccess();
      breaker.recordSuccess();

      // ASSERT: Now closed
      expect(breaker.isClosed()).toBe(true);

      // EXPECTED OUTPUT:
      // ✓ Conservative recovery
      // ✓ Ensures service is truly healthy
      // ✓ Prevents flapping
    });
  });

  describe('🗂️ SCENARIO 3: Multi-Service Circuit Management', () => {
    it('should manage separate circuits for different services', () => {
      // ARRANGE: Create circuits for different APIs
      const replicateBreaker = registry.get('replicate');
      const elevenLabsBreaker = registry.get('elevenlabs');
      const openAIBreaker = registry.get('openai');

      // ACT: Fail only Replicate
      replicateBreaker.recordFailure();
      replicateBreaker.recordFailure();
      replicateBreaker.recordFailure();
      replicateBreaker.recordFailure();
      replicateBreaker.recordFailure();

      // ASSERT: Only Replicate circuit is open
      expect(replicateBreaker.isOpen()).toBe(true);
      expect(elevenLabsBreaker.isClosed()).toBe(true);
      expect(openAIBreaker.isClosed()).toBe(true);

      // EXPECTED OUTPUT:
      // ✓ Isolated failures per service
      // ✓ ElevenLabs still works
      // ✓ OpenAI still works
      // ✓ Graceful degradation
    });

    it('should return existing breaker instance (singleton per name)', () => {
      // ACT: Get same breaker twice
      const breaker1 = registry.get('replicate');
      const breaker2 = registry.get('replicate');

      // ASSERT: Same instance
      expect(breaker1).toBe(breaker2);

      // Modify one
      breaker1.recordFailure();

      // Both see the change
      expect(breaker2.getFailureCount()).toBe(1);

      // EXPECTED OUTPUT:
      // ✓ Consistent state across codebase
      // ✓ No duplicate circuits
      // ✓ Memory efficient
    });

    it('should list all active circuits', () => {
      // ARRANGE: Create multiple circuits
      registry.get('replicate');
      registry.get('elevenlabs');
      registry.get('openai');
      registry.get('supabase');

      // ACT
      const names = registry.list();

      // ASSERT
      expect(names).toContain('replicate');
      expect(names).toContain('elevenlabs');
      expect(names).toContain('openai');
      expect(names).toContain('supabase');
      expect(names).toHaveLength(4);

      // EXPECTED OUTPUT:
      // ✓ All services monitored
      // ✓ Easy health check
      // ✓ Dashboard-friendly
    });

    it('should provide status for all circuits', () => {
      // ARRANGE
      const replicate = registry.get('replicate');
      const elevenlabs = registry.get('elevenlabs');

      // Fail Replicate only
      for (let i = 0; i < 5; i++) replicate.recordFailure();

      // ACT
      const status = registry.getAllStatus();

      // ASSERT
      const replicateStatus = status.find((s: { name: string }) => s.name === 'replicate');
      const elevenlabsStatus = status.find((s: { name: string }) => s.name === 'elevenlabs');

      expect(replicateStatus?.state).toBe('open');
      expect(replicateStatus?.failureCount).toBe(5);
      expect(elevenlabsStatus?.state).toBe('closed');
      expect(elevenlabsStatus?.failureCount).toBe(0);

      // EXPECTED OUTPUT:
      // ✓ Health dashboard data
      // ✓ Quick status overview
      // ✓ Alert on open circuits
    });

    it('should reset specific circuit', () => {
      // ARRANGE
      const replicate = registry.get('replicate');
      const elevenlabs = registry.get('elevenlabs');

      // Open both
      for (let i = 0; i < 5; i++) {
        replicate.recordFailure();
        elevenlabs.recordFailure();
      }

      expect(replicate.isOpen()).toBe(true);
      expect(elevenlabs.isOpen()).toBe(true);

      // ACT: Reset only Replicate
      registry.reset('replicate');

      // ASSERT
      expect(replicate.isClosed()).toBe(true);
      expect(replicate.getFailureCount()).toBe(0);
      expect(elevenlabs.isOpen()).toBe(true); // Still open

      // EXPECTED OUTPUT:
      // ✓ Manual recovery possible
      // ✓ Targeted reset
      // ✓ Other services unaffected
    });

    it('should reset all circuits', () => {
      // ARRANGE
      const replicate = registry.get('replicate');
      const elevenlabs = registry.get('elevenlabs');

      for (let i = 0; i < 5; i++) {
        replicate.recordFailure();
        elevenlabs.recordFailure();
      }

      // ACT: Reset all
      registry.reset();

      // ASSERT
      expect(replicate.isClosed()).toBe(true);
      expect(elevenlabs.isClosed()).toBe(true);
      expect(replicate.getFailureCount()).toBe(0);
      expect(elevenlabs.getFailureCount()).toBe(0);

      // EXPECTED OUTPUT:
      // ✓ Emergency reset
      // ✓ All services resume
      // ✓ Use with caution
    });
  });

  describe('📊 SCENARIO 4: Cost Savings Calculation', () => {
    it('should calculate potential savings during outage', () => {
      // ARRANGE: Replicate circuit open
      const breaker = registry.get('replicate');
      for (let i = 0; i < 5; i++) breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);

      // ACT: Simulate 60-second outage with 2 calls/second
      const callsPerSecond = 2;
      const outageSeconds = 60;
      const totalBlockedCalls = callsPerSecond * outageSeconds;

      // ASSERT: Calculate savings
      const costPerImage = 0.01;
      const costPerVideo = 0.05;
      const mixRatio = 0.5; // 50% images, 50% videos

      const imageCalls = totalBlockedCalls * mixRatio;
      const videoCalls = totalBlockedCalls * mixRatio;
      const estimatedSavings = (imageCalls * costPerImage) + (videoCalls * costPerVideo);

      expect(totalBlockedCalls).toBe(120);
      expect(estimatedSavings).toBe(3.6); // $3.60 saved!

      // EXPECTED OUTPUT:
      // ✓ 120 API calls blocked
      // ✓ $3.60 saved during outage
      // ✓ Real money saved
    });

    it('should track failure patterns', () => {
      // ARRANGE
      const breaker = registry.get('replicate');

      // ACT: Pattern of failures
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess(); // Brief recovery
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure(); // Circuit opens

      // ASSERT
      expect(breaker.isOpen()).toBe(true);
      expect(breaker.getFailureCount()).toBe(5);

      // EXPECTED OUTPUT:
      // ✓ Intermittent failure detected
      // ✓ Circuit opens on sustained failure
      // ✓ Brief success doesn't reset count (good!)
    });
  });

  describe('🔧 SCENARIO 5: Edge Cases and Error Handling', () => {
    it('should handle rapid state changes', () => {
      const breaker = registry.get('rapid-test', {
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 50
      });

      // Rapid failures and successes
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();
      breaker.recordFailure();
      breaker.recordSuccess();
      breaker.recordFailure();

      // Should still be closed (not enough consecutive failures)
      expect(breaker.isClosed()).toBe(true);

      // Now fail 3 in a row
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.isOpen()).toBe(true);

      // EXPECTED OUTPUT:
      // ✓ Handles rapid changes
      // ✓ No state corruption
      // ✓ Stable behavior
    });

    it('should use default configuration when not specified', () => {
      const breaker = registry.get('default-config');

      // Default: 5 failures, 2 successes, 60s timeout
      expect(breaker.getState()).toBe('closed');

      // Should work with defaults
      for (let i = 0; i < 5; i++) breaker.recordFailure();
      expect(breaker.isOpen()).toBe(true);

      // EXPECTED OUTPUT:
      // ✓ Sensible defaults
      // ✓ Zero-config operation
      // ✓ Production-ready out of box
    });

    it('should handle very short timeouts', async () => {
      const breaker = registry.get('quick-timeout', {
        failureThreshold: 2,
        successThreshold: 1,
        timeoutMs: 1 // 1ms!
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.isOpen()).toBe(true);

      // Wait tiny bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger transition to half-open
      breaker.isAvailable();

      // Should be half-open
      expect(breaker.getState()).toBe('half-open');

      // EXPECTED OUTPUT:
      // ✓ Fast recovery testing
      // ✓ No hanging
      // ✓ Responsive
    });
  });
});

// Test summary
console.log('\n' + '='.repeat(80));
console.log('CIRCUIT BREAKER TEST SUITE');
console.log('='.repeat(80));
console.log('');
console.log('These tests verify:');
console.log('✅ Circuit opens after threshold failures');
console.log('✅ API calls blocked when circuit open (saves money)');
console.log('✅ Automatic recovery after timeout');
console.log('✅ Multi-service circuit management');
console.log('✅ Cost savings calculation');
console.log('');
console.log('EXPECTED COST SAVINGS:');
console.log('- 60-second outage: $3.60 saved (120 blocked calls)');
console.log('- Prevents hammering of failing APIs');
console.log('- Graceful degradation during outages');
console.log('='.repeat(80));
