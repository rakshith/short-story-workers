// Graph Builder - builds DAG from profile blocks with per-scene fan-out

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

    // Separate blocks into sequential (script, scene) vs. fan-out (image, voice, video)
    const sequentialBlocks = profile.blocks.filter(b =>
      b.capability !== 'image-generation' && b.capability !== 'video-generation' && b.capability !== 'voice-generation'
    );

    const imageBlocks = profile.blocks.filter(b => b.capability === 'image-generation');
    const voiceBlocks = profile.blocks.filter(b => b.capability === 'voice-generation');
    const videoBlocks = profile.blocks.filter(b => b.capability === 'video-generation');

    // --- Sequential chain: script → scene ---
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

    // --- Fan-out: create per-scene nodes for parallel execution ---

    const lastSequentialNodeId = previousNodeId;
    let imageCollectorId: string | null = null;
    let voiceCollectorId: string | null = null;

    // Image generation: one node per scene, all depend on the last sequential node
    if (imageBlocks.length > 0 && lastSequentialNodeId) {
      const imageNodeIds = this.createPerSceneNodes(
        'image-generation', [lastSequentialNodeId], sceneCount, nodes, counters
      );
      // Collector: a node that depends on all image nodes completing
      const collectorId = `image-collector-${generateUUID().slice(0, 8)}`;
      const collector: WorkflowNode = {
        nodeId: collectorId,
        capability: 'image-generation',
        dependencies: imageNodeIds,
        childNodes: [],
        input: { isCollector: true, sceneCount },
        status: 'pending',
      };
      nodes.set(collectorId, collector);
      counters[collectorId] = imageNodeIds.length;
      // Register collector as child of each image node
      for (const id of imageNodeIds) {
        nodes.get(id)?.childNodes.push(collectorId);
      }
      imageCollectorId = collectorId;
    }

    // Voice generation: one node per scene, depends on last sequential node
    if (voiceBlocks.length > 0 && lastSequentialNodeId) {
      const voiceNodeIds = this.createPerSceneNodes(
        'voice-generation', [lastSequentialNodeId], sceneCount, nodes, counters
      );
      const collectorId = `voice-collector-${generateUUID().slice(0, 8)}`;
      const collector: WorkflowNode = {
        nodeId: collectorId,
        capability: 'voice-generation',
        dependencies: voiceNodeIds,
        childNodes: [],
        input: { isCollector: true, sceneCount },
        status: 'pending',
      };
      nodes.set(collectorId, collector);
      counters[collectorId] = voiceNodeIds.length;
      for (const id of voiceNodeIds) {
        nodes.get(id)?.childNodes.push(collectorId);
      }
      voiceCollectorId = collectorId;
    }

    // Video generation: one node per scene, depends on both image and voice collectors (if they exist), or last sequential
    const videoDependencies: string[] = [];
    if (imageCollectorId) videoDependencies.push(imageCollectorId);
    if (voiceCollectorId) videoDependencies.push(voiceCollectorId);
    if (videoDependencies.length === 0 && lastSequentialNodeId) {
      videoDependencies.push(lastSequentialNodeId);
    }

    if (videoBlocks.length > 0 && videoDependencies.length > 0) {
      const videoNodeIds = this.createPerSceneNodes(
        'video-generation', videoDependencies, sceneCount, nodes, counters
      );
      const collectorId = `video-collector-${generateUUID().slice(0, 8)}`;
      const collector: WorkflowNode = {
        nodeId: collectorId,
        capability: 'video-generation',
        dependencies: videoNodeIds,
        childNodes: [],
        input: { isCollector: true, sceneCount },
        status: 'pending',
      };
      nodes.set(collectorId, collector);
      counters[collectorId] = videoNodeIds.length;
      for (const id of videoNodeIds) {
        nodes.get(id)?.childNodes.push(collectorId);
      }
    }

    const graph: WorkflowGraph = {
      nodes,
      rootNodes,
      nodeCount: nodes.size,
    };

    return { graph, counters };
  }

  /**
   * Create individual nodes for each scene, all depending on the same parent node.
   * Returns the array of created node IDs.
   */
  private createPerSceneNodes(
    capability: WorkflowNode['capability'],
    parentDependencies: string[],
    sceneCount: number,
    nodes: Map<string, WorkflowNode>,
    counters: DependencyCounter,
  ): string[] {
    const nodeIds: string[] = [];
    const capShort = capability.split('-')[0]; // 'image', 'voice', 'video'

    for (let i = 0; i < sceneCount; i++) {
      const nodeId = `${capShort}-scene-${i}-${generateUUID().slice(0, 8)}`;
      const node: WorkflowNode = {
        nodeId,
        capability,
        dependencies: [...parentDependencies],
        childNodes: [],
        input: { sceneIndex: i, sceneCount },
        status: 'pending',
      };

      nodes.set(nodeId, node);
      counters[nodeId] = parentDependencies.length; // depends on parents

      // Register as child of parents
      for (const parentId of parentDependencies) {
        const parentNode = nodes.get(parentId);
        if (parentNode) {
          parentNode.childNodes.push(nodeId);
        }
      }

      nodeIds.push(nodeId);
    }

    return nodeIds;
  }
}

export function createGraphBuilder(): GraphBuilder {
  return new GraphBuilder();
}
