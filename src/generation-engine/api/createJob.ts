// Create Job API - creates a new generation job with mock support

import { generateUUID } from '../../utils/storage';
import { getMockDatabase } from '../storage/mockDatabase';
import { getMockStoryQueue, clearAllMockQueues } from '../queue/mockQueue';

export interface CreateJobRequest {
  userId: string;
  templateId: string;
  profileId?: string;
  prompt: string;
  videoConfig?: {
    aspectRatio?: string;
    resolution?: string;
    voice?: string;
    imageModel?: string;
    videoModel?: string;
    characterReferenceImages?: string[];
    seriesId?: string;
    teamId?: string;
    userTier?: string;
    enableSceneReview?: boolean;
  };
}

export interface CreateJobResponse {
  success: boolean;
  jobId: string;
  storyId: string;
  isMock?: boolean;
  error?: string;
}

export class CreateJobAPI {
  private env: any;
  private useMock: boolean;

  constructor(env: any) {
    this.env = env;
    this.useMock = env.GEN_PROVIDER === 'mock' || env.GEN_PROVIDER === 'mock';
    console.log('[CreateJob] GEN_PROVIDER:', env.GEN_PROVIDER, 'useMock:', this.useMock);
  }

  async execute(request: CreateJobRequest): Promise<CreateJobResponse> {
    try {
      const { getTemplate } = await import('../templates/index');
      const { profileRegistry } = await import('../profiles/index');

      const template = getTemplate(request.templateId);
      if (!template) {
        return { success: false, jobId: '', storyId: '', error: `Unknown template: ${request.templateId}` };
      }
      const profileId = request.profileId || template.profileId;
      const profile = profileRegistry.get(profileId);
      if (!profile) {
        return { success: false, jobId: '', storyId: '', error: `Unknown profile: ${profileId}` };
      }

      const jobId = generateUUID();
      const storyId = generateUUID();

      const videoConfig = {
        ...template.defaultConfig.videoConfig,
        ...request.videoConfig,
        templateId: request.templateId,
        sceneReviewRequired: request.videoConfig?.enableSceneReview ?? false,
      };

      let storyData = { title: request.prompt.substring(0, 100), scenes: [] };

      if (this.useMock) {
        console.log('[CreateJob] Using mock mode');
        
        const { createScriptService } = await import('../services/scriptService');
        const scriptService = createScriptService('mock-key', true);
        
        const scriptResult = await scriptService.generate({
          prompt: request.prompt,
          templateId: request.templateId,
          videoConfig,
        });
        
        storyData = scriptResult.story;

        const mockDb = getMockDatabase();
        await mockDb.insertStory({
          id: storyId,
          user_id: request.userId,
          story: storyData,
          video_config: videoConfig,
          status: 'pending',
        });

        await mockDb.insertJob({
          job_id: jobId,
          story_id: storyId,
          user_id: request.userId,
          status: 'pending',
          progress: 0,
          team_id: request.videoConfig?.teamId || null,
        });

        const mockQueue = getMockStoryQueue();
        await mockQueue.send({
          jobId,
          userId: request.userId,
          seriesId: request.videoConfig?.seriesId || '',
          storyId,
          title: storyData.title,
          storyData,
          videoConfig,
          sceneIndex: 0,
          type: 'image',
          baseUrl: 'http://localhost:8787',
          teamId: request.videoConfig?.teamId,
          userTier: request.videoConfig?.userTier || 'tier1',
          priority: 1,
        });

        console.log('[CreateJob] Mock job created successfully');
        
        return { 
          success: true, 
          jobId, 
          storyId,
          isMock: true,
        };
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          id: storyId,
          user_id: request.userId,
          story: storyData,
          video_config: videoConfig,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[CreateJob] Failed to create story:', insertError);
        return { success: false, jobId, storyId, error: insertError.message };
      }

      const { error: jobError } = await supabase
        .from('story_jobs')
        .insert({
          job_id: jobId,
          story_id: storyId,
          user_id: request.userId,
          status: 'pending',
          progress: 0,
          team_id: request.videoConfig?.teamId || null,
        });

      if (jobError) {
        console.error('[CreateJob] Failed to create job:', jobError);
        return { success: false, jobId, storyId, error: jobError.message };
      }

      const queueMessage = {
        jobId,
        userId: request.userId,
        seriesId: request.videoConfig?.seriesId || '',
        storyId,
        title: request.prompt.substring(0, 100),
        storyData,
        videoConfig,
        sceneIndex: 0,
        type: 'image' as const,
        baseUrl: this.env.APP_URL || 'https://create-story-worker.artflicks.workers.dev',
        teamId: request.videoConfig?.teamId,
        userTier: request.videoConfig?.userTier || 'tier1',
        priority: 1,
      };

      await this.env.STORY_QUEUE.send(queueMessage);

      return { success: true, jobId, storyId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CreateJob] Error:', message);
      return { success: false, jobId: '', storyId: '', error: message };
    }
  }
}

export function createCreateJobAPI(env: any): CreateJobAPI {
  return new CreateJobAPI(env);
}
