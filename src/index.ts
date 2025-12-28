// Main Cloudflare Worker entry point - Uses Queues + Durable Objects for async processing

import { Env, QueueMessage } from './types/env';
import { CreateStoryRequest, StoryTimeline } from './types';
import { generateUUID } from './utils/storage';
import { updateJobStatus, JobStatus } from './services/queue-processor';
import { handleReplicateWebhook } from './services/webhook-handler';

// Export Durable Object class
export { StoryCoordinator } from './durable-objects/story-coordinator';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Status endpoint
    if (request.method === 'GET' && url.pathname === '/status') {
      const jobId = url.searchParams.get('jobId');
      if (!jobId) {
        return jsonResponse({ error: 'jobId parameter required' }, 400);
      }

      try {
        // Get job status from Supabase
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

        const { data, error } = await supabase
          .from('story_jobs')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (error) {
          console.error('[Status] Supabase error:', error);
          // Check if it's a "not found" error (PGRST116)
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

        return jsonResponse({
          jobId: data.job_id,
          status: data.status,
          progress: data.progress,
          totalScenes: data.total_scenes,
          imagesGenerated: data.images_generated,
          audioGenerated: data.audio_generated,
          error: data.error,
          storyId: data.story_id,
        });
      } catch (error) {
        console.error('[Status] Unexpected error:', error);
        return jsonResponse(
          { error: 'Failed to get job status', details: error instanceof Error ? error.message : 'Unknown error' },
          500
        );
      }
    }

    // Replicate Webhook endpoint
    if (request.method === 'POST' && url.pathname === '/webhooks/replicate') {
      return handleReplicateWebhook(request, env);
    }

    // Generate script and create story endpoint
    if (request.method === 'POST' && url.pathname === '/generate-and-create-story') {
      try {
        const body: any = await request.json();

        // Validate required fields
        if (!body.prompt || !body.duration || !body.videoConfig || !body.userId || !body.seriesId) {
          return jsonResponse(
            { error: 'Missing required fields: prompt, duration, videoConfig, userId, seriesId' },
            400
          );
        }

        // Generate job ID first
        const jobId = generateUUID();
        console.log(`[Generate Story] Job ID: ${jobId}, User: ${body.userId}`);

        // Progress Update 1/4: Initialize job at 0%
        try {
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'processing',
            progress: 0,
            totalScenes: 0,
            imagesGenerated: 0,
            audioGenerated: 0,
            teamId: body.teamId,
          }, env);
          console.log(`[Generate Story] Job ${jobId} initialized at 0%`);
        } catch (error) {
          console.error(`[Generate Story] Failed to create job ${jobId} in database:`, error);
          return jsonResponse(
            {
              error: 'Failed to initialize job',
              details: error instanceof Error ? error.message : 'Unknown error'
            },
            500
          );
        }

        console.log(`[Generate Story] Generating script from prompt: "${body.prompt.substring(0, 50)}..."`);

        // Generate script using AI
        const { generateScript } = await import('./services/script-generation');
        const scriptResult = await generateScript(
          {
            prompt: body.prompt,
            duration: body.duration,
            language: body.language || body.videoConfig?.language || 'en',
            model: body.model || body.videoConfig?.model || 'gpt-5.2',
          },
          env.OPENAI_API_KEY
        );

        if (!scriptResult.success || !scriptResult.story) {
          console.error('[Generate Story] Script generation failed:', scriptResult.error);
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'failed',
            progress: 0,
            totalScenes: 0,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: scriptResult.error || 'Failed to generate script',
            teamId: body.teamId,
          }, env);
          return jsonResponse(
            { error: 'Failed to generate script', details: scriptResult.error },
            500
          );
        }

        console.log(`[Generate Story] Script generated successfully with ${scriptResult.story.scenes.length} scenes`);

        // Now use the generated script to create the story
        const storyData = scriptResult.story;

        // Create initial story in database so queue consumer can update it
        let createdStory;
        try {
          const { StoryService } = await import('./services/supabase');
          const { ProjectStatus } = await import('./types');
          const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

          createdStory = await storyService.createStory({
            userId: body.userId,
            seriesId: body.seriesId,
            title: scriptResult.story?.title,
            videoType: body.videoConfig?.videoType || 'faceless-video',
            story: storyData,
            status: ProjectStatus.PROCESSING,
            videoConfig: body.videoConfig,
            storyCost: body.videoConfig?.estimatedCredits,
            teamId: body.teamId,
          });
          console.log(`[Generate Story] Initial story created in database with ID: ${createdStory.id}`);

          // Progress Update 2/4: Script generated & story created - 25%
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: ProjectStatus.PROCESSING,
            progress: 25,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            storyId: createdStory.id,
            teamId: body.teamId,
          }, env);
          console.log(`[Generate Story] Progress updated to 25% - Script & story created`);
        } catch (error) {
          console.error(`[Generate Story] Failed to create story:`, error);
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'failed',
            progress: 0,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: error instanceof Error ? error.message : 'Failed to create story',
            teamId: body.teamId,
          }, env);
          return jsonResponse(
            {
              error: 'Failed to create story',
              details: error instanceof Error ? error.message : 'Unknown error'
            },
            500
          );
        }

        // Use the storyId from the created story
        const storyId = createdStory.id;

        // Initialize Durable Object for this story
        const coordinatorId = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(coordinatorId);
        await coordinator.fetch(new Request('http://do/init', {
          method: 'POST',
          body: JSON.stringify({
            storyId,
            userId: body.userId,
            scenes: storyData.scenes,
            totalScenes: storyData.scenes.length,
          }),
        }));
        console.log(`[Generate Story] Durable Object initialized for story ${storyId}`);

        // Queue image generation jobs
        const imagePromises = storyData.scenes.map((scene, index) => {
          const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: body.title,
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: index,
            type: 'image',
            baseUrl: url.origin,
          };
          return env.STORY_QUEUE.send(message);
        });

        await Promise.all(imagePromises);
        console.log(`[Generate Story] Queued ${storyData.scenes.length} image generation jobs`);

        // Queue audio generation jobs for ALL scenes
        const audioPromises = [];
        for (let i = 0; i < storyData.scenes.length; i++) {
          const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: body.title,
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: i,
            type: 'audio',
            baseUrl: url.origin,
          };
          audioPromises.push(env.STORY_QUEUE.send(message));
        }
        await Promise.all(audioPromises);
        console.log(`[Generate Story] Queued ${storyData.scenes.length} audio generation jobs`);

        // Finalization will be triggered automatically by the queue consumer 
        // once all scene images and audio are generated.
        console.log(`[Generate Story] Queued finalization job with 10s delay`);

        return jsonResponse({
          success: true,
          jobId,
          message: 'Story generation started',
          storyId,
          generatedScript: storyData,
        });
      } catch (error) {
        console.error('[Generate Story] Error:', error);
        return jsonResponse(
          { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
          500
        );
      }
    }

    // Create story endpoint - queues jobs for async processing
    if (request.method === 'POST' && url.pathname === '/create-story') {
      try {
        const body: CreateStoryRequest = await request.json();

        // Validate required fields
        if (!body.script || !body.videoConfig || !body.userId || !body.seriesId) {
          return jsonResponse(
            { error: 'Missing required fields: script, videoConfig, userId, seriesId' },
            400
          );
        }

        // Parse script JSON
        let storyData: StoryTimeline;
        try {
          storyData = typeof body.script === 'string' ? JSON.parse(body.script) : body.script;
        } catch (error) {
          return jsonResponse({ error: 'Invalid script JSON format' }, 400);
        }

        if (!storyData.scenes || !Array.isArray(storyData.scenes) || storyData.scenes.length === 0) {
          return jsonResponse({ error: 'Script must contain at least one scene' }, 400);
        }

        // Generate job ID
        const jobId = generateUUID();

        console.log(`[Create Story] Queuing job ${jobId} for user ${body.userId}`);
        console.log(`[Create Story] Story: ${body.title}, Scenes: ${storyData.scenes.length}`);

        // Create initial story in database so queue consumer can update it
        let createdStory;
        try {
          const { StoryService } = await import('./services/supabase');
          const { ProjectStatus } = await import('./types');
          const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

          createdStory = await storyService.createStory({
            userId: body.userId,
            seriesId: body.seriesId,
            title: storyData.title,
            videoType: body.videoConfig?.videoType || 'faceless-video',
            story: storyData,
            status: ProjectStatus.PROCESSING,
            videoConfig: body.videoConfig,
            storyCost: body.videoConfig?.estimatedCredits,
            teamId: body.teamId,
          });
          console.log(`[Create Story] Initial story created in database with ID: ${createdStory.id}`);

          // Progress Update 1/4: Job initialized & story created - 25%
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'processing',
            progress: 25,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            storyId: createdStory.id,
            teamId: body.teamId,
          }, env);
          console.log(`[Create Story] Progress updated to 25% - Story created`);
        } catch (error) {
          console.error(`[Create Story] Failed to create story:`, error);
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'failed',
            progress: 0,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: error instanceof Error ? error.message : 'Failed to create story',
            teamId: body.teamId,
          }, env);
          return jsonResponse(
            {
              error: 'Failed to create story',
              details: error instanceof Error ? error.message : 'Unknown error'
            },
            500
          );
        }

        // Use the storyId from the created story
        const storyId = createdStory.id;

        // Initialize Durable Object for this story
        const coordinatorId = env.STORY_COORDINATOR.idFromName(storyId);
        const coordinator = env.STORY_COORDINATOR.get(coordinatorId);
        await coordinator.fetch(new Request('http://do/init', {
          method: 'POST',
          body: JSON.stringify({
            storyId,
            userId: body.userId,
            scenes: storyData.scenes,
            totalScenes: storyData.scenes.length,
          }),
        }));
        console.log(`[Create Story] Durable Object initialized for story ${storyId}`);

        // Queue image generation jobs for all scenes (parallel)
        const imagePromises = storyData.scenes.map((scene, index) => {
          const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: storyData.title,
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: index,
            type: 'image',
            baseUrl: url.origin,
          };
          return env.STORY_QUEUE.send(message);
        });

        await Promise.all(imagePromises);
        console.log(`[Create Story] Queued ${storyData.scenes.length} image generation jobs`);

        // Queue audio generation jobs for ALL scenes
        // Both image and audio process in parallel in the queue consumer
        const audioPromises = [];
        for (let i = 0; i < storyData.scenes.length; i++) {
          const message: QueueMessage = {
            jobId,
            userId: body.userId,
            seriesId: body.seriesId,
            storyId,
            title: storyData.title,
            storyData,
            videoConfig: body.videoConfig,
            sceneIndex: i,
            type: 'audio',
            baseUrl: url.origin,
          };
          audioPromises.push(env.STORY_QUEUE.send(message));
        }
        await Promise.all(audioPromises);
        console.log(`[Create Story] Queued ${storyData.scenes.length} audio generation jobs`);

        // Finalization will be triggered automatically by the queue consumer

        // Return job ID immediately
        return jsonResponse({
          success: true,
          jobId,
          status: 'pending',
          message: 'Story generation queued successfully. Use /status?jobId=' + jobId + ' to check progress.',
          stats: {
            totalScenes: storyData.scenes.length,
          },
        });
      } catch (error) {
        console.error('[Create Story] Error:', error);
        return jsonResponse(
          {
            error: 'Failed to queue story generation',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        );
      }
    }

    // Legacy synchronous endpoint (for small stories < 5 scenes)
    if (request.method === 'POST' && url.pathname === '/create-story-sync') {
      // Keep the original synchronous implementation for small stories
      // This can be used for stories with < 5 scenes that can complete within time limits
      return jsonResponse({ error: 'Synchronous endpoint deprecated. Use /create-story instead.' }, 410);
    }

    // Handle root path with helpful error message
    if (url.pathname === '/') {
      return jsonResponse({
        error: 'Invalid endpoint',
        message: `The root path '/' is not a valid endpoint. Please use one of the available endpoints:`,
        availableEndpoints: {
          'POST /create-story': 'Create a new story (queued for async processing)',
          'GET /status?jobId=<jobId>': 'Check the status of a story generation job',
        },
        method: request.method,
        path: url.pathname,
      }, 404);
    }

    // Handle all other unmatched routes
    return jsonResponse({
      error: 'Not found',
      message: `The endpoint '${url.pathname}' does not exist.`,
      method: request.method,
      path: url.pathname,
      availableEndpoints: {
        'POST /create-story': 'Create a new story (queued for async processing)',
        'GET /status?jobId=<jobId>': 'Check the status of a story generation job',
      },
    }, 404);
  },

  // Queue consumer - Uses Durable Objects for race-condition-free updates
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    const { processSceneImage, processSceneAudio } = await import('./services/queue-processor');

    // Helper to get Durable Object stub for a story
    const getCoordinator = (storyId: string) => {
      const id = env.STORY_COORDINATOR.idFromName(storyId);
      return env.STORY_COORDINATOR.get(id);
    };

    for (const message of batch.messages) {
      try {
        const data: QueueMessage = message.body;
        console.log(`[Queue] Processing ${data.type} for job ${data.jobId}, scene ${data.sceneIndex}`);
        const coordinator = getCoordinator(data.storyId);

        if (data.type === 'image') {
          // Generate the image
          const result = await processSceneImage(data, env);
          console.log(`[IMAGE] Scene ${data.sceneIndex} result:`, { success: result.success, imageUrl: result.imageUrl });

          const updateRes = await coordinator.fetch(new Request('http://do/updateImage', {
            method: 'POST',
            body: JSON.stringify({
              sceneIndex: data.sceneIndex,
              imageUrl: result.imageUrl,
              imageError: result.success ? undefined : result.error,
            }),
          }));

          const status = await updateRes.json() as any;
          if (status.isComplete) {
            await syncStoryToSupabase({
              jobId: data.jobId,
              storyId: data.storyId,
              userId: data.userId
            }, coordinator, env);
          }

          message.ack();
        } else if (data.type === 'audio') {
          // Generate the audio
          const result = await processSceneAudio(data, env);
          console.log(`[AUDIO] Scene ${data.sceneIndex} result:`, { success: result.success, audioUrl: result.audioUrl });

          // Update via Durable Object (no race condition)
          const updateRes = await coordinator.fetch(new Request('http://do/updateAudio', {
            method: 'POST',
            body: JSON.stringify({
              sceneIndex: data.sceneIndex,
              audioUrl: result.audioUrl,
              audioDuration: result.audioDuration,
              captions: result.captions,
              audioError: result.success ? undefined : result.error,
            }),
          }));

          const status = await updateRes.json() as any;
          if (status.isComplete) {
            await syncStoryToSupabase({
              jobId: data.jobId,
              storyId: data.storyId,
              userId: data.userId
            }, coordinator, env);
          }

          message.ack();
        }
      } catch (error) {
        console.error('[Queue] Error:', error);

        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

          const data: QueueMessage = message.body;
          await supabase
            .from('story_jobs')
            .update({
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
              updated_at: new Date().toISOString(),
            })
            .eq('job_id', data.jobId);
        } catch (dbError) {
          console.error('[Queue] Failed to update error status in DB:', dbError);
        }

        message.retry();
      }
    }
  },
};

