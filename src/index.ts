// Main Cloudflare Worker entry point - Now uses Queues for async processing

import { Env, QueueMessage } from './types/env';
import { CreateStoryRequest, CreateStoryResponse, StoryTimeline, AspectRatio } from './types';
import { generateUUID } from './utils/storage';
import { updateJobStatus, JobStatus } from './services/queue-processor';

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

        console.log(`[Generate Story] Generating script from prompt: "${body.prompt.substring(0, 50)}..."`);

        // Generate script using AI
        const { generateScript } = await import('./services/script-generation');
        const scriptResult = await generateScript(
          {
            prompt: body.prompt,
            duration: body.duration,
            language: body.language || 'en',
            model: body.model || 'gpt-4o',
          },
          env.OPENAI_API_KEY
        );

        if (!scriptResult.success || !scriptResult.story) {
          console.error('[Generate Story] Script generation failed:', scriptResult.error);
          return jsonResponse(
            { error: 'Failed to generate script', details: scriptResult.error },
            500
          );
        }

        console.log(`[Generate Story] Script generated successfully with ${scriptResult.story.scenes.length} scenes`);

        // Now use the generated script to create the story
        const storyData = scriptResult.story;
        const jobId = generateUUID();

        console.log(`[Generate Story] Job ID: ${jobId}, User: ${body.userId}`);
        console.log(`[Generate Story] Story: ${body.title}, Scenes: ${storyData.scenes.length}`);

        // Initialize job status
        try {
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'pending',
            progress: 0,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
          }, env);
          console.log(`[Generate Story] Job ${jobId} created successfully in database`);
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
          });
          console.log(`[Generate Story] Initial story created in database with ID: ${createdStory.id}`);
        } catch (error) {
          console.error(`[Generate Story] Failed to create story:`, error);
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
          };
          return env.STORY_QUEUE.send(message);
        });

        await Promise.all(imagePromises);
        console.log(`[Generate Story] Queued ${storyData.scenes.length} image generation jobs`);

        // Queue audio generation jobs
        for (let i = 0; i < storyData.scenes.length; i++) {
          const scene = storyData.scenes[i];
          if (scene.narration) {
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
            };
            await env.STORY_QUEUE.send(message);
          }
        }
        console.log(`[Generate Story] Queued audio generation jobs`);

        // Queue finalization job
        const finalizeMessage: QueueMessage = {
          jobId,
          userId: body.userId,
          seriesId: body.seriesId,
          storyId,
          title: body.title,
          storyData,
          videoConfig: body.videoConfig,
          sceneIndex: 0,
          type: 'finalize',
        };
        await env.STORY_QUEUE.send(finalizeMessage);
        console.log(`[Generate Story] Queued finalization job`);

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
        if (!body.script || !body.videoConfig || !body.userId || !body.seriesId || !body.title) {
          return jsonResponse(
            { error: 'Missing required fields: script, videoConfig, userId, seriesId, title' },
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

        // Initialize job status
        try {
          await updateJobStatus(jobId, {
            jobId,
            userId: body.userId,
            status: 'pending',
            progress: 0,
            totalScenes: storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
          }, env);
          console.log(`[Create Story] Job ${jobId} created successfully in database`);
        } catch (error) {
          console.error(`[Create Story] Failed to create job ${jobId} in database:`, error);
          return jsonResponse(
            { 
              error: 'Failed to initialize job', 
              details: error instanceof Error ? error.message : 'Unknown error' 
            },
            500
          );
        }

        // Create initial story in database so queue consumer can update it
        let createdStory;
        try {
          const { StoryService } = await import('./services/supabase');
          const { ProjectStatus } = await import('./types');
          const storyService = new StoryService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          createdStory = await storyService.createStory({
            userId: body.userId,
            seriesId: body.seriesId,
            title: body.title,
            videoType: body.videoConfig?.videoType || 'faceless-video',
            story: storyData,
            status: ProjectStatus.PROCESSING,
            videoConfig: body.videoConfig,
            storyCost: body.videoConfig?.estimatedCredits,
          });
          console.log(`[Create Story] Initial story created in database with ID: ${createdStory.id}`);
        } catch (error) {
          console.error(`[Create Story] Failed to create story:`, error);
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

        // Queue image generation jobs for all scenes (parallel)
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
          };
          return env.STORY_QUEUE.send(message);
        });

        await Promise.all(imagePromises);
        console.log(`[Create Story] Queued ${storyData.scenes.length} image generation jobs`);

        // Queue audio generation jobs sequentially (to avoid rate limits)
        // Audio jobs are queued immediately; both image and audio process in parallel in the queue consumer
        for (let i = 0; i < storyData.scenes.length; i++) {
          const scene = storyData.scenes[i];
          if (scene.narration) {
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
            };
            await env.STORY_QUEUE.send(message);
          }
        }
        console.log(`[Create Story] Queued audio generation jobs`);

        // Queue finalization job
        const finalizeMessage: QueueMessage = {
          jobId,
          userId: body.userId,
          seriesId: body.seriesId,
          storyId,
          title: body.title,
          storyData,
          videoConfig: body.videoConfig,
          sceneIndex: 0,
          type: 'finalize',
        };
        await env.STORY_QUEUE.send(finalizeMessage);

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

  // Queue consumer
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    const { processSceneImage, processSceneAudio } = await import('./services/queue-processor');
    
    for (const message of batch.messages) {
      try {
        const data: QueueMessage = message.body;
        console.log(`[Queue Consumer] Processing ${data.type} for job ${data.jobId}, scene ${data.sceneIndex}`);

        if (data.type === 'image') {
          console.log(`[IMAGE] Processing scene ${data.sceneIndex}, storyId: ${data.storyId}`);
          const result = await processSceneImage(data, env);
          console.log(`[IMAGE] Result:`, { success: result.success, imageUrl: result.imageUrl });
          
          // Update the story with the generated image URL
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          // Get current story
          console.log(`[IMAGE] Fetching story from DB: userId=${data.userId}, storyId=${data.storyId}`);
          const { data: story, error: fetchError } = await supabase
            .from('stories')
            .select('*')
            .eq('user_id', data.userId)
            .eq('id', data.storyId)
            .single();
          
          console.log(`[IMAGE] Story fetch result:`, { 
            found: !!story, 
            hasStory: !!story?.story,
            scenesCount: story?.story?.scenes?.length,
            error: fetchError?.message 
          });
          
          if (story?.story) {
            // Update the specific scene - merge with existing scene data
            const updatedStory = { ...story.story };
            if (updatedStory.scenes[data.sceneIndex]) {
              updatedStory.scenes[data.sceneIndex] = {
                ...updatedStory.scenes[data.sceneIndex],
                generatedImageUrl: result.imageUrl,
                ...(result.success ? {} : { generationError: result.error }),
              };
            }
            
            console.log(`[IMAGE] Updating scene ${data.sceneIndex} with imageUrl: ${result.imageUrl}`);
            
            // Save updated story
            const { error: updateError } = await supabase
              .from('stories')
              .update({ story: updatedStory })
              .eq('user_id', data.userId)
              .eq('id', data.storyId);
            
            if (updateError) {
              console.error(`[IMAGE] Failed to update story:`, updateError);
            } else {
              console.log(`[IMAGE] Story updated successfully!`);
            }
          } else {
            console.error(`[IMAGE] Story not found in database!`, { userId: data.userId, storyId: data.storyId });
          }
          
          // Update job status
          const { data: jobData } = await supabase
            .from('story_jobs')
            .select('*')
            .eq('job_id', data.jobId)
            .single();

          const imagesGenerated = (jobData?.images_generated || 0) + (result.success ? 1 : 0);
          const progress = Math.round((imagesGenerated / data.storyData.scenes.length) * 50); // Images are 50% of progress

          await supabase
            .from('story_jobs')
            .upsert({
              job_id: data.jobId,
              user_id: data.userId,
              status: 'processing',
              progress,
              total_scenes: data.storyData.scenes.length,
              images_generated: imagesGenerated,
              audio_generated: jobData?.audio_generated || 0,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'job_id',
            });

          message.ack();
        } else if (data.type === 'audio') {
          console.log(`[AUDIO] Processing scene ${data.sceneIndex}, storyId: ${data.storyId}`);
          const result = await processSceneAudio(data, env);
          console.log(`[AUDIO] Result:`, { success: result.success, audioUrl: result.audioUrl, captions: result.captions?.length });
          
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          // Update the story with the generated audio URL and captions
          console.log(`[AUDIO] Fetching story from DB: userId=${data.userId}, storyId=${data.storyId}`);
          const { data: story, error: fetchError } = await supabase
            .from('stories')
            .select('*')
            .eq('user_id', data.userId)
            .eq('id', data.storyId)
            .single();
          
          console.log(`[AUDIO] Story fetch result:`, { 
            found: !!story, 
            hasStory: !!story?.story,
            scenesCount: story?.story?.scenes?.length,
            error: fetchError?.message 
          });
          
          if (story?.story) {
            // Update the specific scene with audio and captions - merge with existing scene data
            const updatedStory = { ...story.story };
            if (updatedStory.scenes[data.sceneIndex]) {
              updatedStory.scenes[data.sceneIndex] = {
                ...updatedStory.scenes[data.sceneIndex],
                audioUrl: result.audioUrl,
                audioDuration: result.audioDuration,
                captions: result.captions,
                ...(result.success ? {} : { audioGenerationError: result.error }),
              };
            }
            
            console.log(`[AUDIO] Updating scene ${data.sceneIndex} with audioUrl: ${result.audioUrl}, captions: ${result.captions?.length || 0}`);
            
            // Save updated story
            const { error: updateError } = await supabase
              .from('stories')
              .update({ story: updatedStory })
              .eq('user_id', data.userId)
              .eq('id', data.storyId);
            
            if (updateError) {
              console.error(`[AUDIO] Failed to update story:`, updateError);
            } else {
              console.log(`[AUDIO] Story updated successfully with captions!`);
            }
          } else {
            console.error(`[AUDIO] Story not found in database!`, { userId: data.userId, storyId: data.storyId });
          }
          
          // Update job progress
          const { data: jobData } = await supabase
            .from('story_jobs')
            .select('*')
            .eq('job_id', data.jobId)
            .single();

          const audioGenerated = (jobData?.audio_generated || 0) + (result.success ? 1 : 0);
          const imagesGenerated = jobData?.images_generated || 0;
          const progress = Math.round(50 + (audioGenerated / data.storyData.scenes.length) * 50); // Audio is 50-100% of progress

          await supabase
            .from('story_jobs')
            .upsert({
              job_id: data.jobId,
              user_id: data.userId,
              status: 'processing',
              progress,
              total_scenes: data.storyData.scenes.length,
              images_generated: imagesGenerated,
              audio_generated: audioGenerated,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'job_id',
            });

          message.ack();
        } else if (data.type === 'finalize') {
          console.log(`[FINALIZE] Starting finalization for job ${data.jobId}, storyId: ${data.storyId}`);
          
          // Wait a bit to ensure all images and audio are processed
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          // Get final job status
          const { data: jobData } = await supabase
            .from('story_jobs')
            .select('*')
            .eq('job_id', data.jobId)
            .single();

          console.log(`[FINALIZE] Job status:`, {
            imagesGenerated: jobData?.images_generated,
            audioGenerated: jobData?.audio_generated,
            totalScenes: data.storyData.scenes.length,
          });

          // Update story status to DRAFT (images and audio were already saved incrementally)
          const { error: updateError } = await supabase
            .from('stories')
            .update({ status: 'draft' })
            .eq('user_id', data.userId)
            .eq('id', data.storyId);

          if (updateError) {
            console.error(`[FINALIZE] Failed to update story status:`, updateError);
          } else {
            console.log(`[FINALIZE] Story status updated to DRAFT`);
          }

          // Mark job as completed
          await supabase
            .from('story_jobs')
            .upsert({
              job_id: data.jobId,
              user_id: data.userId,
              status: 'completed',
              progress: 100,
              total_scenes: data.storyData.scenes.length,
              images_generated: jobData?.images_generated || data.storyData.scenes.length,
              audio_generated: jobData?.audio_generated || data.storyData.scenes.length,
              story_id: data.storyId,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'job_id',
            });

          console.log(`[FINALIZE] Finalization completed successfully`);
          message.ack();
        }
      } catch (error) {
        console.error('[Queue Consumer] Error processing message:', error);
        
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        
        const data: QueueMessage = message.body;
        await supabase
          .from('story_jobs')
          .upsert({
            job_id: data.jobId,
            user_id: data.userId,
            status: 'failed',
            progress: 0,
            total_scenes: data.storyData.scenes.length,
            images_generated: 0,
            audio_generated: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'job_id',
          });
        
        message.retry();
      }
    }
  },
};

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
