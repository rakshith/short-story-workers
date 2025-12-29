// Cancel story generation endpoint handler

import { Env } from '../types/env';
import { jsonResponse } from '../utils/response';
import { ProjectStatus } from '../types';

interface CancelStoryRequest {
    jobId: string;
}

/**
 * POST /cancel-generation
 * Cancels a currently running story generation job
 */
export async function handleCancelStory(request: Request, env: Env): Promise<Response> {
    try {
        const body: CancelStoryRequest = await request.json();

        if (!body.jobId) {
            return jsonResponse({ error: 'jobId is required' }, 400);
        }

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get the job and its current status
        const { data: job, error: jobError } = await supabase
            .from('story_jobs')
            .select('status, story_id, user_id')
            .eq('job_id', body.jobId)
            .single();

        if (jobError || !job) {
            console.error('[Cancel Story] Job not found:', jobError);
            return jsonResponse({ error: 'Job not found' }, 404);
        }

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            return jsonResponse({ 
                success: true, 
                message: `Job is already in a final state: ${job.status}`,
                status: job.status
            });
        }

        // 2. Update job status in database to 'failed' with cancelled message
        // Using 'failed' to be compatible with existing DB check constraints
        const { error: updateError } = await supabase
            .from('story_jobs')
            .update({
                status: 'failed',
                error: 'Cancelled by user',
                updated_at: new Date().toISOString(),
            })
            .eq('job_id', body.jobId);

        if (updateError) {
            console.error('[Cancel Story] Failed to update job status:', updateError);
            return jsonResponse({ error: 'Failed to cancel job in database' }, 500);
        }

        // 3. Update story status if it exists
        if (job.story_id) {
            await supabase
                .from('stories')
                .update({ 
                    status: ProjectStatus.CANCELLED,
                    updated_at: new Date().toISOString() 
                })
                .eq('id', job.story_id);

            // 4. Notify Durable Object to stop processing
            try {
                const coordinatorId = env.STORY_COORDINATOR.idFromName(job.story_id);
                const coordinator = env.STORY_COORDINATOR.get(coordinatorId);
                await coordinator.fetch(new Request('http://do/cancel', {
                    method: 'POST',
                }));
                console.log(`[Cancel Story] Notified Durable Object for story ${job.story_id}`);
            } catch (doError) {
                console.error('[Cancel Story] Failed to notify Durable Object:', doError);
                // Non-fatal, DB update is primary
            }
        }

        return jsonResponse({
            success: true,
            message: 'Story generation cancelled successfully',
            jobId: body.jobId
        });
    } catch (error) {
        console.error('[Cancel Story] Error:', error);
        return jsonResponse(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
            500
        );
    }
}

