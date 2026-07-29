import llmModelTree from './llm-model-decision-tree.json';

export interface LLMModelResolutionInput {
  userTier: string;
}

export interface LLMModelResolution {
  id: string;
  provider: string;
  costTier: string;
  strengths: string[];
  bestFor: string[];
  modelKey: string;
}

interface DecisionNode {
  field?: string;
  branches?: Record<string, DecisionNode | { ref: string }>;
  ref?: string;
}

function traverseTree(tree: typeof llmModelTree, rootKey: 'decisionTree' | 'visionDecisionTree', context: Record<string, string>): LLMModelResolution | null {
  let currentNode: DecisionNode = tree[rootKey];

  while (currentNode.branches) {
    const fieldValue = context[currentNode.field || ''];
    if (!fieldValue) return null;

    const branch = currentNode.branches[fieldValue];
    if (!branch) return null;

    if ('ref' in branch && branch.ref) {
      const modelKey = branch.ref;
      const model = tree.models[modelKey as keyof typeof tree.models];
      if (!model) return null;

      return {
        id: model.id,
        provider: model.provider,
        costTier: model.costTier,
        strengths: model.strengths,
        bestFor: model.bestFor,
        modelKey,
      };
    }

    currentNode = branch as DecisionNode;
  }

  return null;
}

export function resolveLLMModel(input: LLMModelResolutionInput): LLMModelResolution | null {
  return traverseTree(llmModelTree, 'decisionTree', { userTier: input.userTier });
}

export function resolveVisionModel(input: LLMModelResolutionInput): LLMModelResolution | null {
  return traverseTree(llmModelTree, 'visionDecisionTree', { userTier: input.userTier });
}
