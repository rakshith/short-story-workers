// Metrics Collection - Structured logging for Cloudflare Analytics
// Uses Cloudflare's native analytics via structured console logs
// These can be ingested by Logpush or viewed in Cloudflare Dashboard

import { Logger } from './logger';

export interface MetricLabels {
  [key: string]: string | number | boolean | undefined;
}

export class Metrics {
  private static instance: Metrics;
  private logger: Logger;
  private buffer: Map<string, number> = new Map();
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('Metrics');
    this.startAutoFlush();
  }

  static getInstance(logger?: Logger): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics(logger);
    }
    return Metrics.instance;
  }

  /**
   * Increment a counter metric
   * Format: [METRIC] counter{name="xxx",labels...} value
   */
  increment(name: string, value = 1, labels?: MetricLabels): void {
    const key = this.formatKey(name, labels);
    const current = this.buffer.get(key) || 0;
    this.buffer.set(key, current + value);
    
    // Log immediately for real-time visibility
    this.logger.info(`[METRIC] counter{name="${name}"${this.formatLabels(labels)}} ${value}`);
  }

  /**
   * Record a timing metric
   * Format: [METRIC] timing{name="xxx",labels...} value_ms
   */
  timing(name: string, durationMs: number, labels?: MetricLabels): void {
    this.logger.info(`[METRIC] timing{name="${name}"${this.formatLabels(labels)}} ${Math.round(durationMs)}`);
  }

  /**
   * Record a gauge metric (current value)
   * Format: [METRIC] gauge{name="xxx",labels...} value
   */
  gauge(name: string, value: number, labels?: MetricLabels): void {
    this.logger.info(`[METRIC] gauge{name="${name}"${this.formatLabels(labels)}} ${value}`);
  }

  /**
   * Log an event (discrete occurrence)
   * Format: [METRIC] event{type="xxx",labels...} "description"
   */
  event(type: string, description: string, labels?: MetricLabels): void {
    this.logger.info(`[METRIC] event{type="${type}"${this.formatLabels(labels)}} "${description}"`);
  }

  /**
   * Track queue depth
   */
  queueDepth(queueName: string, depth: number): void {
    this.gauge('queue_depth', depth, { queue: queueName });
  }

  /**
   * Track job processing duration
   */
  jobDuration(jobType: string, durationMs: number, status: 'success' | 'failure'): void {
    this.timing('job_duration_ms', durationMs, { type: jobType, status });
  }

  /**
   * Track external API latency
   */
  apiLatency(service: string, endpoint: string, durationMs: number, statusCode: number): void {
    this.timing('api_latency_ms', durationMs, {
      service,
      endpoint,
      status: String(statusCode),
    });
  }

  /**
   * Track error rate
   */
  error(service: string, errorType: string, retryable: boolean): void {
    this.increment('errors_total', 1, {
      service,
      type: errorType,
      retryable: String(retryable),
    });
  }

  /**
   * Track circuit breaker state changes
   */
  circuitBreakerState(service: string, state: 'closed' | 'open' | 'half-open', failureCount: number): void {
    this.event('circuit_breaker_state_change', `Circuit breaker ${service} is now ${state}`, {
      service,
      state,
      failure_count: String(failureCount),
    });
  }

  /**
   * Track retry attempts
   */
  retryAttempt(operation: string, attempt: number, maxRetries: number): void {
    this.increment('retry_attempts_total', 1, {
      operation,
      attempt: String(attempt),
      max_retries: String(maxRetries),
    });
  }

  /**
   * Flush buffered metrics (called periodically)
   */
  flush(): void {
    if (this.buffer.size === 0) return;
    
    this.logger.info(`[METRIC] flush{metrics=${this.buffer.size}}`);
    
    // Log all buffered counters
    for (const [key, value] of this.buffer.entries()) {
      this.logger.info(`[METRIC] buffered_counter{key="${key}"} ${value}`);
    }
    
    this.buffer.clear();
  }

  private startAutoFlush(): void {
    // Flush every 60 seconds
    this.flushInterval = setInterval(() => this.flush(), 60000);
  }

  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private formatKey(name: string, labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private formatLabels(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return '';
    return Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `,${k}="${v}"`)
      .join('');
  }
}

// Convenience functions for common use cases
export const metrics = Metrics.getInstance();

export function trackJobStart(jobType: string, jobId: string): () => void {
  const startTime = Date.now();
  metrics.increment('jobs_started_total', 1, { type: jobType });
  
  return (status: 'success' | 'failure' = 'success') => {
    const duration = Date.now() - startTime;
    metrics.jobDuration(jobType, duration, status);
    metrics.increment('jobs_completed_total', 1, { type: jobType, status });
  };
}

export function trackAPICall<T>(
  service: string,
  endpoint: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return operation()
    .then(result => {
      metrics.apiLatency(service, endpoint, Date.now() - startTime, 200);
      return result;
    })
    .catch(error => {
      const statusCode = error instanceof Response ? error.status : 0;
      metrics.apiLatency(service, endpoint, Date.now() - startTime, statusCode || 500);
      throw error;
    });
}
