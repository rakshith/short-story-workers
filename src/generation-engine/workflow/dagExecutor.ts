// DAG Executor - Event-driven pipeline orchestration for generation engine
// This executor builds the DAG and schedules ready nodes via Cloudflare Queues.
// It does NOT run nodes inline — the JobDurableObject handles event-driven orchestration.

import { getTemplate } from '../templates/registry';
import { profileRegistry } from '../profiles/index';
import { createGraphBuilder, createDependencyEngine } from '../workflow';
import { createConcurrencyService } from '../services/concurrencyService';
import { createStorySyncService } from '../services/storySync';
import { createEmailNotificationService } from '../services/emailNotification';
import { createCostTrackingService } from '../services/costTracking';
import { createEventLogger } from '../storage/eventLogger';
import { WorkflowGraph, WorkflowNode, NodeCapability } from '../types';

export interface DAGMessage {
  jobId: string;
  storyId: string;
  userId: string;
  templateId: string;
  videoConfig?: Record<string, unknown>;
  storyData?: { scenes?: unknown[]; title?: string; totalDuration?: number };
  sceneIndex?: number;
  type?: 'image' | 'video' | 'audio';
  seriesId?: string;
  title?: string;
  baseUrl?: string;
  teamId?: string;
  userTier?: string;
  priority?: number;
}

export interface DAGExecutorOptions {
  env: Record<string, unknown>;
  message: DAGMessage;
}

export interface ExecutionResult {
  success: boolean;
  jobId: string;
  storyId: string;
  nodesScheduled?: number;
  error?: string;
}

export class DAGExecutor {
  private env: Record<string, unknown>;
  private message: DAGMessage;
  private concurrencyService: ReturnType<typeof createConcurrencyService>;
  private storySyncService: ReturnType<typeof createStorySyncService>;
  private emailService: ReturnType<typeof createEmailNotificationService>;
  private costTrackingService: ReturnType<typeof createCostTrackingService>;
  private eventLogger: ReturnType<typeof createEventLogger> | null;

  constructor(options: DAGExecutorOptions) {
    this.env = options.env;
    this.message = options.message;
    this.concurrencyService = createConcurrencyService();
    this.storySyncService = createStorySyncService(options.env);
    this.emailService = createEmailNotificationService(options.env);
    this.costTrackingService = createCostTrackingService(options.env);

    if (this.env.SUPABASE_URL && this.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.eventLogger = createEventLogger({
        supabaseUrl: this.env.SUPABASE_URL as string,
        supabaseServiceKey: this.env.SUPABASE_SERVICE_ROLE_KEY as string,
      });
    } else {
      this.eventLogger = null;
    }
  }

