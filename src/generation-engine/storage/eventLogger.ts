// Event Logger - logs job events to Supabase

export type EventType = 
  | 'JOB_CREATED'
  | 'SCRIPT_STARTED'
  | 'SCRIPT_COMPLETED'
  | 'SCENES_GENERATED'
  | 'IMAGE_GENERATION_STARTED'
  | 'IMAGE_GENERATION_COMPLETED'
  | 'VOICE_STARTED'
  | 'VOICE_COMPLETED'
  | 'VIDEO_STARTED'
  | 'VIDEO_COMPLETED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED'
  | 'JOB_CANCELLED';

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
  private readonly MAX_BUFFER_SIZE = 100;

  constructor(options: EventLoggerOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseServiceKey = options.supabaseServiceKey;
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
    this.log({ jobId, storyId, userId, eventType: 'JOB_CREATED', data });
  }

  logScriptStarted(jobId: string, storyId: string, userId: string): void {
    this.log({ jobId, storyId, userId, eventType: 'SCRIPT_STARTED', capability: 'script-generation' });
  }

  logScriptCompleted(jobId: string, storyId: string, userId: string, sceneCount: number): void {
    this.log({ jobId, storyId, userId, eventType: 'SCRIPT_COMPLETED', capability: 'script-generation', data: { sceneCount } });
  }

  logScenesGenerated(jobId: string, storyId: string, userId: string, sceneCount: number): void {
    this.log({ jobId, storyId, userId, eventType: 'SCENES_GENERATED', data: { sceneCount } });
  }

  logImageGenerationStarted(jobId: string, storyId: string, userId: string, nodeId: string, sceneIndex: number): void {
    this.log({ jobId, storyId, userId, eventType: 'IMAGE_GENERATION_STARTED', nodeId, capability: 'image-generation', data: { sceneIndex } });
  }

  logImageGenerationCompleted(jobId: string, storyId: string, userId: string, nodeId: string, sceneIndex: number, imageUrl: string): void {
    this.log({ jobId, storyId, userId, eventType: 'IMAGE_GENERATION_COMPLETED', nodeId, capability: 'image-generation', data: { sceneIndex, imageUrl } });
  }

  logVoiceStarted(jobId: string, storyId: string, userId: string, nodeId: string, sceneIndex: number): void {
    this.log({ jobId, storyId, userId, eventType: 'VOICE_STARTED', nodeId, capability: 'voice-generation', data: { sceneIndex } });
  }

  logVoiceCompleted(jobId: string, storyId: string, userId: string, nodeId: string, sceneIndex: number, audioUrl: string): void {
    this.log({ jobId, storyId, userId, eventType: 'VOICE_COMPLETED', nodeId, capability: 'voice-generation', data: { sceneIndex, audioUrl } });
  }

  logVideoStarted(jobId: string, storyId: string, userId: string, nodeId: string, sceneIndex: number): void {
    this.log({ jobId, storyId, userId, eventType: 'VIDEO_STARTED', nodeId, capability: 'video-generation', data: { sceneIndex } });
  }

  logVideoCompleted(jobId: string, storyId: string, userId: string, nodeId: string, sceneIndex: number, videoUrl: string): void {
    this.log({ jobId, storyId, userId, eventType: 'VIDEO_COMPLETED', nodeId, capability: 'video-generation', data: { sceneIndex, videoUrl } });
  }

  logJobCompleted(jobId: string, storyId: string, userId: string, data?: Record<string, unknown>): void {
    this.log({ jobId, storyId, userId, eventType: 'JOB_COMPLETED', data });
  }

  logJobFailed(jobId: string, storyId: string, userId: string, error: string): void {
    this.log({ jobId, storyId, userId, eventType: 'JOB_FAILED', data: { error } });
  }

  logJobCancelled(jobId: string, storyId: string, userId: string): void {
    this.log({ jobId, storyId, userId, eventType: 'JOB_CANCELLED' });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    console.log('[EventLogger] Flushing', events.length, 'events to DB');

    if (events.length === 0) {
      console.log('[EventLogger] No events to flush');
      return;
    }

    try {
      console.log('[EventLogger] Preparing to upsert events to job_events table');
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);

      console.log('[EventLogger] Calling Supabase upsert for job_events...');
      
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
          onConflict: 'job_id, event_type, node_id',
        });

      if (error) {
        console.error('[EventLogger] Failed to flush events:', error);
        this.buffer.unshift(...events);
      } else {
        console.log('[EventLogger] Successfully flushed', events.length, 'events to DB');
      }
    } catch (error) {
      console.error('[EventLogger] Error flushing events:', error);
      this.buffer.unshift(...events);
    }
  }

  async stop(): Promise<void> {
    await this.flush();
  }
}

export function createEventLogger(options: EventLoggerOptions): EventLogger {
  return new EventLogger(options);
}
