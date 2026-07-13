// Video Model Resolver — Traverses decision tree to select optimal video model
// Single source of truth for AI UGC Ads video model selection

import videoModelTree from '../config/video-model-decision-tree.json';

export interface VideoModelResolutionInput {
  selectedTier: string;
  userTier: string;
  productComplexity: 'simple' | 'complex';
}

export interface VideoModelResolution {
  model: string;
  provider: string;
  variant: string;
  resolution: string;
  duration: { min: number; max: number };
  pricing: { perSecond: number };
  features: string[];
  audioInput: 'driving_audio' | 'native';    // driving_audio = ElevenLabs TTS, native = model's own audio
  audioParam: 'audio_url' | 'audio_urls';    // Parameter name for audio input
  audioArray?: boolean;                       // If true, audioParam expects array format
  generateAudio?: boolean;                    // For Seedance: set false when using driving_audio
  strengths?: string[];
  bestFor?: string[];
  modelKey: string;
}

interface DecisionNode {
  field?: string;
  branches?: Record<string, DecisionNode | { ref: string }>;
  ref?: string;
}

/**
 * Resolve video model from decision tree
 * Strictly enforces the tree — no LLM override allowed
 */
export function resolveVideoModel(input: VideoModelResolutionInput): VideoModelResolution | null {
  const { selectedTier, userTier, productComplexity } = input;
  const tree = videoModelTree;

  // Traverse decision tree
  let currentNode: DecisionNode = tree.decisionTree;
  const context: Record<string, string> = {
    selectedTier,
    userTier,
    productComplexity,
  };

  while (currentNode.branches) {
    const fieldValue = context[currentNode.field || ''];
    if (!fieldValue) return null;

    const branch = currentNode.branches[fieldValue];
    if (!branch) return null;

    // Check if this is a terminal node with ref
    if ('ref' in branch && branch.ref) {
      const modelKey = branch.ref;
      const model = tree.models[modelKey as keyof typeof tree.models];
      if (!model) return null;

      return {
        model: model.id,
        provider: model.provider,
        variant: model.variant,
        resolution: model.resolution,
        duration: model.duration,
        pricing: model.pricing,
        features: model.features,
        audioInput: (model as any).audioInput || 'driving_audio',
        audioParam: (model as any).audioParam || 'audio_url',
        audioArray: (model as any).audioArray,
        generateAudio: (model as any).generateAudio,
        strengths: (model as any).strengths,
        bestFor: (model as any).bestFor,
        modelKey,
      };
    }

    // Continue traversal
    currentNode = branch as DecisionNode;
  }

  return null;
}

/**
 * Map video complexity score (0-1) to simple/complex
 * Threshold: 0.5
 */
export function mapComplexityScore(score: number): 'simple' | 'complex' {
  return score < 0.5 ? 'simple' : 'complex';
}

/**
 * Get all available models for reference
 */
export function getAllVideoModels() {
  return videoModelTree.models;
}

/**
 * Get model by key
 */
export function getVideoModelByKey(key: string) {
  return videoModelTree.models[key as keyof typeof videoModelTree.models] || null;
}

/**
 * Estimate cost for video generation
 */
export function estimateVideoCost(
  modelKey: string,
  durationSeconds: number
): number {
  const model = videoModelTree.models[modelKey as keyof typeof videoModelTree.models];
  if (!model) return 0;
  return model.pricing.perSecond * durationSeconds;
}

/**
 * Build audio input for video model
 * Wan 2.7: audio_url (single string)
 * Seedance: audio_urls (array)
 */
export function buildVideoAudioInput(
  resolution: VideoModelResolution,
  audioUrl: string
): Record<string, unknown> {
  if (resolution.audioArray) {
    // Seedance: expects audio_urls array
    return { audio_urls: [audioUrl] };
  } else {
    // Wan 2.7: expects audio_url string
    return { audio_url: audioUrl };
  }
}

/**
 * Validate that audio URL exists for models that require driving_audio
 */
export function validateAudioUrl(
  resolution: VideoModelResolution,
  audioUrl?: string
): { valid: boolean; error?: string } {
  if (resolution.audioInput === 'native') {
    // Native audio generation - no external audio needed
    return { valid: true };
  }

  if (!audioUrl) {
    return {
      valid: false,
      error: `Video model ${resolution.modelKey} requires driving_audio but no audio URL provided`
    };
  }

  // Basic URL validation
  try {
    new URL(audioUrl);
  } catch {
    return {
      valid: false,
      error: `Invalid audio URL: ${audioUrl}`
    };
  }

  return { valid: true };
}
