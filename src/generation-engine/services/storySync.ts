// Story Sync Service - syncs story data to Supabase

export interface SyncOptions {
  jobId: string;
  storyId: string;
  userId: string;
  teamId?: string;
  timeline?: unknown;
}

export interface SyncResult {
  success: boolean;
  storyUrl?: string;
  error?: string;
}

export class StorySyncService {
  private env: any;
  private useMock: boolean;

  constructor(env: any) {
    this.env = env;
    this.useMock = env.GEN_PROVIDER === 'mock';
  }

  async syncPartialStory(options: SyncOptions, scenes: any[]): Promise<SyncResult> {
    if (this.useMock) {
      console.log('[StorySync] Mock mode - skipping partial sync');
      return { success: true };
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: currentStory } = await supabase
        .from('stories')
        .select('story')
        .eq('id', options.storyId)
        .single();

      if (!currentStory?.story) {
        return { success: false, error: 'Story not found' };
      }

      const updatedStory = { ...currentStory.story };
      if (updatedStory.scenes && scenes) {
        scenes.forEach((scene: any, idx: number) => {
          if (updatedStory.scenes[idx]) {
            updatedStory.scenes[idx] = {
              ...updatedStory.scenes[idx],
              ...scene,
            };
          }
        });
      }

      await supabase
        .from('stories')
        .update({
          story: updatedStory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', options.storyId);

      console.log(`[StorySync] Partial sync completed for story ${options.storyId}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StorySync] Partial sync failed:', message);
      return { success: false, error: message };
    }
  }

  async syncStoryComplete(options: SyncOptions, story: any): Promise<SyncResult> {
    if (this.useMock) {
      console.log('[StorySync] Mock mode - skipping complete sync');
      return { success: true, storyUrl: 'https://mock-url.com/story' };
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      // Read-merge-write: read current story from DB, merge scene data, write back
      // This preserves fields like imagePrompt, narration, etc. from the original script
      const { data: currentStory } = await supabase
        .from('stories')
        .select('story')
        .eq('id', options.storyId)
        .single();

      let updatedStory = story;

      if (currentStory?.story && story.scenes) {
        updatedStory = { ...currentStory.story };
        story.scenes.forEach((scene: any, idx: number) => {
          if (updatedStory.scenes[idx]) {
            updatedStory.scenes[idx] = {
              ...updatedStory.scenes[idx],
              ...scene,
            };
          }
        });
      }

      const totalDuration = updatedStory.scenes?.reduce((sum: number, scene: any) => {
        return sum + (scene.audioDuration || scene.duration || 0);
      }, 0) || 0;

      const finalVideoUrl = updatedStory.scenes?.[0]?.generatedVideoUrl || null;

      const storyUpdate: Record<string, unknown> = {
        story: updatedStory,
        status: 'draft',
        final_video_url: finalVideoUrl,
        total_duration: totalDuration,
        updated_at: new Date().toISOString(),
      };

      if (options.timeline !== undefined) {
        storyUpdate.timeline = options.timeline;
      }

      await supabase
        .from('stories')
        .update(storyUpdate)
        .eq('id', options.storyId);

      await supabase
        .from('story_jobs')
        .update({
          status: 'completed',
          progress: 100,
          images_generated: updatedStory.scenes?.filter((s: any) => s.generatedImageUrl).length || 0,
          videos_generated: updatedStory.scenes?.filter((s: any) => s.generatedVideoUrl).length || 0,
          audio_generated: updatedStory.scenes?.filter((s: any) => s.audioUrl).length || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', options.jobId);

      const storyUrl = `https://artflicks.app/short-stories/${options.storyId}`;

      console.log(`[StorySync] Complete sync finished for job ${options.jobId}`);
      return { success: true, storyUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[StorySync] Complete sync failed:', message);
      return { success: false, error: message };
    }
  }

  async updateJobProgress(
    jobId: string,
    progress: number,
    status: string,
    imagesGenerated?: number,
    videosGenerated?: number,
    audioGenerated?: number
  ): Promise<void> {
    if (this.useMock) {
      console.log(`[StorySync] Mock - job ${jobId} progress: ${progress}%`);
      return;
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);

      const updateData: any = {
        progress,
        status,
        updated_at: new Date().toISOString(),
      };

      if (imagesGenerated !== undefined) updateData.images_generated = imagesGenerated;
      if (videosGenerated !== undefined) updateData.videos_generated = videosGenerated;
      if (audioGenerated !== undefined) updateData.audio_generated = audioGenerated;

      await supabase
        .from('story_jobs')
        .update(updateData)
        .eq('job_id', jobId);
    } catch (error) {
      console.error('[StorySync] Failed to update job progress:', error);
    }
  }
}

export function createStorySyncService(env: any): StorySyncService {
  return new StorySyncService(env);
}
