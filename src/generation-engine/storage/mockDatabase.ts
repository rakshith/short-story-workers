// Mock Database - in-memory database for testing

import { generateUUID } from '../../utils/storage';

export interface MockStory {
  id: string;
  user_id: string;
  story: any;
  video_config: any;
  status: string;
  created_at: string;
}

export interface MockJob {
  job_id: string;
  story_id: string;
  user_id: string;
  status: string;
  progress: number;
  team_id: string | null;
  created_at: string;
}

class MockDatabase {
  private stories: Map<string, MockStory> = new Map();
  private jobs: Map<string, MockJob> = new Map();

  reset(): void {
    this.stories.clear();
    this.jobs.clear();
    console.log('[MockDatabase] Database reset');
  }

  async insertStory(story: Omit<MockStory, 'created_at'>): Promise<{ error: null }> {
    const fullStory: MockStory = {
      ...story,
      created_at: new Date().toISOString(),
    };
    this.stories.set(story.id, fullStory);
    console.log('[MockDatabase] Inserted story:', story.id);
    return { error: null };
  }

  async insertJob(job: Omit<MockJob, 'created_at'>): Promise<{ error: null }> {
    const fullJob: MockJob = {
      ...job,
      created_at: new Date().toISOString(),
    };
    this.jobs.set(job.job_id, fullJob);
    console.log('[MockDatabase] Inserted job:', job.job_id);
    return { error: null };
  }

  async getStory(storyId: string): Promise<{ data: MockStory | null; error: null }> {
    const story = this.stories.get(storyId);
    return { data: story || null, error: null };
  }

  async getJob(jobId: string): Promise<{ data: MockJob | null; error: null }> {
    const job = this.jobs.get(jobId);
    return { data: job || null, error: null };
  }

  async getJobsByStory(storyId: string): Promise<{ data: MockJob[]; error: null }> {
    const jobs = Array.from(this.jobs.values()).filter(j => j.story_id === storyId);
    return { data: jobs, error: null };
  }

  async updateStory(storyId: string, updates: Partial<MockStory>): Promise<{ error: null }> {
    const existing = this.stories.get(storyId);
    if (existing) {
      this.stories.set(storyId, { ...existing, ...updates });
      console.log('[MockDatabase] Updated story:', storyId);
    }
    return { error: null };
  }

  async updateJob(jobId: string, updates: Partial<MockJob>): Promise<{ error: null }> {
    const existing = this.jobs.get(jobId);
    if (existing) {
      this.jobs.set(jobId, { ...existing, ...updates });
      console.log('[MockDatabase] Updated job:', jobId);
    }
    return { error: null };
  }

  getAllStories(): MockStory[] {
    return Array.from(this.stories.values());
  }

  getAllJobs(): MockJob[] {
    return Array.from(this.jobs.values());
  }
}

const mockDatabase = new MockDatabase();

export function getMockDatabase(): MockDatabase {
  return mockDatabase;
}

export function resetMockDatabase(): void {
  mockDatabase.reset();
}
