// Job Status API - retrieves job status with mock support

import { getMockDatabase } from '../storage/mockDatabase';

export interface JobStatusResponse {
  success: boolean;
  jobId?: string;
  storyId?: string;
  status?: string;
  progress?: number;
  imagesGenerated?: number;
  videosGenerated?: number;
  audioGenerated?: number;
  totalScenes?: number;
  isMock?: boolean;
  error?: string;
}

export class JobStatusAPI {
  private env: any;
  private useMock: boolean;

  constructor(env: any) {
    this.env = env;
    this.useMock = env.GEN_PROVIDER === 'mock';
  }

  async execute(jobId: string): Promise<JobStatusResponse> {
    try {
      if (this.useMock) {
        console.log('[JobStatus] Using mock mode');
        const mockDb = getMockDatabase();
        
        const job = await mockDb.getJob(jobId);
        if (!job.data) {
          return { success: false, error: 'Job not found' };
        }

        const story = await mockDb.getStory(job.data.story_id);
        
        if (!story.data) {
          return { 
            success: true,
            jobId: job.data.job_id,
            storyId: job.data.story_id,
            status: job.data.status,
            progress: job.data.progress,
            isMock: true,
          };
        }

        const scenes = story.data.story?.scenes || [];
        const sceneCount = scenes.length;
        const imagesGenerated = scenes.filter((s: any) => s.generatedImageUrl).length;
        const videosGenerated = scenes.filter((s: any) => s.generatedVideoUrl).length;
        const audioGenerated = scenes.filter((s: any) => s.audioUrl).length;

        return {
          success: true,
          jobId: job.data.job_id,
          storyId: job.data.story_id,
          status: job.data.status,
          progress: job.data.progress,
          imagesGenerated,
          videosGenerated,
          audioGenerated,
          totalScenes: sceneCount,
          isMock: true,
        };
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: job, error: jobError } = await supabase
        .from('story_jobs')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (jobError || !job) {
        return { success: false, error: 'Job not found' };
      }

      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', job.story_id)
        .single();

      if (storyError || !story) {
        return { 
          success: true,
          jobId: job.job_id,
          storyId: job.story_id,
          status: job.status,
          progress: job.progress,
        };
      }

      const sceneCount = story.story?.scenes?.length || 0;
      const imagesGenerated = story.story?.scenes?.filter((s: any) => s.generatedImageUrl).length || 0;
      const videosGenerated = story.story?.scenes?.filter((s: any) => s.generatedVideoUrl).length || 0;
      const audioGenerated = story.story?.scenes?.filter((s: any) => s.audioUrl).length || 0;

      return {
        success: true,
        jobId: job.job_id,
        storyId: job.story_id,
        status: job.status,
        progress: job.progress,
        imagesGenerated,
        videosGenerated,
        audioGenerated,
        totalScenes: sceneCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[JobStatus] Error:', message);
      return { success: false, error: message };
    }
  }

  async getByStoryId(storyId: string): Promise<JobStatusResponse> {
    try {
      if (this.useMock) {
        const mockDb = getMockDatabase();
        const jobs = await mockDb.getJobsByStory(storyId);
        
        if (!jobs.data || jobs.data.length === 0) {
          return { success: false, error: 'No active job found for story' };
        }

        const activeJob = jobs.data[0];
        return this.execute(activeJob.job_id);
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: job, error } = await supabase
        .from('story_jobs')
        .select('*')
        .eq('story_id', storyId)
        .in('status', ['pending', 'processing', 'awaiting_review'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !job) {
        return { success: false, error: 'No active job found for story' };
      }

      return this.execute(job.job_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

export function createJobStatusAPI(env: any): JobStatusAPI {
  return new JobStatusAPI(env);
}
