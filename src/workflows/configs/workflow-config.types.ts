// Workflow Config Types — Defines the configuration structure for agent-based workflows
// Each workflow declares which agents it needs and how scenes are structured

export interface AgentConfig {
  enabled: boolean;
  model?: string;
}

export interface WorkflowAgentsConfig {
  vision?: AgentConfig;
  classification?: AgentConfig;
  scenePlanning?: AgentConfig;
  avatar?: AgentConfig;
  generation?: AgentConfig;
  composition?: AgentConfig;
}

export type SceneKind = 'hook' | 'feature' | 'proof' | 'cta' | 'demo' | 'reveal';
export type MediaSource = 'avatar' | 'user-uploaded' | 'ai-generated';

export interface SceneTemplate {
  duration: number;
  sceneKind: SceneKind;
  mediaSource: MediaSource;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  agents: WorkflowAgentsConfig;
  scenes: Record<string, SceneTemplate>;
  validate: (body: any) => string | null;
}
