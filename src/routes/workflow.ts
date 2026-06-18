// Generic workflow route handler — dispatches to the registry
// Replaces duplicated boilerplate across create-story, generate-story, script-to-video, talking-avatar

import { Env } from '../types/env';
import { handleWorkflowRequest } from '../workflows/shared';
import { getWorkflow, listWorkflows } from '../workflows/registry';
import { jsonResponse } from '../utils/response';

/**
 * POST /workflow/:type
 * Dispatches to the registered workflow's validate + execute functions.
 * All concurrency, job init, and response formatting handled by the framework.
 */
export async function handleWorkflow(request: Request, env: Env, workflowId: string): Promise<Response> {
    const workflow = getWorkflow(workflowId);

    if (!workflow) {
        return jsonResponse({
            error: `Unknown workflow: ${workflowId}`,
            availableWorkflows: listWorkflows(),
        }, 404);
    }

    return handleWorkflowRequest(request, env, workflowId, {
        validate: workflow.validate,
        execute: workflow.execute,
    });
}