  /**
   * Builds the DAG from the template/profile and schedules initial ready nodes
   * via Cloudflare Queue. Returns immediately — does NOT execute nodes inline.
   * The JobDurableObject handles subsequent scheduling as nodes complete.
   */
  async run(): Promise<ExecutionResult> {
    const { templateId, jobId, storyId, userId, videoConfig, storyData } = this.message;

    this.eventLogger?.logJobCreated(jobId, storyId, userId, { templateId });

    try {
      // 1. Concurrency check
      const concurrencyCheck = await this.concurrencyService.check(
        userId,
        (videoConfig as Record<string, unknown>)?.userTier as string || 'tier1',
        this.env,
        jobId
      );
      if (!concurrencyCheck.allowed) {
        this.eventLogger?.logJobFailed(jobId, storyId, userId, 'Concurrency limit reached');
        return { success: false, jobId, storyId, error: 'Concurrency limit reached' };
      }

      // 2. Resolve template → profile
      const template = getTemplate(templateId);
      if (!template) {
        this.eventLogger?.logJobFailed(jobId, storyId, userId, `Unknown template: ${templateId}`);
        return { success: false, jobId, storyId, error: `Unknown template: ${templateId}` };
      }

      const profile = profileRegistry.get(template.profileId);
      if (!profile) {
        this.eventLogger?.logJobFailed(jobId, storyId, userId, `Unknown profile: ${template.profileId}`);
        return { success: false, jobId, storyId, error: `Unknown profile: ${template.profileId}` };
      }

      // 3. Build DAG
      const graphBuilder = createGraphBuilder();
      const sceneCount = (storyData?.scenes as unknown[] | undefined)?.length || 1;
      const { graph, counters } = graphBuilder.build({
        profile,
        context: { jobId, storyId, userId, sceneCount },
      });

      // 4. Find ready nodes (dependency count === 0)
      const dependencyEngine = createDependencyEngine(counters);
      const readyNodes = dependencyEngine.getReadyNodes(graph);

      if (readyNodes.length === 0) {
        this.eventLogger?.logJobFailed(jobId, storyId, userId, 'No ready nodes found in DAG — possible misconfiguration');
        return { success: false, jobId, storyId, error: 'No ready nodes in DAG' };
      }

      // 5. Schedule ready nodes via Cloudflare Queue (event-driven, non-blocking)
      const nodesScheduled = await this.scheduleNodes(readyNodes, graph);

      console.log(`[DAGExecutor] Scheduled ${nodesScheduled} initial nodes for job ${jobId}`);
      return { success: true, jobId, storyId, nodesScheduled };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAGExecutor] Error:', message);
      this.eventLogger?.logJobFailed(jobId, storyId, userId, message);
      return { success: false, jobId, storyId, error: message };
    }
  }

  /**
   * Schedule nodes by dispatching them to the Cloudflare Queue.
   * Each node becomes a queue message that the execution worker will pick up.
   */
  private async scheduleNodes(nodeIds: string[], graph: WorkflowGraph): Promise<number> {
    const queue = this.env.STORY_QUEUE as { send: (msg: unknown) => Promise<void> } | undefined;
    if (!queue) {
      console.error('[DAGExecutor] STORY_QUEUE not available — cannot schedule nodes');
      return 0;
    }

    let scheduled = 0;
    for (const nodeId of nodeIds) {
      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      const queueMessage = this.buildQueueMessage(node);
      try {
        await queue.send(queueMessage);
        scheduled++;
        this.logNodeScheduled(node);
      } catch (error) {
        console.error(`[DAGExecutor] Failed to schedule node ${nodeId}:`, error);
      }
    }
    return scheduled;
  }

  /**
   * Build a queue message from a workflow node.
   * Maps DAG node capabilities to the queue message format the execution worker expects.
   */
  private buildQueueMessage(node: WorkflowNode): Record<string, unknown> {
    const { jobId, storyId, userId, videoConfig, storyData, seriesId, title, baseUrl, teamId, userTier, priority } = this.message;

    // Map DAG capability to queue message type
    const capabilityToType: Record<string, string> = {
      'image-generation': 'image',
      'video-generation': 'video',
      'voice-generation': 'audio',
    };

    return {
      jobId,
      storyId,
      userId,
      seriesId,
      title,
      storyData,
      videoConfig,
      sceneIndex: (node.input as Record<string, unknown>).sceneIndex ?? 0,
      type: capabilityToType[node.capability] || node.capability,
      baseUrl,
      teamId,
      userTier,
      priority,
      // DAG metadata
      dagNodeId: node.nodeId,
      dagCapability: node.capability,
    };
  }

  private logNodeScheduled(node: WorkflowNode): void {
    const { jobId, storyId, userId } = this.message;
    const capability = node.capability;

    if (capability === 'script-generation') {
      this.eventLogger?.logScriptStarted(jobId, storyId, userId);
    } else if (capability === 'image-generation') {
      this.eventLogger?.logImageGenerationStarted(jobId, storyId, userId, node.nodeId, (node.input as Record<string, number>).sceneIndex || 0);
    } else if (capability === 'voice-generation') {
      this.eventLogger?.logVoiceStarted(jobId, storyId, userId, node.nodeId, (node.input as Record<string, number>).sceneIndex || 0);
    } else if (capability === 'video-generation') {
      this.eventLogger?.logVideoStarted(jobId, storyId, userId, node.nodeId, (node.input as Record<string, number>).sceneIndex || 0);
    }
  }

  /**
   * Called when the entire job completes (by the DO or finalization handler).
   * Accepts the compiled timeline from the DO finalize response.
   */
  async onJobComplete(story: { title?: string; scenes?: any[] }, timeline?: unknown): Promise<void> {
    const { jobId, storyId, userId, videoConfig } = this.message;

    const syncResult = await this.storySyncService.syncStoryComplete(
      {
        jobId,
        storyId,
        userId,
        teamId: (videoConfig as Record<string, unknown>)?.teamId as string | undefined,
        timeline,
      },
      story
    );

    if (syncResult.success) {
      let thumbnailUrl: string | undefined;
      if (story.scenes?.length) {
        const firstWithImage = story.scenes.find((s: any) => s.generatedImageUrl);
        if (firstWithImage) {
          thumbnailUrl = firstWithImage.generatedImageUrl;
        }
      }

      await this.emailService.sendCompletionEmail({
        userId,
        storyId,
        storyTitle: story.title || 'Your Story',
        storyUrl: syncResult.storyUrl,
        thumbnailUrl,
      });
    }

    this.eventLogger?.logJobCompleted(jobId, storyId, userId, { title: story.title });
    this.eventLogger?.stop();
  }

  /**
   * Called after each scene-level node completes (image/audio/video).
   * Incrementally syncs partial results to DB so data isn't lost if the job fails.
   */
  async onNodeComplete(scenes: any[], progress: { imagesCompleted: number; audioCompleted: number; videosCompleted: number; totalScenes: number }): Promise<void> {
    const { jobId, storyId, userId } = this.message;

    await this.storySyncService.syncPartialStory(
      { jobId, storyId, userId },
      scenes
    );

    const voiceOverEnabled = (this.message.videoConfig as Record<string, unknown>)?.enableVoiceOver !== false;
    const denominator = voiceOverEnabled ? progress.totalScenes * 2 : progress.totalScenes;
    const numerator = progress.imagesCompleted + (voiceOverEnabled ? progress.audioCompleted : 0);
    const progressPercent = Math.min(Math.round((numerator / denominator) * 75), 75);

    await this.storySyncService.updateJobProgress(
      jobId,
      progressPercent,
      'processing',
      progress.imagesCompleted,
      progress.videosCompleted,
      progress.audioCompleted
    );
  }

  /**
   * Called when the job fails.
   */
  async onJobFailed(error: string): Promise<void> {
    const { jobId, storyId, userId } = this.message;
    await this.storySyncService.updateJobProgress(jobId, 0, 'failed');
    this.eventLogger?.logJobFailed(jobId, storyId, userId, error);
    this.eventLogger?.stop();
  }
}

export function createDAGExecutor(options: DAGExecutorOptions): DAGExecutor {
  return new DAGExecutor(options);
}
