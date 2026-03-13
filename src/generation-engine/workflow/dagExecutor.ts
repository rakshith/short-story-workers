// DAG Executor - Full pipeline orchestration for generation engine

import { getTemplate } from '../templates/registry';
import { profileRegistry } from '../profiles/index';
import { createGraphBuilder, createDependencyEngine, createNodeExecutor } from '../workflow';
import { createScriptService } from '../services/scriptService';
import { createConcurrencyService } from '../services/concurrencyService';
import { createStorySyncService } from '../services/storySync';
import { createEmailNotificationService } from '../services/emailNotification';
import { createCostTrackingService } from '../services/costTracking';
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

  constructor(options: DAGExecutorOptions) {
    this.env = options.env;
    this.message = options.message;
    this.concurrencyService = createConcurrencyService();
    this.storySyncService = createStorySyncService(options.env);
    this.emailService = createEmailNotificationService(options.env);
    this.costTrackingService = createCostTrackingService(options.env);
  }

  async run(): Promise<ExecutionResult> {
    const { templateId, jobId, storyId, userId, videoConfig, storyData } = this.message;

    try {
      const concurrencyCheck = await this.concurrencyService.check(userId, videoConfig?.userTier || 'tier1', this.env, jobId);
      if (!concurrencyCheck.allowed) {
        return { success: false, jobId, storyId, error: 'Concurrency limit reached' };
      }

      const template = getTemplate(templateId);
      if (!template) {
        return { success: false, jobId, storyId, error: `Unknown template: ${templateId}` };
      }

      const profile = profileRegistry.get(template.profileId);
      if (!profile) {
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

      return { success: true, jobId, storyId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[DAGExecutor] Error:', message);
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

        const nodeExecutor = createNodeExecutor({
          context,
          onNodeComplete: async (completedNodeId: string, output: any) => {
            dependencyEngine.markNodeCompleted(completedNodeId, graph);
            await this.handleNodeCompletion(node.capability, output, context);
          },
          onNodeError: async (failedNodeId: string, error: string) => {
            dependencyEngine.markNodeFailed(failedNodeId);
            console.error(`[DAGExecutor] Node ${failedNodeId} failed:`, error);
          },
        });

        await nodeExecutor.executeNode(node);
      });

      await Promise.all(promises);
    }
  }

  private async handleNodeCompletion(capability: string, output: any, context: ExecutionContext): Promise<void> {
    const { jobId, storyId, userId, videoConfig } = context as any;

    if (capability === 'script-generation') {
      console.log(`[DAGExecutor] Script generated: ${output?.sceneCount} scenes`);
    }

    if (capability === 'image-generation') {
      await this.storySyncService.updateJobProgress(jobId, 25, 'processing');
    }

    if (capability === 'voice-generation') {
      await this.storySyncService.updateJobProgress(jobId, 50, 'processing');
    }

    if (capability === 'video-generation') {
      await this.storySyncService.updateJobProgress(jobId, 75, 'processing');
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
  }

  async onJobFailed(error: string): Promise<void> {
    const { jobId, storyId, userId } = this.message;
    await this.storySyncService.updateJobProgress(jobId, 0, 'failed');
  }
}

export function createDAGExecutor(options: DAGExecutorOptions): DAGExecutor {
  return new DAGExecutor(options);
}
