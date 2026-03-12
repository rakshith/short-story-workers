// Core types for the Generation Engine DAG-based pipeline

export type NodeStatus = 'pending' | 'running' | 'waiting_webhook' | 'completed' | 'failed' | 'timeout';

export type NodeCapability = 
  | 'script-generation'
  | 'scene-parsing'
  | 'image-generation'
  | 'video-generation'
  | 'voice-generation'
  | 'transcription'
  | 'summary';

export interface WorkflowNode {
  nodeId: string;
  capability: NodeCapability;
  dependencies: string[];
  childNodes: string[];
  input: Record<string, unknown>;
  output?: unknown;
  status: NodeStatus;
  retryCount?: number;
  error?: string;
}

export interface WorkflowGraph {
  nodes: Map<string, WorkflowNode>;
  rootNodes: string[];
  nodeCount: number;
}

export interface DependencyCounter {
  [nodeId: string]: number;
}

export interface JobExecutionState {
  jobId: string;
  userId: string;
  templateId: string;
  profileId: string;
  graph: WorkflowGraph;
  dependencyCounters: DependencyCounter;
  completedNodes: Set<string>;
  failedNodes: Set<string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  profileId: string;
  defaultConfig: TemplateConfig;
}

export interface TemplateConfig {
  videoConfig?: Record<string, unknown>;
  generationOptions?: GenerationOptions;
}

export interface GenerationOptions {
  enableSceneReview?: boolean;
  enableAutoVideoGeneration?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  blocks: BlockDefinition[];
  config?: ProfileConfig;
}

export interface ProfileConfig {
  defaultModels?: {
    image?: string;
    video?: string;
    voice?: string;
    script?: string;
  };
  concurrency?: number;
  priority?: number;
}

export interface BlockDefinition {
  id: string;
  capability: NodeCapability;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface Block {
  id: string;
  capability: NodeCapability;
  execute(input: BlockInput): Promise<BlockOutput>;
}

export interface BlockInput {
  context: ExecutionContext;
  data: unknown;
}

export interface BlockOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ExecutionContext {
  jobId: string;
  storyId: string;
  userId: string;
  sceneIndex?: number;
  sceneCount?: number;
  videoConfig: VideoConfigContext;
  env: unknown;
}

export interface VideoConfigContext {
  templateId: string;
  aspectRatio: string;
  resolution: string;
  voice?: string;
  imageModel?: string;
  videoModel?: string;
  characterReferenceImages?: string[];
  enableVoiceOver?: boolean;
  enableCaptions?: boolean;
  sceneReviewRequired?: boolean;
}

export interface QueueMessage {
  jobId: string;
  storyId: string;
  userId: string;
  nodeId: string;
  capability: NodeCapability;
  sceneIndex?: number;
  input: Record<string, unknown>;
}

export interface WebhookPayload {
  predictionId: string;
  status: 'succeeded' | 'failed' | 'canceled';
  output?: unknown;
  error?: string;
}
