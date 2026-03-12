// Graph Builder - builds DAG from profile blocks

import { WorkflowGraph, WorkflowNode, DependencyCounter, Profile, BlockDefinition } from '../types';
import { generateUUID } from '../../utils/storage';

export interface GraphBuilderOptions {
  profile: Profile;
  context: {
    jobId: string;
    storyId: string;
    userId: string;
    sceneCount?: number;
  };
}

export class GraphBuilder {
  build(options: GraphBuilderOptions): { graph: WorkflowGraph; counters: DependencyCounter } {
    const { profile, context } = options;
    const nodes = new Map<string, WorkflowNode>();
    const counters: DependencyCounter = {};

    const rootNodes: string[] = [];
    const sceneCount = context.sceneCount || 1;

    const sequentialBlocks = profile.blocks.filter(b => 
      b.capability !== 'image-generation' && b.capability !== 'video-generation' && b.capability !== 'voice-generation'
    );

    const imageBlocks = profile.blocks.filter(b => b.capability === 'image-generation');
    const voiceBlocks = profile.blocks.filter(b => b.capability === 'voice-generation');
    const videoBlocks = profile.blocks.filter(b => b.capability === 'video-generation');

    let previousNodeId: string | null = null;

    for (const block of sequentialBlocks) {
      const nodeId = `${block.id}-${generateUUID().slice(0, 8)}`;
      const dependencies = previousNodeId ? [previousNodeId] : [];

      const node: WorkflowNode = {
        nodeId,
        capability: block.capability,
        dependencies,
        childNodes: [],
        input: {},
        status: 'pending',
      };

      nodes.set(nodeId, node);

      if (dependencies.length > 0) {
        const parentNode = nodes.get(dependencies[0]);
        if (parentNode) {
          parentNode.childNodes.push(nodeId);
        }
      } else {
        rootNodes.push(nodeId);
      }

      counters[nodeId] = dependencies.length;
      previousNodeId = nodeId;
    }

    if (imageBlocks.length > 0 && previousNodeId) {
      const imageNodeId = `image-gen-batch-${generateUUID().slice(0, 8)}`;
      const imageNode: WorkflowNode = {
        nodeId: imageNodeId,
        capability: 'image-generation',
        dependencies: [previousNodeId],
        childNodes: [],
        input: { sceneCount },
        status: 'pending',
      };
      nodes.set(imageNodeId, imageNode);

      const parentNode = nodes.get(previousNodeId);
      if (parentNode) {
        parentNode.childNodes.push(imageNodeId);
      }

      counters[imageNodeId] = 1;
      previousNodeId = imageNodeId;
    }

    if (voiceBlocks.length > 0 && previousNodeId) {
      const voiceNodeId = `voice-gen-batch-${generateUUID().slice(0, 8)}`;
      const voiceNode: WorkflowNode = {
        nodeId: voiceNodeId,
        capability: 'voice-generation',
        dependencies: [previousNodeId],
        childNodes: [],
        input: { sceneCount },
        status: 'pending',
      };
      nodes.set(voiceNodeId, voiceNode);

      const parentNode = nodes.get(previousNodeId);
      if (parentNode) {
        parentNode.childNodes.push(voiceNodeId);
      }

      counters[voiceNodeId] = 1;
      previousNodeId = voiceNodeId;
    }

    if (videoBlocks.length > 0 && previousNodeId) {
      const videoNodeId = `video-gen-batch-${generateUUID().slice(0, 8)}`;
      const videoNode: WorkflowNode = {
        nodeId: videoNodeId,
        capability: 'video-generation',
        dependencies: [previousNodeId],
        childNodes: [],
        input: { sceneCount },
        status: 'pending',
      };
      nodes.set(videoNodeId, videoNode);

      const parentNode = nodes.get(previousNodeId);
      if (parentNode) {
        parentNode.childNodes.push(videoNodeId);
      }

      counters[videoNodeId] = 1;
    }

    const graph: WorkflowGraph = {
      nodes,
      rootNodes,
      nodeCount: nodes.size,
    };

    return { graph, counters };
  }
}

export function createGraphBuilder(): GraphBuilder {
  return new GraphBuilder();
}
