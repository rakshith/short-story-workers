// Event Logger - logs job events to Supabase

export type EventType = 
  | 'job_created'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'webhook_received'
  | 'retry_attempt';

export interface JobEvent {
  id?: string;
  jobId: string;
  storyId: string;
  userId: string;
  eventType: EventType;
  nodeId?: string;
  capability?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface EventLoggerOptions {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export class EventLogger {
  private supabaseUrl: string;
  private supabaseServiceKey: string;
  private buffer: JobEvent[] = [];
  private flushInterval: number | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private readonly MAX_BUFFER_SIZE = 100;

  constructor(options: EventLoggerOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseServiceKey = options.supabaseServiceKey;
    this.startAutoFlush();
  }

  log(event: Omit<JobEvent, 'id' | 'timestamp'>): void {
    const jobEvent: JobEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.buffer.push(jobEvent);

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
    }
  }

  logJobCreated(jobId: string, storyId: string, userId: string, data?: Record<string, unknown>): void {
    this.log({ jobId, storyId, userId, eventType: 'job_created', data });
  }

  logNodeStarted(jobId: string, storyId: string, userId: string, nodeId: string, capability: string): void {
    this.log({ jobId, storyId, userId, eventType: 'node_started', nodeId, capability });
  }

  logNodeCompleted(jobId: string, storyId: string, userId: string, nodeId: string, capability: string, data?: Record<string, unknown>): void {
    this.log({ jobId, storyId, userId, eventType: 'node_completed', nodeId, capability, data });
  }

  logNodeFailed(jobId: string, storyId: string, userId: string, nodeId: string, capability: string, error: string): void {
    this.log({ 
      jobId, 
      storyId, 
      userId, 
      eventType: 'node_failed', 
      nodeId, 
      capability, 
      data: { error } 
    });
  }

  logJobCompleted(jobId: string, storyId: string, userId: string, data?: Record<string, unknown>): void {
    this.log({ jobId, storyId, userId, eventType: 'job_completed', data });
  }

  logJobFailed(jobId: string, storyId: string, userId: string, error: string): void {
    this.log({ 
      jobId, 
      storyId, 
      userId, 
      eventType: 'job_failed', 
      data: { error } 
    });
  }

  logJobCancelled(jobId: string, storyId: string, userId: string): void {
    this.log({ jobId, storyId, userId, eventType: 'job_cancelled' });
  }

  logWebhookReceived(jobId: string, storyId: string, userId: string, data: Record<string, unknown>): void {
    this.log({ jobId, storyId, userId, eventType: 'webhook_received', data });
  }

  logRetryAttempt(jobId: string, storyId: string, userId: string, nodeId: string, attempt: number): void {
    this.log({ 
      jobId, 
      storyId, 
      userId, 
      eventType: 'retry_attempt', 
      nodeId, 
      data: { attempt } 
    });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);

      const { error } = await supabase
        .from('job_events')
        .upsert(events.map(e => ({
          job_id: e.jobId,
          story_id: e.storyId,
          user_id: e.userId,
          event_type: e.eventType,
          node_id: e.nodeId,
          capability: e.capability,
          data: e.data,
          timestamp: e.timestamp,
        })), {
          onConflict: 'job_id, event_type, timestamp',
        });

      if (error) {
        console.error('[EventLogger] Failed to flush events:', error);
        this.buffer.unshift(...events);
      }
    } catch (error) {
      console.error('[EventLogger] Error flushing events:', error);
      this.buffer.unshift(...events);
    }
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

export function createEventLogger(options: EventLoggerOptions): EventLogger {
  return new EventLogger(options);
}
