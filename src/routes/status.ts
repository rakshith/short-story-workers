// Status endpoint handler - Check job progress

import { Env } from '../types/env';
import { jsonResponse } from '../utils/response';
import { getJobCost } from '../services/usage-tracking';

/**
 * GET /status?jobId=<jobId>
 * Returns the current status and progress of a story generation job
 */
export async function handleStatus(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
        return jsonResponse({ error: 'jobId parameter required' }, 400);
    }

    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const { data, error } = await supabase
            .from('story_jobs')
            .select('*')
            .eq('job_id', jobId)
            .single();

        if (error) {
            console.error('[Status] Supabase error:', error);
            if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
                return jsonResponse({ error: 'Job not found' }, 404);
            }
            return jsonResponse(
                {
                    error: 'Failed to get job status',
                    details: error.message || 'Unknown database error',
                    code: error.code
                },
                500
            );
        }

        if (!data) {
            return jsonResponse({ error: 'Job not found' }, 404);
        }

        // Get cost information for this job
        const costInfo = await getJobCost(jobId, env);

        return jsonResponse({
            jobId: data.job_id,
            status: data.status,
            progress: data.progress,
            totalScenes: data.total_scenes,
            imagesGenerated: data.images_generated,
            audioGenerated: data.audio_generated,
            error: data.error,
            storyId: data.story_id,
            cost: {
                total: costInfo.totalCost,
                breakdown: costInfo.breakdown,
                currency: 'USD',
            },
        });
    } catch (error) {
        console.error('[Status] Unexpected error:', error);
        return jsonResponse(
            { error: 'Failed to get job status', details: error instanceof Error ? error.message : 'Unknown error' },
            500
        );
    }
}
