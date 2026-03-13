// Durable Object Helpers - Safe DO interactions with validation

import { DurableObjectStub } from '@cloudflare/workers-types';
import { Logger } from './logger';
import { AppError } from './error-handling';

export async function fetchDOWithValidation<T>(
  coordinator: DurableObjectStub,
  request: Request,
  logger: Logger
): Promise<T> {
  let response: Response;
  
  try {
    response = await coordinator.fetch(request);
  } catch (error) {
    logger.error('[DO] Failed to fetch from Durable Object', error, {
      url: request.url,
      method: request.method,
    });
    throw new AppError('Durable Object fetch failed', {
      code: 'DO_FETCH_ERROR',
      retryable: true,
    });
  }
  
  if (!response.ok) {
    let errorText: string;
    try {
      errorText = await response.text();
    } catch {
      errorText = 'Unable to read error response';
    }
    
    logger.error('[DO] Durable Object returned error response', new Error(errorText), {
      status: response.status,
      statusText: response.statusText,
      url: request.url,
    });
    
    // Determine if error is retryable based on status code
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    const isRetryable = retryableStatusCodes.includes(response.status);
    
    throw new AppError(`Durable Object error: ${response.status} ${response.statusText}`, {
      code: 'DO_ERROR',
      retryable: isRetryable,
      context: { status: response.status, errorText },
    });
  }
  
  try {
    return await response.json() as T;
  } catch (error) {
    logger.error('[DO] Failed to parse Durable Object response as JSON', error, {
      url: request.url,
    });
    throw new AppError('Invalid JSON response from Durable Object', {
      code: 'DO_PARSE_ERROR',
      retryable: false,
    });
  }
}

export async function fetchDOSafe<T>(
  coordinator: DurableObjectStub,
  endpoint: string,
  body: unknown,
  logger: Logger
): Promise<T> {
  const request = new Request(`http://do${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  return fetchDOWithValidation<T>(coordinator, request, logger);
}
