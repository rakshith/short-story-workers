// Backend Workflow Registry — maps workflow IDs to their definitions
// New workflows: register here + create a pipeline file in this directory

import { Env } from '../types/env';
import { WorkflowResult, ResolvedTier } from './shared';

export interface WorkflowDefinition {
    id: string;
    name: string;
    validate: (body: any) => string | null;  // returns error message or null
    execute: (body: any, context: {
        jobId: string;
        resolved: ResolvedTier;
        baseUrl: string;
        env: Env;
    }) => Promise<WorkflowResult>;
}

const workflows = new Map<string, WorkflowDefinition>();

/**
 * Register a new workflow definition
 */
export function registerWorkflow(def: WorkflowDefinition): void {
    workflows.set(def.id, def);
    console.log(`[Workflow Registry] Registered: ${def.id} (${def.name})`);
}

/**
 * Get a workflow definition by ID
 */
export function getWorkflow(id: string): WorkflowDefinition | undefined {
    return workflows.get(id);
}

/**
 * List all registered workflow IDs
 */
export function listWorkflows(): string[] {
    return Array.from(workflows.keys());
}

// ─── Register built-in workflows ─────────────────────────────────────────────

// Talking Avatar — imported here to auto-register
import { talkingAvatarDefinition } from './talking-avatar';
registerWorkflow(talkingAvatarDefinition);

// Faceless Video — imported here to auto-register
import { facelessVideoDefinition } from './faceless-video';
registerWorkflow(facelessVideoDefinition);

// Character Video — imported here to auto-register
import { characterVideoDefinition } from './character-video';
registerWorkflow(characterVideoDefinition);
