// Workflow resolver — traverses the workflow decision tree to resolve pipeline config
// Same pattern as video-model-resolver.ts (resolveVideoModel)
//
// Input: { videoType, templateId?, sceneReviewRequired?, productType?, mediaType? }
// Output: { nodes, defaults } — the resolved pipeline configuration
//
// The tree supports two terminal patterns:
// - "resolve": returns complete { nodes, defaults }
// - "baseNodes" + nested "field": partial config + further branching (branch output merges into baseNodes)

import { workflowTree, type WorkflowTreeNode, type WorkflowNode } from '../config/workflows/loader';

export interface WorkflowResolveInput {
  videoType: string;
  templateId?: string;
  sceneReviewRequired?: boolean;
  productType?: string;
  mediaType?: string;
}

export interface ResolvedWorkflow {
  nodes: WorkflowNode[];
  defaults: Record<string, any>;
}

/**
 * Resolve a workflow pipeline configuration by traversing the decision tree.
 *
 * Traversal rules:
 * 1. Start at root → read "field", look up value in input → descend into "branches[value]"
 * 2. If branch has "baseNodes" → collect them (partial template, further branching ahead)
 * 3. If branch has "defaults" → collect them
 * 4. If branch has nested "field" → continue traversal (deeper)
 * 5. If branch has "resolve" → return its { nodes, defaults } directly
 * 6. Branch leaf output (like { videoTrigger: "manual" }) → merge into collected baseNodes
 * 7. If no matching branch → try "default" branch → if none, return null
 */
export function resolveWorkflow(input: WorkflowResolveInput): ResolvedWorkflow | null {
  const result = traverse(workflowTree, input);
  if (!result) return null;

  return result;
}

function traverse(node: WorkflowTreeNode, input: WorkflowResolveInput): ResolvedWorkflow | null {
  // Terminal: "resolve" returns complete config
  if (node.resolve) {
    return {
      nodes: deepClone(node.resolve.nodes),
      defaults: deepClone(node.resolve.defaults || {}),
    };
  }

  // Need a field to branch on
  if (!node.field || !node.branches) {
    return null;
  }

  const fieldValue = getFieldValue(input, node.field);
  const branchKey = String(fieldValue);

  // Try exact match, then "default"
  let branch = node.branches[branchKey];
  if (!branch) {
    branch = node.branches['default'];
  }
  if (!branch) {
    return null;
  }

  // Collect baseNodes + defaults from this level
  let baseNodes: WorkflowNode[] | null = null;
  let defaults: Record<string, any> = {};

  if (node.baseNodes) {
    baseNodes = deepClone(node.baseNodes);
  }
  if (node.defaults) {
    defaults = { ...defaults, ...deepClone(node.defaults) };
  }

  // Continue deeper if the branch has its own field/branches
  if (branch.field || branch.resolve) {
    const deeper = traverse(branch, input);
    if (!deeper) return null;

    // Merge: if we had baseNodes, apply branch overrides (like videoTrigger) to them
    if (baseNodes) {
      // Check if deeper result has trigger override (from leaf like { videoTrigger: "manual" })
      const branchOverrides = extractBranchOverrides(branch, input);
      baseNodes = applyOverrides(baseNodes, branchOverrides);
      return {
        nodes: baseNodes,
        defaults: { ...defaults, ...deeper.defaults },
      };
    }

    return deeper;
  }

  // Branch itself has baseNodes (shared across its children)
  if (branch.baseNodes) {
    baseNodes = deepClone(branch.baseNodes);
  }
  if (branch.defaults) {
    defaults = { ...defaults, ...deepClone(branch.defaults) };
  }

  if (!baseNodes) {
    return null;
  }

  return { nodes: baseNodes, defaults };
}

/**
 * Extract override values from a branch leaf (e.g., { videoTrigger: "manual" }).
 * These get applied to the corresponding node in baseNodes.
 */
function extractBranchOverrides(branch: WorkflowTreeNode, input: WorkflowResolveInput): Record<string, any> {
  // If the branch has nested field/branches, traverse to find the leaf
  if (branch.field && branch.branches) {
    const fieldValue = getFieldValue(input, branch.field);
    const branchKey = String(fieldValue);
    let leaf = branch.branches[branchKey];
    if (!leaf) {
      leaf = branch.branches['default'];
    }
    if (leaf && !leaf.field && !leaf.resolve && !leaf.baseNodes) {
      // This is a leaf — collect its override properties (like videoTrigger)
      const overrides: Record<string, any> = {};
      for (const [key, value] of Object.entries(leaf)) {
        if (key !== 'field' && key !== 'branches' && key !== 'resolve' && key !== 'baseNodes' && key !== 'defaults') {
          overrides[key] = value;
        }
      }
      return overrides;
    }
  }
  return {};
}