/**
 * Finalize story and sync all generated content from Durable Object to Supabase
 */
export async function syncStoryToSupabase(data: { jobId: string; storyId: string; userId: string }, coordinator: any, env: Env): Promise<void> {
  console.log(`[FINALIZE] All scenes complete, syncing to database for job ${data.jobId}`);

  try {
    const finalRes = await coordinator.fetch(new Request('http://do/finalize', { method: 'POST' }));
    const finalData = await finalRes.json() as any;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // Get current story and merge with Durable Object state
    const { data: currentStory } = await supabase
      .from('stories')
      .select('story')
      .eq('id', data.storyId)
      .single();

    if (currentStory?.story && finalData.scenes) {
      const updatedStory = { ...currentStory.story };
      // Merge each scene's generated content
      finalData.scenes.forEach((scene: any, idx: number) => {
        if (updatedStory.scenes[idx]) {
          updatedStory.scenes[idx] = {
            ...updatedStory.scenes[idx],
            ...scene,
          };
        }
      });

      // Single DB write with all updates
      await supabase
        .from('stories')
        .update({ story: updatedStory, status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', data.storyId);
    }

    // Mark job complete (Progress 4/4: 100%)
    await supabase
      .from('story_jobs')
      .update({
        status: 'completed',
        progress: 100,
        images_generated: finalData.imagesCompleted,
        audio_generated: finalData.audioCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', data.jobId);

    console.log(`[FINALIZE] Complete! Story synced to database.`);
  } catch (error) {
    console.error('[FINALIZE] Error syncing to Supabase:', error);
    throw error; // Re-throw to be caught by the main queue catch block
  }
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
