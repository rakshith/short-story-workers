// Supabase service for Cloudflare Workers

import { createClient } from '@supabase/supabase-js';
import { StoryTimeline, ProjectStatusType, VideoConfig } from '../types';

export interface Story {
  id: string;
  user_id: string;
  title: string;
  video_type: string;
  story: StoryTimeline;
  video_config?: VideoConfig;
  story_cost?: number;
  created_at: string;
  updated_at: string;
  status: ProjectStatusType;
  final_video_url?: string;
}

export interface CreateStoryParams {
  userId: string;
  title: string;
  seriesId: string;
  videoType: string;
  story: StoryTimeline;
  status: ProjectStatusType;
  videoConfig?: VideoConfig;
  storyCost?: number;
  teamId?: string;
}

export class StoryService {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async createStory(params: CreateStoryParams): Promise<Story> {
    const upsertData: any = {
      user_id: params.userId,
      title: params.title,
      series_id: params.seriesId,
      video_type: params.videoType,
      story: params.story,
      status: params.status,
      team_id: params.teamId,
    };

    if (params.videoConfig) {
      upsertData.video_config = params.videoConfig;
    }

    if (params.storyCost !== undefined) {
      upsertData.story_cost = params.storyCost;
    }

    const { data, error } = await this.supabase
      .from('stories')
      .upsert(upsertData, {
        onConflict: 'user_id,title',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create/update story: ${error.message}`);
    }

    return data;
  }
}

