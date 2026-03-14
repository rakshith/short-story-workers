// Approve Step API - approves a step to continue pipeline with mock support

import { getMockDatabase } from '../storage/mockDatabase';
import { getMockStoryQueue } from '../queue/mockQueue';

export interface ApproveStepRequest {
  jobId: string;
  storyId: string;
  userId: string;
  approvedScenes?: number[];
  step: 'scene-review';
}

export interface ApproveStepResponse {
  success: boolean;
  jobId?: string;
  storyId?: string;
  videosQueued?: number;
  isMock?: boolean;
  error?: string;
}

export class ApproveStepAPI {
  private env: any;
  private useMock: boolean;
  private requestUrl?: string;

  constructor(env: any, requestUrl?: string) {
    this.env = env;
    this.requestUrl = requestUrl;
    this.useMock = env.GEN_PROVIDER === 'mock';
  }

  private getBaseUrl(): string {
    if (this.requestUrl) {
      return new URL(this.requestUrl).origin;
    }
    return 'https://create-story-worker.artflicks.workers.dev';
  }

  async execute(request: ApproveStepRequest): Promise<ApproveStepResponse> {
    try {
      if (this.useMock) {
        console.log('[ApproveStep] Using mock mode');
        const mockDb = getMockDatabase();
        
        const story = await mockDb.getStory(request.storyId);
        if (!story.data) {
          return { success: false, jobId: request.jobId, storyId: request.storyId, error: 'Story not found' };
        }

        if (story.data.status !== 'awaiting_review') {
          return { 
            success: false, 
            jobId: request.jobId, 
            storyId: request.storyId, 
            error: 'Story is not awaiting review' 
          };
        }

        const scenes = story.data.story?.scenes || [];
        const scenesToApprove = request.approvedScenes || scenes.map((_: any, i: number) => i);
        let videosQueued = 0;

        const mockQueue = getMockStoryQueue();

        for (const sceneIndex of scenesToApprove) {
          const scene = scenes[sceneIndex];
          if (!scene || !scene.generatedImageUrl) continue;

          await mockQueue.send({
            jobId: request.jobId,
            userId: request.userId,
            seriesId: story.data.video_config?.seriesId || '',
            storyId: request.storyId,
            title: story.data.story?.title || '',
            storyData: story.data.story,
            videoConfig: story.data.video_config,
            sceneIndex,
            type: 'video',
            baseUrl: 'http://localhost:8787',
            teamId: story.data.video_config?.teamId,
            userTier: story.data.video_config?.userTier || 'tier1',
            priority: 2,
            generatedImageUrl: scene.generatedImageUrl,
          });
          videosQueued++;
        }

        await mockDb.updateStory(request.storyId, { 
          status: 'processing',
        });

        await mockDb.updateJob(request.jobId, { status: 'processing' });

        console.log(`[ApproveStep] Mock: Queued ${videosQueued} videos`);

        return {
          success: true,
          jobId: request.jobId,
          storyId: request.storyId,
          videosQueued,
          isMock: true,
        };
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', request.storyId)
        .single();

      if (storyError || !story) {
        return { success: false, jobId: request.jobId, storyId: request.storyId, error: 'Story not found' };
      }

      if (story.status !== 'awaiting_review') {
        return { 
          success: false, 
          jobId: request.jobId, 
          storyId: request.storyId, 
          error: 'Story is not awaiting review' 
        };
      }

      const scenes = story.story?.scenes || [];
      const scenesToApprove = request.approvedScenes || scenes.map((_: any, i: number) => i);
      let videosQueued = 0;

      for (const sceneIndex of scenesToApprove) {
        const scene = scenes[sceneIndex];
        if (!scene || !scene.generatedImageUrl) continue;

        const queueMessage = {
          jobId: request.jobId,
          userId: request.userId,
          seriesId: story.video_config?.seriesId || '',
          storyId: request.storyId,
          title: story.story?.title || '',
          storyData: story.story,
          videoConfig: story.video_config,
          sceneIndex,
          type: 'video' as const,
          baseUrl: this.getBaseUrl(),
          teamId: story.video_config?.teamId,
          userTier: story.video_config?.userTier || 'tier1',
          priority: 2,
          generatedImageUrl: scene.generatedImageUrl,
        };

        await this.env.STORY_QUEUE.send(queueMessage);
        videosQueued++;
      }

      await supabase
        .from('stories')
        .update({ 
          status: 'processing',
          video_generation_triggered: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.storyId);

      await supabase
        .from('story_jobs')
        .update({ status: 'processing' })
        .eq('job_id', request.jobId);

      return {
        success: true,
        jobId: request.jobId,
        storyId: request.storyId,
        videosQueued,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ApproveStep] Error:', message);
      return { success: false, jobId: request.jobId, storyId: request.storyId, error: message };
    }
  }

  /**
   * Approve review to resume job from AWAITING_REVIEW phase
   */
  async approveReview(jobId: string, storyId: string): Promise<ApproveStepResponse> {
    try {
      const storyCoordinator = this.env.STORY_COORDINATOR as { idFromName: (name: string) => any; get: (id: any) => any };
      const coordinatorId = storyCoordinator.idFromName(storyId);
      const coordinator = storyCoordinator.get(coordinatorId);

      // Call DO handler to approve review
      const approveRes = await coordinator.fetch(new Request('http://do/approveReview', {
        method: 'POST',
      }));

      const approveData = await approveRes.json() as any;

      if (!approveData.success) {
        return { 
          success: false, 
          jobId, 
          storyId, 
          error: approveData.error || 'Failed to approve review' 
        };
      }

      console.log(`[ApproveStep] Review approved for job ${jobId}, phase: ${approveData.phase}`);

      return {
        success: true,
        jobId,
        storyId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ApproveStep] Error approving review:', message);
      return { success: false, jobId, storyId, error: message };
    }
  }
}

export function createApproveStepAPI(env: any, requestUrl?: string): ApproveStepAPI {
  return new ApproveStepAPI(env, requestUrl);
}
