// Circuit Breaker - prevents repeated failures

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeoutMs?: number;
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  constructor(
    private name: string,
    private failureThreshold = 5,
    private successThreshold = 2,
    private timeoutMs = 60000
  ) {}

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.close();
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
      this.open();
    } else if (this.state === 'half-open') {
      this.open();
    }
  }

  isAvailable(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.halfOpen();
        return false;
      }
      return false;
    }
    return true;
  }

  isClosed(): boolean {
    return this.state === 'closed';
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  private open(): void {
    this.state = 'open';
    console.log(`[CircuitBreaker] ${this.name} opened after ${this.failureCount} failures`);
  }

  private close(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    console.log(`[CircuitBreaker] ${this.name} closed`);
  }

  private halfOpen(): void {
    this.state = 'half-open';
    this.successCount = 0;
    console.log(`[CircuitBreaker] ${this.name} half-open`);
  }
}

export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name, options?.failureThreshold, options?.successThreshold, options?.timeoutMs);
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  reset(name?: string): void {
    if (name) {
      this.breakers.get(name)?.reset();
    } else {
      for (const breaker of this.breakers.values()) {
        breaker.reset();
      }
    }
  }

  list(): string[] {
    return Array.from(this.breakers.keys());
  }

  getAllStatus(): Array<{ name: string; state: 'closed' | 'open' | 'half-open'; failureCount: number }> {
    return Array.from(this.breakers.entries()).map(([name, breaker]) => ({
      name,
      state: breaker.getState(),
      failureCount: breaker.getFailureCount()
    }));
  }
}

function createCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker(name, options?.failureThreshold, options?.successThreshold, options?.timeoutMs);
}

function createCircuitBreakerRegistry(): CircuitBreakerRegistry {
  return new CircuitBreakerRegistry();
}
