// Alerting Service - Sends email notifications for critical system events

import { Env } from '../types/env';
import { Logger } from './logger';

export interface AlertOptions {
  severity: 'critical' | 'warning' | 'info';
  service: string;
  message: string;
  details?: Record<string, unknown>;
  jobId?: string;
  userId?: string;
}

export class AlertingService {
  private env: Env;
  private logger: Logger;
  private alertHistory: Map<string, number> = new Map(); // Track last alert time
  private readonly COOLDOWN_MS = 300000; // 5 minutes between same alerts

  constructor(env: Env, logger?: Logger) {
    this.env = env;
    this.logger = logger || new Logger('Alerting');
  }

  /**
   * Send an alert for critical failures
   * Uses rate limiting to prevent alert spam
   */
  async sendAlert(options: AlertOptions): Promise<boolean> {
    const { severity, service, message, details, jobId, userId } = options;
    
    // Generate alert key for deduplication
    const alertKey = `${severity}:${service}:${message}`;
    const lastAlert = this.alertHistory.get(alertKey);
    const now = Date.now();
    
    // Rate limiting - don't send same alert within cooldown period
    if (lastAlert && now - lastAlert < this.COOLDOWN_MS) {
      this.logger.warn(`[Alert] Skipping duplicate alert (cooldown): ${alertKey}`);
      return false;
    }
    
    // Log the alert
    this.logger.error(`[ALERT:${severity.toUpperCase()}] ${service}: ${message}`, undefined, {
      service,
      severity,
      jobId,
      userId,
      details,
      timestamp: new Date().toISOString(),
    });
    
    // Only send emails for critical alerts
    if (severity === 'critical') {
      await this.sendEmailAlert(options);
    }
    
    // Update alert history
    this.alertHistory.set(alertKey, now);
    
    return true;
  }

  /**
   * Alert when circuit breaker opens
   */
  async circuitBreakerOpened(service: string, failureCount: number): Promise<void> {
    await this.sendAlert({
      severity: 'critical',
      service: 'CircuitBreaker',
      message: `Circuit breaker OPENED for ${service} after ${failureCount} failures`,
      details: { failureCount, service },
    });
  }

  /**
   * Alert when DLQ receives messages
   */
  async dlqMessageReceived(queueName: string, messageCount: number, jobId?: string): Promise<void> {
    await this.sendAlert({
      severity: 'critical',
      service: 'DeadLetterQueue',
      message: `${messageCount} message(s) sent to DLQ: ${queueName}`,
      details: { queueName, messageCount },
      jobId,
    });
  }

  /**
   * Alert on health check failure
   */
  async healthCheckFailed(failedServices: string[]): Promise<void> {
    await this.sendAlert({
      severity: 'critical',
      service: 'HealthCheck',
      message: `Health check FAILED for services: ${failedServices.join(', ')}`,
      details: { failedServices },
    });
  }

  /**
   * Alert on high error rate
   */
  async highErrorRate(service: string, errorRate: number, threshold: number): Promise<void> {
    await this.sendAlert({
      severity: 'warning',
      service,
      message: `High error rate detected: ${(errorRate * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(1)}%)`,
      details: { errorRate, threshold },
    });
  }

  /**
   * Alert on job failure after max retries
   */
  async jobPermanentlyFailed(jobId: string, jobType: string, error: string, userId?: string): Promise<void> {
    await this.sendAlert({
      severity: 'critical',
      service: 'JobProcessing',
      message: `Job ${jobId} permanently failed after max retries`,
      details: { jobType, error },
      jobId,
      userId,
    });
  }

  /**
   * Alert on external API outage
   */
  async externalAPIOutage(service: string, statusCode: number, errorMessage: string): Promise<void> {
    await this.sendAlert({
      severity: 'critical',
      service: 'ExternalAPI',
      message: `${service} API outage detected`,
      details: { statusCode, errorMessage },
    });
  }

  /**
   * Send email alert via the existing email service
   */
  private async sendEmailAlert(options: AlertOptions): Promise<void> {
    try {
      if (!this.env.APP_URL) {
        this.logger.warn('[Alert] Cannot send email - APP_URL not configured');
        return;
      }

      const alertEmail = (this.env as any).ALERT_EMAIL || 'ops@artflicks.app';
      
      const emailBody = this.formatAlertEmail(options);
      
      const response = await fetch(`${this.env.APP_URL}/api/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: alertEmail,
          templateId: 'system-alert',
          variables: {
            ALERT_SEVERITY: options.severity.toUpperCase(),
            ALERT_SERVICE: options.service,
            ALERT_MESSAGE: options.message,
            ALERT_DETAILS: JSON.stringify(options.details || {}, null, 2),
            ALERT_TIME: new Date().toISOString(),
            JOB_ID: options.jobId || 'N/A',
            USER_ID: options.userId || 'N/A',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('[Alert] Failed to send email alert:', new Error(errorText));
      } else {
        this.logger.info(`[Alert] Email alert sent to ${alertEmail}`);
      }
    } catch (error) {
      this.logger.error('[Alert] Error sending email alert:', error);
    }
  }

  private formatAlertEmail(options: AlertOptions): string {
    const lines = [
      `🚨 SYSTEM ALERT: ${options.severity.toUpperCase()}`,
      ``,
      `Service: ${options.service}`,
      `Message: ${options.message}`,
      `Time: ${new Date().toISOString()}`,
      ``,
    ];
    
    if (options.jobId) {
      lines.push(`Job ID: ${options.jobId}`);
    }
    
    if (options.userId) {
      lines.push(`User ID: ${options.userId}`);
    }
    
    if (options.details && Object.keys(options.details).length > 0) {
      lines.push(`Details:`);
      lines.push(JSON.stringify(options.details, null, 2));
    }
    
    return lines.join('\n');
  }
}

// Singleton instance
let alertingService: AlertingService | null = null;

export function getAlertingService(env: Env, logger?: Logger): AlertingService {
  if (!alertingService) {
    alertingService = new AlertingService(env, logger);
  }
  return alertingService;
}

export function resetAlertingService(): void {
  alertingService = null;
}