/**
 * Apply branch overrides to baseNodes.
 * E.g., { videoTrigger: "manual" } → find video node, set trigger = "manual"
 */
function applyOverrides(nodes: WorkflowNode[], overrides: Record<string, any>): WorkflowNode[] {
  for (const [key, value] of Object.entries(overrides)) {
    // videoTrigger → set trigger on video node
    if (key === 'videoTrigger') {
      const videoNode = nodes.find(n => n.type === 'video');
      if (videoNode) {
        videoNode.trigger = value as 'auto' | 'manual' | 'post-action';
      }
    }
  }
  return nodes;
}

function getFieldValue(input: WorkflowResolveInput, field: string): string | boolean | undefined {
  switch (field) {
    case 'videoType': return input.videoType;
    case 'templateId': return input.templateId;
    case 'sceneReviewRequired': return input.sceneReviewRequired;
    case 'productType': return input.productType;
    case 'mediaType': return input.mediaType;
    default: return undefined;
  }
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ── Helper functions for consumers ──────────────────────────

/**
 * Get a specific node from a resolved workflow by type.
 */
export function getNode(resolved: ResolvedWorkflow, type: 'audio' | 'image' | 'video'): WorkflowNode | undefined {
  return resolved.nodes.find(n => n.type === type);
}

/**
 * Get the effective trigger for the video node.
 * Returns "auto" if video node exists and is enabled but has no trigger set.
 * Returns null if no video node or video is disabled.
 */
export function getVideoTrigger(resolved: ResolvedWorkflow): 'auto' | 'manual' | 'post-action' | null {
  const videoNode = getNode(resolved, 'video');
  if (!videoNode || !videoNode.enabled) return null;
  return videoNode.trigger || 'auto';
}

/**
 * Check if any post-action in the audio node produces video.
 */
export function hasVideoProducingPostActions(resolved: ResolvedWorkflow): boolean {
  const audioNode = getNode(resolved, 'audio');
  if (!audioNode?.postActions) return false;
  return audioNode.postActions.some(a => a.producesVideo === true);
}

/**
 * Compute which scene indices are expected to produce video.
 * - If video node is enabled with trigger "auto" or "manual" → all scenes
 * - If trigger is "post-action" → evaluate post-action conditions per scene
 * - If no video node → no scenes produce video
 *
 * Uses evaluateCondition from pipeline-config.
 */
export function computeExpectedVideoScenes(
  resolved: ResolvedWorkflow,
  scenes: any[]
): number[] {
  const videoNode = getNode(resolved, 'video');
  const audioNode = getNode(resolved, 'audio');

  // Case 1: Video node enabled with auto/manual trigger → all scenes produce video
  if (videoNode?.enabled && (videoNode.trigger === 'auto' || videoNode.trigger === 'manual')) {
    return scenes.map((_, i) => i);
  }

  // Case 2: Post-action based video generation
  if (audioNode?.postActions) {
    const videoScenes: number[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      for (const action of audioNode.postActions) {
        if (action.producesVideo === true) {
          // Dynamic import to avoid circular dependency
          const condition = action.condition;
          if (!condition || condition === 'always') {
            videoScenes.push(i);
            break;
          }
          // Evaluate condition using the same logic as pipeline-config
          if (evaluateConditionSafe(condition, scene)) {
            videoScenes.push(i);
            break;
          }
        }
      }
    }
    return videoScenes;
  }

  return [];
}

/**
 * Safe condition evaluation — mirrors pipeline-config.ts evaluateCondition logic.
 * Inlined here to avoid circular dependency.
 */
function evaluateConditionSafe(condition: string | undefined, scene: any): boolean {
  if (!condition || condition === 'always') return true;
  if (condition === 'never') return false;

  const productType = scene?.composer?.classification?.productType;
  const sceneType = scene?.composer?.sceneType;

  switch (condition) {
    case 'physical':
      return productType === 'physical';
    case 'screenshot':
      return productType === 'screenshot';
    case 'screen-recording':
      return productType === 'screen-recording';
    case 'mixed':
      return productType === 'mixed';
    case 'has-avatar':
      return scene?.composer?.avatarBehavior !== 'no-avatar';
    case 'intro':
      return sceneType === 'intro';
    case 'outro':
      return sceneType === 'outro';
    case 'demo':
      return sceneType === 'demo';
    case 'intro-or-outro':
      return (sceneType === 'intro' || sceneType === 'outro') && productType !== 'physical';
    case 'physical-or-intro-outro':
      return productType === 'physical' || sceneType === 'intro' || sceneType === 'outro';
    case 'physical-intro-outro':
      return productType === 'physical' && (sceneType === 'intro' || sceneType === 'outro');
    case 'physical-demo':
      return productType === 'physical' && sceneType !== 'intro' && sceneType !== 'outro';
    default:
      return false;
  }
}
