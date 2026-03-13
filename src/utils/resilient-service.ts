// Resilient Service Wrapper - Combines Circuit Breaker + Retry Logic

import { CircuitBreakerRegistry } from '../generation-engine/router/circuitBreaker';
import { withRetry, AppError } from './error-handling';
import { Logger } from './logger';

export interface ResilientCallOptions {
  operationName: string;
  circuitBreakerName?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  logger?: Logger;
}

const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Makes a resilient external API call with circuit breaker and retry logic
 * This prevents cost spikes by stopping calls to failing services
 */
export async function resilientAPICall<T>(
  operation: () => Promise<T>,
  options: ResilientCallOptions
): Promise<T> {
  const {
    operationName,
    circuitBreakerName = operationName,
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    timeoutMs = 60000,
    logger,
  } = options;
  
  const breaker = circuitBreakerRegistry.get(circuitBreakerName, {
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 60000, // 1 minute cooldown
  });
  
  // Check if circuit breaker is open
  if (!breaker.isAvailable()) {
    const error = new AppError(
      `Circuit breaker is OPEN for ${circuitBreakerName} - too many failures`,
      {
        code: 'CIRCUIT_BREAKER_OPEN',
        retryable: true, // Will be retried by queue
      }
    );
    logger?.error(`[CircuitBreaker] ${circuitBreakerName} is OPEN`, error);
    throw error;
  }
  
  try {
    // Execute with timeout and retry
    const result = await Promise.race([
      withRetry(operation, {
        maxRetries,
        baseDelayMs,
        maxDelayMs,
        logger,
        operationName,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new AppError(`Operation ${operationName} timed out after ${timeoutMs}ms`, {
            code: 'TIMEOUT',
            retryable: true,
          }));
        }, timeoutMs);
      }),
    ]);
    
    // Record success
    breaker.recordSuccess();
    
    return result;
  } catch (error) {
    // Record failure in circuit breaker
    breaker.recordFailure();
    
    logger?.error(`[ResilientCall] ${operationName} failed after retries`, error, {
      circuitBreakerState: breaker.getState(),
      failureCount: breaker.getFailureCount(),
    });
    
    throw error;
  }
}

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus(): Array<{
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
}> {
  return circuitBreakerRegistry.list().map(name => {
    const breaker = circuitBreakerRegistry.get(name);
    return {
      name,
      state: breaker.getState(),
      failureCount: breaker.getFailureCount(),
    };
  });
}

/**
 * Reset a specific circuit breaker or all breakers
 */
export function resetCircuitBreaker(name?: string): void {
  circuitBreakerRegistry.reset(name);
}
