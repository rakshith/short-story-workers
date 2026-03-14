// DAG Executor - Event-driven pipeline orchestration for generation engine
// This executor builds the DAG and schedules ready nodes via Cloudflare Queues.
// It does NOT run nodes inline — the JobDurableObject handles event-driven orchestration.

import { getTemplate } from '../templates/index';
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
      console.log('[DAGExecutor] EventLogger initialized');
    } else {
      this.eventLogger = null;
      console.log('[DAGExecutor] EventLogger NOT initialized - missing SUPABASE_URL or SERVICE_KEY');
    }
  }

  /**
   * Update message with new data (e.g., storyData after script generation)
   */
  updateMessage(updates: Partial<DAGMessage>): void {
    this.message = { ...this.message, ...updates };
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

      // 3. Filter blocks based on client input (sceneReviewRequired)
      const reviewRequired = (videoConfig as Record<string, unknown>)?.sceneReviewRequired as boolean || false;
      let blocksToUse = profile.blocks;
      
      if (!reviewRequired) {
        // Exclude review_required block if client doesn't need review
        blocksToUse = profile.blocks.filter(b => (b.capability as string) !== 'review_required');
        console.log(`[DAGExecutor] Excluding review_required block (reviewRequired: ${reviewRequired})`);
      } else {
        console.log(`[DAGExecutor] Including review_required block (reviewRequired: ${reviewRequired})`);
      }
      
      // 4. Build DAG with filtered blocks
      const graphBuilder = createGraphBuilder();
      const sceneCount = (storyData?.scenes as unknown[] | undefined)?.length || 1;
      const filteredProfile = { ...profile, blocks: blocksToUse };
      
      const { graph, counters } = graphBuilder.build({
        profile: filteredProfile,
        context: { jobId, storyId, userId, sceneCount },
      });

      // 5. Find ready nodes (dependency count === 0)
      const dependencyEngine = createDependencyEngine(counters);
      const readyNodes = dependencyEngine.getReadyNodes(graph);

      if (readyNodes.length === 0) {
        this.eventLogger?.logJobFailed(jobId, storyId, userId, 'No ready nodes found in DAG — possible misconfiguration');
        return { success: false, jobId, storyId, error: 'No ready nodes in DAG' };
      }

      // 6. Store DAG in DO for persistence (cache it, never rebuild)
      const storyCoordinator = this.env.STORY_COORDINATOR as { idFromName: (name: string) => any; get: (id: any) => any };
      const coordinatorId = storyCoordinator.idFromName(storyId as string);
      const coordinator = storyCoordinator.get(coordinatorId);
      
      await coordinator.fetch(new Request('http://do/storeDag', {
        method: 'POST',
        body: JSON.stringify({
          graph,
          counters,
          metadata: {
            sceneCount,
            templateId,
            profileId: profile.id,
            blocks: blocksToUse,
            reviewRequired,
            builtAt: new Date().toISOString(),
          }
        }),
      }));
      
      console.log(`[DAGExecutor] DAG stored in DO (sceneCount: ${sceneCount}, reviewRequired: ${reviewRequired})`);

      // 7. Schedule ready nodes via Cloudflare Queue (event-driven, non-blocking)
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

      const queueMessage = await this.buildQueueMessage(node);
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
   * Includes generatedImageUrl for video nodes (skeleton3d 2-step process).
   */
  private async buildQueueMessage(node: WorkflowNode): Promise<Record<string, unknown>> {
    const { jobId, storyId, userId, videoConfig, storyData, seriesId, title, baseUrl, teamId, userTier, priority } = this.message;

    // Map DAG capability to queue message type
    const capabilityToType: Record<string, string> = {
      'image-generation': 'image',
      'video-generation': 'video',
      'voice-generation': 'audio',
    };

    const sceneIndex = (node.input as Record<string, unknown>).sceneIndex ?? 0;

    const message: Record<string, unknown> = {
      jobId,
      storyId,
      userId,
      seriesId,
      title,
      storyData,
      videoConfig,
      sceneIndex,
      type: capabilityToType[node.capability] || node.capability,
      baseUrl,
      teamId,
      userTier,
      priority,
      // DAG metadata
      dagNodeId: node.nodeId,
      dagCapability: node.capability,
    };

    // For video generation (skeleton3d 2-step process), include generatedImageUrl
    if (node.capability === 'video-generation' && storyId) {
      try {
        const storyCoordinator = this.env.STORY_COORDINATOR as { idFromName: (name: string) => any; get: (id: any) => any };
        const coordinatorId = storyCoordinator.idFromName(storyId as string);
        const coordinator = storyCoordinator.get(coordinatorId);
        const stateRes = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
        const stateData = await stateRes.json() as any;
        const idx = sceneIndex as number;
        const scene = stateData?.scenes?.[idx];
        if (scene?.generatedImageUrl) {
          message.generatedImageUrl = scene.generatedImageUrl;
          console.log(`[DAGExecutor] Including generatedImageUrl for video scene ${idx}`);
        }
      } catch (error) {
        console.error('[DAGExecutor] Failed to get generatedImageUrl:', error);
      }
    }

    return message;
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

    console.log('[DAGExecutor] onJobComplete received timeline:', timeline ? 'exists' : 'undefined');
    console.log('[DAGExecutor] onJobComplete received story title:', story?.title);

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
    await this.eventLogger?.stop();
  }

  /**
   * Called after each scene-level node completes (image/audio/video).
   * Syncs progress to DB and schedules next ready nodes in the DAG.
   */
  async onNodeComplete(scenes: any[], progress: { imagesCompleted: number; audioCompleted: number; videosCompleted: number; totalScenes: number }, nodeType?: string): Promise<void> {
    const { jobId, storyId, userId, templateId, videoConfig, seriesId, title, baseUrl, teamId, userTier, priority } = this.message;

    await this.storySyncService.syncPartialStory(
      { jobId, storyId, userId },
      scenes
    );

    const voiceOverEnabled = (videoConfig as Record<string, unknown>)?.enableVoiceOver !== false;
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

    // Schedule next ready nodes via DAG
    await this.scheduleNextNodes(scenes, nodeType || 'script-generation');
  }

  /**
   * Schedule next ready nodes based on current progress.
   * Uses scenes directly from memory to avoid DO race condition.
   * nodeType: the capability that just completed (e.g., 'script-generation')
   */
  private async scheduleNextNodes(scenes: any[] = [], nodeType: string = ''): Promise<void> {
    try {
      const { jobId, templateId } = this.message;
      const storyId = this.message.storyId as string;
      
      // Get current state from DO (only for progress counters, not scenes)
      const storyCoordinator = this.env.STORY_COORDINATOR as { idFromName: (name: string) => any; get: (id: any) => any };
      const coordinatorId = storyCoordinator.idFromName(storyId);
      const coordinator = storyCoordinator.get(coordinatorId);
      const stateRes = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
      const stateData = await stateRes.json() as any;

      if (!stateData) {
        console.log('[DAGExecutor] No state data, skipping scheduling');
        return;
      }

      // Use scenes from memory (passed from onNodeComplete), fallback to DO only if empty
      const scenesArray = scenes.length > 0 ? scenes : (stateData.scenes || []);
      const sceneCount = scenesArray.length || 1;
      console.log(`[DAGExecutor] scheduleNextNodes: scenes from ${scenes.length > 0 ? 'memory' : 'DO fallback'}, count=${sceneCount}`);

      // Get template and profile to rebuild DAG
      const { getTemplate } = await import('../templates/registry');
      const { profileRegistry } = await import('../profiles/index');
      const template = getTemplate(templateId);
      if (!template) {
        console.error('[DAGExecutor] Template not found:', templateId);
        return;
      }
      
      const profile = profileRegistry.get(template.profileId);
      if (!profile) {
        console.error('[DAGExecutor] Profile not found:', template.profileId);
        return;
      }

      // Build DAG
      const { createGraphBuilder, createDependencyEngine } = await import('../workflow');
      const graphBuilder = createGraphBuilder();
      console.log(`[DAGExecutor] Building DAG with sceneCount=${sceneCount}, scenes array length=${scenesArray.length}`);
      
      const { graph, counters } = graphBuilder.build({
        profile,
        context: { jobId, storyId, userId: this.message.userId, sceneCount }
      });

      // Find ready nodes (dependencies satisfied)
      const dependencyEngine = createDependencyEngine(counters);
      
      // If script just completed, mark it as completed in dependency engine
      // This allows image/voice nodes to become ready
      if (nodeType === 'script-generation') {
        const scriptNodes = Array.from(graph.nodes.values()).filter(n => n.capability === 'script-generation');
        for (const scriptNode of scriptNodes) {
          console.log(`[DAGExecutor] Marking script node ${scriptNode.nodeId} as completed`);
          dependencyEngine.markNodeCompleted(scriptNode.nodeId, graph);
        }
      }
      
      let readyNodes = dependencyEngine.getReadyNodes(graph);
      
      console.log(`[DAGExecutor] Ready nodes from DAG: ${readyNodes.join(', ')}`);

      // Filter out already scheduled/completed based on state
      const imageScenesDone = stateData.imagesCompleted || 0;
      const videoScenesDone = stateData.videosCompleted || 0;
      const audioScenesDone = stateData.audioCompleted || 0;
      
      console.log(`[DAGExecutor] Filtering nodes: imageScenesDone=${imageScenesDone}, videoScenesDone=${videoScenesDone}, audioScenesDone=${audioScenesDone}`);

      const trulyReadyNodes = readyNodes.filter(nodeId => {
        const node = graph.nodes.get(nodeId);
        if (!node) return false;
        
        const capability = node.capability;
        const sceneIndex = (node.input as Record<string, number>)?.sceneIndex ?? 0;
        
        // Skip script-generation - already completed
        if (capability === 'script-generation') {
          console.log(`[DAGExecutor] Filtering out script node ${nodeId} - already completed`);
          return false;
        }
        
        if (capability === 'image-generation') {
          return sceneIndex >= imageScenesDone;
        }
        if (capability === 'video-generation') {
          return sceneIndex >= videoScenesDone;
        }
        if (capability === 'voice-generation') {
          return sceneIndex >= audioScenesDone;
        }
        
        // Default: don't schedule unknown node types
        console.log(`[DAGExecutor] Filtering out unknown node ${nodeId} with capability ${capability}`);
        return false;
      });

      if (trulyReadyNodes.length > 0) {
        const nodesScheduled = await this.scheduleNodes(trulyReadyNodes, graph);
        console.log(`[DAGExecutor] Scheduled ${nodesScheduled} next nodes`);
      } else {
        console.log('[DAGExecutor] No new ready nodes to schedule');
      }
    } catch (error) {
      console.error('[DAGExecutor] Error scheduling next nodes:', error);
    }
  }

  /**
   * Called when the job fails.
   */
  async onJobFailed(error: string): Promise<void> {
    const { jobId, storyId, userId } = this.message;
    await this.storySyncService.updateJobProgress(jobId, 0, 'failed');
    this.eventLogger?.logJobFailed(jobId, storyId, userId, error);
    await this.eventLogger?.stop();
  }
}

export function createDAGExecutor(options: DAGExecutorOptions): DAGExecutor {
  return new DAGExecutor(options);
}
