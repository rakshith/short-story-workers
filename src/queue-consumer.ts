// Queue consumer worker for processing story generation jobs
// Note: This file is now integrated into index.ts as the queue handler
// Keeping for reference but the queue handler is in index.ts

import { Env, QueueMessage } from './types/env';
import { processSceneImage, processSceneAudio, finalizeStory, updateJobStatus, JobStatus } from './services/queue-processor';
import { queueLogger } from './utils/logger';

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    queueLogger.info(`Queue batch received`, { 
      batchSize: batch.messages.length,
      queue: batch.queue 
    });

    for (const message of batch.messages) {
      const startTime = Date.now();
      const messageId = message.id;
      
      try {
        const data: QueueMessage = message.body;
        
        queueLogger.info(`Processing message`, {
          messageId,
          type: data.type,
          jobId: data.jobId,
          sceneIndex: data.sceneIndex,
          userId: data.userId,
          title: data.title,
        });

        // Update job status to processing
        await updateJobStatus(data.jobId, {
          jobId: data.jobId,
          status: 'processing',
          progress: 0,
          totalScenes: data.storyData.scenes.length,
          imagesGenerated: 0,
          audioGenerated: 0,
        }, env);

        if (data.type === 'image') {
          console.log(`[QUEUE] Starting image generation for scene ${data.sceneIndex}, storyId: ${data.storyId}`);
          
          queueLogger.debug(`Starting image generation`, {
            messageId,
            jobId: data.jobId,
            sceneIndex: data.sceneIndex,
          });

          // Process image generation
          console.log(`[QUEUE] Calling processSceneImage...`);
          const result = await queueLogger.logApiCall(
            'processSceneImage',
            () => processSceneImage(data, env),
            { messageId, jobId: data.jobId, sceneIndex: data.sceneIndex }
          );
          
          console.log(`[QUEUE] Image generation result:`, {
            success: result.success,
            imageUrl: result.imageUrl,
            error: result.error,
          });
          
          queueLogger.info(`Image generation completed`, {
            messageId,
            jobId: data.jobId,
            sceneIndex: data.sceneIndex,
            success: result.success,
            imageUrl: result.imageUrl,
            error: result.error,
          });
          
          // Update the story scene with generated image URL
          console.log(`[IMAGE UPDATE] Attempting to update story. StoryID: ${data.storyId}, UserID: ${data.userId}, SceneIndex: ${data.sceneIndex}, ImageURL: ${result.imageUrl}`);
          
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          queueLogger.debug(`Fetching story from database`, {
            messageId,
            userId: data.userId,
            storyId: data.storyId,
          });

          // Get current story using userId and storyId
          const { data: story, error: fetchError } = await supabase
            .from('stories')
            .select('story')
            .eq('user_id', data.userId)
            .eq('id', data.storyId)
            .single();
          
          if (fetchError) {
            queueLogger.error(`Failed to fetch story`, fetchError, {
              messageId,
              userId: data.userId,
              storyId: data.storyId,
            });
          }
          
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
            
            queueLogger.debug(`Updating story in database`, {
              messageId,
              sceneIndex: data.sceneIndex,
              imageUrl: result.imageUrl,
            });
            
            // Save updated story using userId and storyId
            const { error: updateError } = await supabase
              .from('stories')
              .update({ story: updatedStory })
              .eq('user_id', data.userId)
              .eq('id', data.storyId);

            if (updateError) {
              queueLogger.error(`Failed to update story`, updateError, {
                messageId,
                userId: data.userId,
                title: data.title,
              });
            } else {
              queueLogger.info(`Story updated successfully`, {
                messageId,
                sceneIndex: data.sceneIndex,
              });
            }
          } else {
            queueLogger.warn(`Story not found in database`, {
              messageId,
              userId: data.userId,
              title: data.title,
            });
          }
          
          const duration = Date.now() - startTime;
          queueLogger.info(`Message processed successfully`, {
            messageId,
            type: 'image',
            duration: `${duration}ms`,
          });
          
          message.ack();
        } else if (data.type === 'audio') {
          queueLogger.debug(`Starting audio generation`, {
            messageId,
            jobId: data.jobId,
            sceneIndex: data.sceneIndex,
          });

          // Process audio generation
          const result = await queueLogger.logApiCall(
            'processSceneAudio',
            () => processSceneAudio(data, env),
            { messageId, jobId: data.jobId, sceneIndex: data.sceneIndex }
          );
          
          queueLogger.info(`Audio generation completed`, {
            messageId,
            jobId: data.jobId,
            sceneIndex: data.sceneIndex,
            success: result.success,
            audioUrl: result.audioUrl,
            audioDuration: result.audioDuration,
            error: result.error,
          });
          
          // Update the story scene with generated audio URL
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          queueLogger.debug(`Fetching story from database`, {
            messageId,
            userId: data.userId,
            storyId: data.storyId,
          });

          // Get current story using userId and storyId
          const { data: story, error: fetchError } = await supabase
            .from('stories')
            .select('story')
            .eq('user_id', data.userId)
            .eq('id', data.storyId)
            .single();
          
          if (fetchError) {
            queueLogger.error(`Failed to fetch story`, fetchError, {
              messageId,
              userId: data.userId,
              storyId: data.storyId,
            });
          }
          
          if (story?.story) {
            // Update the specific scene - merge with existing scene data
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
            
            queueLogger.debug(`Updating story in database`, {
              messageId,
              sceneIndex: data.sceneIndex,
              audioUrl: result.audioUrl,
            });
            
            // Save updated story using userId and storyId
            const { error: updateError } = await supabase
              .from('stories')
              .update({ story: updatedStory })
              .eq('user_id', data.userId)
              .eq('id', data.storyId);

            if (updateError) {
              queueLogger.error(`Failed to update story`, updateError, {
                messageId,
                userId: data.userId,
                storyId: data.storyId,
              });
            } else {
              queueLogger.info(`Story updated successfully`, {
                messageId,
                sceneIndex: data.sceneIndex,
              });
            }
          } else {
            queueLogger.warn(`Story not found in database`, {
              messageId,
              userId: data.userId,
              storyId: data.storyId,
            });
          }
          
          const duration = Date.now() - startTime;
          queueLogger.info(`Message processed successfully`, {
            messageId,
            type: 'audio',
            duration: `${duration}ms`,
          });
          
          message.ack();
        } else if (data.type === 'finalize') {
          queueLogger.info(`Starting finalization`, {
            messageId,
            jobId: data.jobId,
          });

          // Update story status to DRAFT
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          
          queueLogger.debug(`Updating story status to DRAFT`, {
            messageId,
            userId: data.userId,
            storyId: data.storyId,
          });

          const { error: updateError } = await supabase
            .from('stories')
            .update({ status: 'draft' })
            .eq('user_id', data.userId)
            .eq('id', data.storyId);

          if (updateError) {
            queueLogger.error(`Failed to update story status`, updateError, {
              messageId,
              userId: data.userId,
              storyId: data.storyId,
            });
          } else {
            queueLogger.info(`Story status updated to DRAFT`, {
              messageId,
              userId: data.userId,
              storyId: data.storyId,
            });
          }

          // Mark job as completed
          await updateJobStatus(data.jobId, {
            jobId: data.jobId,
            status: 'completed',
            progress: 100,
            totalScenes: data.storyData.scenes.length,
            imagesGenerated: data.storyData.scenes.length,
            audioGenerated: data.storyData.scenes.length,
            storyId: data.storyId,
          }, env);
          
          queueLogger.info(`Finalization completed`, {
            messageId,
            jobId: data.jobId,
          });
          
          message.ack();
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const data: QueueMessage = message.body;
        
        queueLogger.error(`Error processing message`, error, {
          messageId,
          type: data.type,
          jobId: data.jobId,
          sceneIndex: data.sceneIndex,
          duration: `${duration}ms`,
        });
        
        // Update job status to failed
        try {
          await updateJobStatus(data.jobId, {
            jobId: data.jobId,
            status: 'failed',
            progress: 0,
            totalScenes: data.storyData.scenes.length,
            imagesGenerated: 0,
            audioGenerated: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          }, env);
        } catch (statusError) {
          queueLogger.error(`Failed to update job status`, statusError, {
            messageId,
            jobId: data.jobId,
          });
        }
        
        message.retry();
      }
    }
    
    queueLogger.info(`Batch processing completed`, {
      batchSize: batch.messages.length,
      queue: batch.queue,
    });
  },
};

