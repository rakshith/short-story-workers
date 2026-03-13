// DAG Executor - Full pipeline orchestration for generation engine

import { getTemplate } from '../templates/registry';
import { profileRegistry } from '../profiles/index';
import { createGraphBuilder, createDependencyEngine, createNodeExecutor } from '../workflow';
import { createScriptService } from '../services/scriptService';
import { createConcurrencyService } from '../services/concurrencyService';
import { createStorySyncService } from '../services/storySync';
import { createEmailNotificationService } from '../services/emailNotification';
import { createCostTrackingService } from '../services/costTracking';
import { createEventLogger } from '../storage/eventLogger';
import { ExecutionContext, WorkflowGraph } from '../types';

export interface DAGMessage {
  jobId: string;
  storyId: string;
  userId: string;
  templateId: string;
  videoConfig?: any;
  storyData?: any;
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
  env: any;
  message: DAGMessage;
}

export interface ExecutionResult {
  success: boolean;
  jobId: string;
  storyId: string;
  error?: string;
}

export class DAGExecutor {
  private env: any;
  private message: DAGMessage;
  private concurrencyService: any;
  private storySyncService: any;
  private emailService: any;
  private costTrackingService: any;
  private eventLogger: any;

  constructor(options: DAGExecutorOptions) {
    this.env = options.env;
    this.message = options.message;
    this.concurrencyService = createConcurrencyService();
    this.storySyncService = createStorySyncService(options.env);
    this.emailService = createEmailNotificationService(options.env);
    this.costTrackingService = createCostTrackingService(options.env);
    
    if (this.env.SUPABASE_URL && this.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.eventLogger = createEventLogger({
        supabaseUrl: this.env.SUPABASE_URL,
        supabaseServiceKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      });
    }
  }

  async run(): Promise<ExecutionResult> {
    const { templateId, jobId, storyId, userId, videoConfig, storyData } = this.message;

    this.eventLogger?.logJobCreated(jobId, storyId, userId, { templateId });

    try {
      const concurrencyCheck = await this.concurrencyService.check(userId, videoConfig?.userTier || 'tier1', this.env, jobId);
      if (!concurrencyCheck.allowed) {
        this.eventLogger?.logJobFailed(jobId, storyId, userId, 'Concurrency limit reached');
        return { success: false, jobId, storyId, error: 'Concurrency limit reached' };
      }

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

      const context: ExecutionContext = {
        jobId,
        storyId,
        userId,
        videoConfig: videoConfig || {},
        env: this.env,
      };

      const graphBuilder = createGraphBuilder();
      const { graph, counters } = graphBuilder.build({
        profile,
        context: { jobId, storyId, userId, sceneCount: storyData?.scenes?.length || 1 },
      });

      const dependencyEngine = createDependencyEngine(counters);

      await this.executeDAG(graph, dependencyEngine, context);

      this.eventLogger?.logJobCompleted(jobId, storyId, userId);
      return { success: true, jobId, storyId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAGExecutor] Error:', message);
      this.eventLogger?.logJobFailed(jobId, storyId, userId, message);
      return { success: false, jobId, storyId, error: message };
    }
  }

  private async executeDAG(graph: WorkflowGraph, dependencyEngine: any, context: ExecutionContext): Promise<void> {
    while (!dependencyEngine.isComplete()) {
      const readyNodes = dependencyEngine.getReadyNodes(graph);

      if (readyNodes.length === 0) {
        const isComplete = dependencyEngine.isComplete();
        if (isComplete) break;
        console.warn('[DAGExecutor] No ready nodes but not complete, possible deadlock');
        break;
      }

      const promises = readyNodes.map(async (nodeId: string) => {
        const node = graph.nodes.get(nodeId);
        if (!node) return;

        dependencyEngine.markNodeStarted(nodeId);
        this.logNodeStarted(node, context);

        const nodeExecutor = createNodeExecutor({
          context,
          onNodeComplete: async (completedNodeId: string, output: any) => {
            dependencyEngine.markNodeCompleted(completedNodeId, graph);
            await this.handleNodeCompletion(node.capability, output, context, nodeId);
          },
          onNodeError: async (failedNodeId: string, error: string) => {
            dependencyEngine.markNodeFailed(failedNodeId);
            this.eventLogger?.logJobFailed(context.jobId, context.storyId, context.userId, `Node ${failedNodeId} failed: ${error}`);
            console.error(`[DAGExecutor] Node ${failedNodeId} failed:`, error);
          },
        });

        await nodeExecutor.executeNode(node);
      });

      await Promise.all(promises);
    }
  }

  private logNodeStarted(node: any, context: ExecutionContext): void {
    const { jobId, storyId, userId } = context as any;
    const capability = node.capability;

    if (capability === 'script-generation') {
      this.eventLogger?.logScriptStarted(jobId, storyId, userId);
    } else if (capability === 'image-generation') {
      this.eventLogger?.logImageGenerationStarted(jobId, storyId, userId, node.id, node.sceneIndex || 0);
    } else if (capability === 'voice-generation') {
      this.eventLogger?.logVoiceStarted(jobId, storyId, userId, node.id, node.sceneIndex || 0);
    } else if (capability === 'video-generation') {
      this.eventLogger?.logVideoStarted(jobId, storyId, userId, node.id, node.sceneIndex || 0);
    }
  }

  private async handleNodeCompletion(capability: string, output: any, context: ExecutionContext, nodeId: string): Promise<void> {
    const { jobId, storyId, userId, videoConfig } = context as any;

    if (capability === 'script-generation') {
      const sceneCount = output?.sceneCount || output?.scenes?.length || 0;
      console.log(`[DAGExecutor] Script generated: ${sceneCount} scenes`);
      this.eventLogger?.logScriptCompleted(jobId, storyId, userId, sceneCount);
      this.eventLogger?.logScenesGenerated(jobId, storyId, userId, sceneCount);
    }

    if (capability === 'image-generation') {
      const sceneIndex = output?.sceneIndex || 0;
      const imageUrl = output?.imageUrl || output?.url || '';
      await this.storySyncService.updateJobProgress(jobId, 25, 'processing');
      this.eventLogger?.logImageGenerationCompleted(jobId, storyId, userId, nodeId, sceneIndex, imageUrl);
    }

    if (capability === 'voice-generation') {
      const sceneIndex = output?.sceneIndex || 0;
      const audioUrl = output?.audioUrl || output?.url || '';
      await this.storySyncService.updateJobProgress(jobId, 50, 'processing');
      this.eventLogger?.logVoiceCompleted(jobId, storyId, userId, nodeId, sceneIndex, audioUrl);
    }

    if (capability === 'video-generation') {
      const sceneIndex = output?.sceneIndex || 0;
      const videoUrl = output?.videoUrl || output?.url || '';
      await this.storySyncService.updateJobProgress(jobId, 75, 'processing');
      this.eventLogger?.logVideoCompleted(jobId, storyId, userId, nodeId, sceneIndex, videoUrl);
    }
  }

  async onJobComplete(story: any): Promise<void> {
    const { jobId, storyId, userId, videoConfig } = this.message;

    const syncResult = await this.storySyncService.syncStoryComplete(
      { jobId, storyId, userId, teamId: videoConfig?.teamId },
      story
    );

    if (syncResult.success) {
      await this.emailService.sendCompletionEmail({
        userId,
        storyId,
        storyTitle: story.title || 'Your Story',
        storyUrl: syncResult.storyUrl,
      });
    }

    this.eventLogger?.logJobCompleted(jobId, storyId, userId, { title: story.title });
    this.eventLogger?.stop();
  }

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
