/**
 * Integration Tests for Generation Engine
 * Tests full flow with mock mode - no external API calls
 * 
 * Run: node src/generation-engine/__tests__/integration.spec.ts
 */

import { createMockEnv } from '../index';
import { createCreateJobAPI } from '../api/createJob';
import { createJobStatusAPI } from '../api/jobStatus';
import { getMockDatabase, resetMockDatabase } from '../storage/mockDatabase';
import { getMockStoryQueue, clearAllMockQueues } from '../queue/mockQueue';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${message}`);
    testsFailed++;
  }
}

async function testTemplateResolution(): Promise<void> {
  console.log('\n📋 Test: Template Resolution');
  
  const env = createMockEnv();
  const createApi = createCreateJobAPI(env);
  
  const result = await createApi.execute({
    userId: 'test-user-1',
    templateId: 'youtube-shorts',
    prompt: 'Test prompt'
  });
  
  assert(result.success === true, 'Job created successfully');
  assert(result.jobId.length > 0, 'Job ID generated');
  assert(result.storyId.length > 0, 'Story ID generated');
  assert(result.isMock === true, 'Running in mock mode');
}

async function testJobStatus(): Promise<void> {
  console.log('\n📋 Test: Job Status');
  
  const env = createMockEnv();
  const createApi = createCreateJobAPI(env);
  const statusApi = createJobStatusAPI(env);
  
  const createResult = await createApi.execute({
    userId: 'test-user-2',
    templateId: 'youtube-shorts',
    prompt: 'Another test'
  });
  
  const status = await statusApi.execute(createResult.jobId);
  
  assert(status.success === true, 'Status retrieved successfully');
  assert(status.jobId === createResult.jobId, 'Job ID matches');
  assert(status.storyId === createResult.storyId, 'Story ID matches');
  assert(status.status === 'pending', 'Initial status is pending');
  assert(status.progress === 0, 'Initial progress is 0');
}

async function testMockStoryGeneration(): Promise<void> {
  console.log('\n📋 Test: Mock Story Generation');
  
  const env = createMockEnv();
  const createApi = createCreateJobAPI(env);
  const statusApi = createJobStatusAPI(env);
  
  const result = await createApi.execute({
    userId: 'test-user-3',
    templateId: 'youtube-shorts',
    prompt: 'A brave knight'
  });
  
  const status = await statusApi.execute(result.jobId);
  
  assert(status.totalScenes === 3, 'Generated 3 scenes');
  assert(status.imagesGenerated === 0, 'No images generated yet');
  assert(status.videosGenerated === 0, 'No videos generated yet');
  assert(status.audioGenerated === 0, 'No audio generated yet');
}

async function testMockDatabase(): Promise<void> {
  console.log('\n📋 Test: Mock Database');
  
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
  assert(story.data?.id === 'story-123', 'Story stored correctly');
  assert(story.data?.user_id === 'user-123', 'User ID stored correctly');
  
  const job = await db.getJob('job-123');
  assert(job.data?.job_id === 'job-123', 'Job stored correctly');
  assert(job.data?.progress === 50, 'Progress stored correctly');
  
  await db.updateJob('job-123', { status: 'completed', progress: 100 });
  const updated = await db.getJob('job-123');
  assert(updated.data?.status === 'completed', 'Job updated to completed');
  assert(updated.data?.progress === 100, 'Progress updated to 100');
}

async function testMockQueue(): Promise<void> {
  console.log('\n📋 Test: Mock Queue');
  
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
  
  assert(queue.count === 2, 'Queue has 2 messages');
  
  const messages = queue.getMessages();
  assert(messages[0].type === 'image', 'First message is image');
  assert(messages[1].sceneIndex === 1, 'Second message has correct scene index');
}

async function testCharacterStoryTemplate(): Promise<void> {
  console.log('\n📋 Test: Character Story Template');
  
  const env = createMockEnv();
  const createApi = createCreateJobAPI(env);
  const statusApi = createJobStatusAPI(env);
  
  const result = await createApi.execute({
    userId: 'test-user-4',
    templateId: 'character-story',
    prompt: 'A warrior hero'
  });
  
  const status = await statusApi.execute(result.jobId);
  
  assert(result.success === true, 'Character story created');
  assert(status.totalScenes === 3, 'Character story has 3 scenes');
}

async function testSkeleton3dTemplate(): Promise<void> {
  console.log('\n📋 Test: Skeleton 3D Template');
  
  const env = createMockEnv();
  const createApi = createCreateJobAPI(env);
  const statusApi = createJobStatusAPI(env);
  
  const result = await createApi.execute({
    userId: 'test-user-5',
    templateId: 'skeleton-3d-shorts',
    prompt: 'A dancing skeleton'
  });
  
  const status = await statusApi.execute(result.jobId);
  
  assert(result.success === true, 'Skeleton 3D story created');
  assert(status.totalScenes === 3, 'Skeleton 3D has 3 scenes');
}

async function testFullPipeline(): Promise<void> {
  console.log('\n📋 Test: Full Pipeline Flow');
  
  resetMockDatabase();
  clearAllMockQueues();
  
  const env = createMockEnv();
  const createApi = createCreateJobAPI(env);
  const statusApi = createJobStatusAPI(env);
  
  // Step 1: Create job
  console.log('  → Creating job...');
  const createResult = await createApi.execute({
    userId: 'pipeline-user',
    templateId: 'youtube-shorts',
    prompt: 'A complete story'
  });
  assert(createResult.success === true, 'Job created');
  
  // Step 2: Check initial status
  console.log('  → Checking initial status...');
  const initialStatus = await statusApi.execute(createResult.jobId);
  assert(initialStatus.totalScenes === 3, 'Has 3 scenes');
  assert(initialStatus.status === 'pending', 'Initial status pending');
  
  // Step 3: Check queue has messages
  console.log('  → Checking queue...');
  const queue = getMockStoryQueue();
  assert(queue.count > 0, 'Queue has messages');
  
  // Step 4: Verify story in database
  console.log('  → Verifying database...');
  const db = getMockDatabase();
  const story = await db.getStory(createResult.storyId);
  assert(story.data?.id === createResult.storyId, 'Story in database');
  
  console.log('  ✅ Full pipeline completed');
}

async function runAllTests(): Promise<void> {
  console.log('========================================');
  console.log('🚀 Generation Engine Integration Tests');
  console.log('========================================');
  console.log('\nUsing mock mode - no external API calls');
  
  // Reset state before tests
  resetMockDatabase();
  clearAllMockQueues();
  
  await testTemplateResolution();
  await testJobStatus();
  await testMockStoryGeneration();
  await testMockDatabase();
  await testMockQueue();
  await testCharacterStoryTemplate();
  await testSkeleton3dTemplate();
  await testFullPipeline();
  
  console.log('\n========================================');
  console.log(`📊 Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('========================================');
  
  if (testsFailed > 0) {
    throw new Error(`${testsFailed} tests failed`);
  }
  
  console.log('\n🎉 All tests passed!');
}

runAllTests().catch(err => {
  console.error('Test runner error:', err);
  throw err;
});
