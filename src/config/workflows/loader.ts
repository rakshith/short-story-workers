// Workflow loader — assembles per-workflow subtrees into a single decision tree
// Adding a new workflow = add a JSON file + one import here

import characterVideo from './character-video.json';
import facelessVideo from './faceless-video.json';
import aiUgcAds from './ai-ugc-ads.json';
import talkingAvatar from './talking-avatar.json';

export interface WorkflowTreeNode {
  field?: string;
  branches?: Record<string, WorkflowTreeNode>;
  baseNodes?: WorkflowNode[];
  defaults?: Record<string, any>;
  resolve?: {
    nodes: WorkflowNode[];
    defaults?: Record<string, any>;
  };
}

export interface WorkflowNode {
  id: string;
  type: 'audio' | 'image' | 'video';
  enabled: boolean;
  trigger?: 'auto' | 'manual' | 'post-action';
  postActions?: Array<{
    type: string;
    agent?: string;
    condition?: string;
    producesVideo?: boolean;
  }>;
}

export const workflowTree: WorkflowTreeNode = {
  field: 'videoType',
  branches: {
    'character-video': characterVideo as WorkflowTreeNode,
    'faceless-video': facelessVideo as WorkflowTreeNode,
    'ai-ugc-ads': aiUgcAds as WorkflowTreeNode,
    'talking-avatar': talkingAvatar as WorkflowTreeNode,
  },
};
