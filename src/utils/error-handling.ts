// Error Handling Utilities - Standardized error handling across the application

import { Logger } from './logger';

export interface AppErrorOptions {
  code: string;
  retryable?: boolean;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  code: string;
  retryable: boolean;
  context?: Record<string, unknown>;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.context = options.context;
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  
  // Check for common retryable network/HTTP errors
  const retryableCodes = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
  ];
  
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    if (retryableCodes.some(code => errorMessage.includes(code.toLowerCase()))) {
      return true;
    }
    
    // Check for HTTP status codes in error message
    for (const statusCode of retryableStatusCodes) {
      if (errorMessage.includes(` ${statusCode} `) || errorMessage.includes(`status ${statusCode}`)) {
        return true;
      }
    }
  }
  
  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    logger?: Logger;
    operationName?: string;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    logger,
    operationName = 'operation',
  } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(error)) {
        // Calculate delay with exponential backoff and jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
        const delay = Math.min(exponentialDelay + jitter, maxDelayMs);
        
        logger?.warn(`[Retry] ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries,
        });
        
        await sleep(delay);
        continue;
      }
      
      // Not retryable or max retries reached
      throw error;
    }
  }
  
  throw lastError!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}
