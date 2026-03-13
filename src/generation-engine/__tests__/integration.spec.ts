/**
 * Integration Tests for Generation Engine
 * Tests full flow with mock mode - no external API calls
 * 
 * Run: npm run test:run -- src/generation-engine/__tests__/integration.spec.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv } from '../index';
import { createCreateJobAPI } from '../api/createJob';
import { createJobStatusAPI } from '../api/jobStatus';
import { getMockDatabase, resetMockDatabase } from '../storage/mockDatabase';
import { getMockStoryQueue, clearAllMockQueues } from '../queue/mockQueue';

describe('Generation Engine Integration Tests', () => {
  beforeEach(() => {
    resetMockDatabase();
    clearAllMockQueues();
  });

  describe('Template Resolution', () => {
    it('should create job successfully', async () => {
      const env = createMockEnv();
      const createApi = createCreateJobAPI(env);
      
      const result = await createApi.execute({
        userId: 'test-user-1',
        templateId: 'youtube-shorts',
        prompt: 'Test prompt'
      });
      
      expect(result.success).toBe(true);
      expect(result.jobId.length).toBeGreaterThan(0);
      expect(result.storyId.length).toBeGreaterThan(0);
      expect(result.isMock).toBe(true);
    });
  });

  describe('Job Status', () => {
    it('should retrieve job status correctly', async () => {
      const env = createMockEnv();
      const createApi = createCreateJobAPI(env);
      const statusApi = createJobStatusAPI(env);
      
      const createResult = await createApi.execute({
        userId: 'test-user-2',
        templateId: 'youtube-shorts',
        prompt: 'Another test'
      });
      
      const status = await statusApi.execute(createResult.jobId);
      
      expect(status.success).toBe(true);
      expect(status.jobId).toBe(createResult.jobId);
      expect(status.storyId).toBe(createResult.storyId);
      expect(status.status).toBe('pending');
      expect(status.progress).toBe(0);
    });
  });

  describe('Mock Story Generation', () => {
    it('should generate story with correct scenes', async () => {
      const env = createMockEnv();
      const createApi = createCreateJobAPI(env);
      const statusApi = createJobStatusAPI(env);
      
      const result = await createApi.execute({
        userId: 'test-user-3',
        templateId: 'youtube-shorts',
        prompt: 'A brave knight'
      });
      
      const status = await statusApi.execute(result.jobId);
      
      expect(status.totalScenes).toBe(3);
      expect(status.imagesGenerated).toBe(0);
      expect(status.videosGenerated).toBe(0);
      expect(status.audioGenerated).toBe(0);
    });
  });

  describe('Mock Database', () => {
    it('should store and retrieve story correctly', async () => {
      resetMockDatabase();
      const db = getMockDatabase();
      
      await db.insertStory({
        id: 'story-123',
        user_id: 'user-123',
        story: { title: 'Test', scenes: [] },
        video_config: {},
        status: 'pending'
      });
      
      await db.insertJob({
        job_id: 'job-123',
        story_id: 'story-123',
        user_id: 'user-123',
        status: 'processing',
        progress: 50,
        team_id: null
      });
      
      const story = await db.getStory('story-123');
      expect(story.data?.id).toBe('story-123');
      expect(story.data?.user_id).toBe('user-123');
      
      const job = await db.getJob('job-123');
      expect(job.data?.job_id).toBe('job-123');
      expect(job.data?.progress).toBe(50);
      
      await db.updateJob('job-123', { status: 'completed', progress: 100 });
      const updated = await db.getJob('job-123');
      expect(updated.data?.status).toBe('completed');
      expect(updated.data?.progress).toBe(100);
    });
  });

  describe('Mock Queue', () => {
    it('should send and retrieve queue messages', async () => {
      clearAllMockQueues();
      const queue = getMockStoryQueue();
      
      await queue.send({
        jobId: 'job-1',
        storyId: 'story-1',
        type: 'image',
        sceneIndex: 0
      });
      
      await queue.send({
        jobId: 'job-1',
        storyId: 'story-1',
        type: 'image',
        sceneIndex: 1
      });
      
      expect(queue.count).toBe(2);
      
      const messages = queue.getMessages();
      expect(messages[0].type).toBe('image');
      expect(messages[1].sceneIndex).toBe(1);
    });
  });

  describe('Character Story Template', () => {
    it('should create character story with 3 scenes', async () => {
      const env = createMockEnv();
      const createApi = createCreateJobAPI(env);
      const statusApi = createJobStatusAPI(env);
      
      const result = await createApi.execute({
        userId: 'test-user-4',
        templateId: 'character-story',
        prompt: 'A warrior hero'
      });
      
      const status = await statusApi.execute(result.jobId);
      
      expect(result.success).toBe(true);
      expect(status.totalScenes).toBe(3);
    });
  });

  describe('Skeleton 3D Template', () => {
    it('should create skeleton 3D story with 3 scenes', async () => {
      const env = createMockEnv();
      const createApi = createCreateJobAPI(env);
      const statusApi = createJobStatusAPI(env);
      
      const result = await createApi.execute({
        userId: 'test-user-5',
        templateId: 'skeleton-3d-shorts',
        prompt: 'A dancing skeleton'
      });
      
      const status = await statusApi.execute(result.jobId);
      
      expect(result.success).toBe(true);
      expect(status.totalScenes).toBe(3);
    });
  });

  describe('Full Pipeline Flow', () => {
    it('should execute complete pipeline flow', async () => {
      resetMockDatabase();
      clearAllMockQueues();
      
      const env = createMockEnv();
      const createApi = createCreateJobAPI(env);
      const statusApi = createJobStatusAPI(env);
      
      const createResult = await createApi.execute({
        userId: 'pipeline-user',
        templateId: 'youtube-shorts',
        prompt: 'A complete story'
      });
      expect(createResult.success).toBe(true);
      
      const initialStatus = await statusApi.execute(createResult.jobId);
      expect(initialStatus.totalScenes).toBe(3);
      expect(initialStatus.status).toBe('pending');
      
      const queue = getMockStoryQueue();
      expect(queue.count).toBeGreaterThan(0);
      
      const db = getMockDatabase();
      const story = await db.getStory(createResult.storyId);
      expect(story.data?.id).toBe(createResult.storyId);
    });
  });
});
