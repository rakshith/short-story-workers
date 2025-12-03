// Enhanced logging utility for debugging and monitoring

export interface LogContext {
  jobId?: string;
  sceneIndex?: number;
  userId?: string;
  type?: string;
  [key: string]: any;
}

export class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    const prefix = this.prefix ? `[${this.prefix}]` : '';
    return `${timestamp} ${prefix} [${level}] ${message} ${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : { error: String(error) };
    
    console.error(this.formatMessage('ERROR', message, { ...context, ...errorDetails }));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  debug(message: string, context?: LogContext): void {
    console.log(this.formatMessage('DEBUG', message, context));
  }

  // Log API calls with timing
  async logApiCall<T>(
    name: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    this.info(`API Call Started: ${name}`, context);
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`API Call Success: ${name}`, { ...context, duration: `${duration}ms` });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`API Call Failed: ${name}`, error, { ...context, duration: `${duration}ms` });
      throw error;
    }
  }
}

// Create logger instances for different modules
export const queueLogger = new Logger('Queue Consumer');
export const processorLogger = new Logger('Queue Processor');
export const apiLogger = new Logger('API');

