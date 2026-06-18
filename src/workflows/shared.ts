// Shared workflow utilities — eliminates boilerplate duplicated across route handlers
// Used by all workflow pipelines (faceless, character, talking-avatar)

import { Env } from '../types/env';
import { generateUUID } from '../utils/storage';
import { updateJobStatus } from '../services/queue-processor';
import { jsonResponse } from '../utils/response';
import { parseTier, getPriorityForTier, getConcurrencyForTier, getConcurrencyWindowForTier } from '../config/tier-config';

export interface WorkflowInput {
    userId: string;
    teamId?: string;
    userTier?: string;
    totalScenes?: number;
    [key: string]: any;
}

export interface WorkflowResult {
    success: boolean;
    storyId?: string;
    jobId?: string;
    error?: string;
    cost?: any;
    creditsDeducted?: boolean;
    creditError?: string;
    [key: string]: any;
}

export interface ResolvedTier {
    tier: string;
    priority: number;
    maxConcurrency: number;
    windowMinutes: number;
}

/**
 * Parse user tier and resolve concurrency/priority settings
 */
export function resolveTier(userTier?: string, env?: Env): ResolvedTier {
    const tier = parseTier(userTier);
    return {
        tier,
        priority: env ? getPriorityForTier(tier, env) : 1,
        maxConcurrency: env ? getConcurrencyForTier(tier, env) : 2,
        windowMinutes: env ? getConcurrencyWindowForTier(tier, env) : 10,
    };
}

/**
 * Check if user has capacity for another job within their tier's concurrency limit.
 * Returns null if allowed, or a Response (429) if at limit.
 */
export async function checkConcurrency(
    userId: string,
    resolved: ResolvedTier,
    env: Env,
    logPrefix: string = 'Workflow'
): Promise<Response | null> {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const windowCutoff = new Date(Date.now() - resolved.windowMinutes * 60 * 1000).toISOString();
    const { data: activeJobs, error: checkError } = await supabase
        .from('story_jobs')
        .select('job_id')
        .eq('user_id', userId)
        .eq('status', 'processing')
        .gte('created_at', windowCutoff);

    if (checkError) {
        console.error(`[${logPrefix}] Failed to check concurrency:`, checkError);
        // Fail-open: allow if check fails
        return null;
    }

    const activeCount = activeJobs?.length || 0;
    if (activeCount >= resolved.maxConcurrency) {
        console.log(`[${logPrefix}] Concurrency limit reached for user ${userId} (${activeCount}/${resolved.maxConcurrency}) within ${resolved.windowMinutes} min window`);
        return jsonResponse({
            error: 'Concurrency limit reached',
            message: `You have ${activeCount} active generations in the last ${resolved.windowMinutes} minutes. Your tier (${resolved.tier}) allows ${resolved.maxConcurrency} concurrent jobs. Please wait for a job to complete.`,
            activeJobs: activeCount,
            maxConcurrency: resolved.maxConcurrency,
            tier: resolved.tier,
            windowMinutes: resolved.windowMinutes,
        }, 429);
    }

    return null; // allowed
}

/**
 * Generate a job ID and initialize the job at 0% progress
 */
export async function initJob(
    userId: string,
    teamId: string | undefined,
    totalScenes: number,
    env: Env,
    logPrefix: string = 'Workflow'
): Promise<string> {
    const jobId = generateUUID();
    console.log(`[${logPrefix}] Job: ${jobId}, User: ${userId}`);

    await updateJobStatus(jobId, {
        jobId,
        userId,
        status: 'processing',
        progress: 0,
        totalScenes,
        imagesGenerated: 0,
        audioGenerated: 0,
        teamId,
    }, env);

    return jobId;
}

/**
 * Build a standardized workflow success response
 */
export function buildSuccessResponse(data: {
    jobId: string;
    storyId?: string;
    message?: string;
    cost?: any;
    creditsDeducted?: boolean;
    creditError?: string;
    [key: string]: any;
}): Response {
    return jsonResponse({
        success: true,
        message: 'Generation started',
        ...data,
    });
}

/**
 * Build a standardized workflow error response
 */
export function buildErrorResponse(error: string, status: number = 500, details?: any): Response {
    return jsonResponse({
        success: false,
        error,
        details,
    }, status);
}

/**
 * Full workflow request handler — runs the standard boilerplate:
 * 1. Parse tier + resolve concurrency settings
 * 2. Check concurrency
 * 3. Init job at 0%
 * 4. Call the workflow's execute function
 * 5. Return standardized response
 *
 * Workflow implementations only need to provide: validate + execute
 */
export async function handleWorkflowRequest(
    request: Request,
    env: Env,
    workflowId: string,
    options: {
        validate: (body: any) => string | null;
        execute: (body: any, context: {
            jobId: string;
            resolved: ResolvedTier;
            baseUrl: string;
            env: Env;
        }) => Promise<WorkflowResult>;
    }
): Promise<Response> {
    const url = new URL(request.url);
    let body: any;
    let jobId = '';

    try {
        body = await request.json();

        // Validate workflow-specific fields
        const validationError = options.validate(body);
        if (validationError) {
            return jsonResponse({ error: validationError }, 400);
        }

        // Resolve tier
        const resolved = resolveTier(body.userTier || body.videoConfig?.userTier, env);

        // Check concurrency
        const concurrencyResponse = await checkConcurrency(body.userId, resolved, env, workflowId);
        if (concurrencyResponse) {
            return concurrencyResponse;
        }

        // Skip initJob for resume requests — the resume path manages its own job
        jobId = body.storyId
            ? body.storyId  // placeholder; resume path ignores this and uses its own
            : await initJob(body.userId, body.teamId, body.totalScenes || 0, env, workflowId);

        // Execute workflow-specific logic
        const result = await options.execute(body, {
            jobId,
            resolved,
            baseUrl: url.origin,
            env,
        });

        if (!result.success) {
            // Mark job as failed (skip for resume — it manages its own job)
            if (!body.storyId) {
                await updateJobStatus(jobId, {
                    jobId,
                    userId: body.userId,
                    status: 'failed',
                    progress: 0,
                    totalScenes: body.totalScenes || 0,
                    imagesGenerated: 0,
                    audioGenerated: 0,
                    error: result.error || 'Generation failed',
                    teamId: body.teamId,
                }, env).catch(() => {});
            }
            return buildErrorResponse(result.error || 'Generation failed', 500);
        }

        return buildSuccessResponse({
            jobId,
            storyId: result.storyId,
            cost: result.cost,
            creditsDeducted: result.creditsDeducted,
            creditError: result.creditError,
            ...result,
        });
    } catch (error) {
        console.error(`[${workflowId}] Error:`, error);
        // Mark job as failed if it was created (skip for resume or if body wasn't parsed)
        if (typeof body !== 'undefined' && !body.storyId && jobId) {
            await updateJobStatus(jobId, {
                jobId,
                userId: body.userId,
                status: 'failed',
                progress: 0,
                totalScenes: body.totalScenes || 0,
                imagesGenerated: 0,
                audioGenerated: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
                teamId: body.teamId,
            }, env).catch(() => {});
        }
        return buildErrorResponse(
            error instanceof Error ? error.message : 'Unknown error',
            500
        );
    }
}
