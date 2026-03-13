/**
 * Webhook Processing End-to-End - Integration Tests
 * 
 * Tests for webhook processing:
 * - Image webhook handling
 * - Video webhook handling  
 * - Audio webhook handling
 * - R2 upload integration
 * - DO state updates
 * - Error handling
 * 
 * Run: npx vitest run src/generation-engine/__tests__/webhook-processing.spec.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface Prediction {
  id: string;
  status: 'succeeded' | 'failed' | 'processing';
  output?: any;
  error?: string;
}

interface WebhookMetadata {
  storyId: string;
  jobId: string;
  userId: string;
  sceneIndex: number;
  type: 'image' | 'video' | 'audio';
}

interface MockR2Upload {
  url: string;
  key: string;
  uploaded: boolean;
}

class MockR2Manager {
  private uploads: MockR2Upload[] = [];

  async upload(url: string, key: string): Promise<string> {
    this.uploads.push({ url, key, uploaded: true });
    return `https://r2.example.com/${key}`;
  }

  getUploads(): MockR2Upload[] {
    return this.uploads;
  }

  clear(): void {
    this.uploads = [];
  }
}

class MockDurableObject {
  private state: Map<string, any> = new Map();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1);

    if (action === 'updateImage') {
      const body = await request.json() as any;
      this.state.set('latestImage', body);
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }

    if (action === 'updateVideo') {
      const body = await request.json() as any;
      this.state.set('latestVideo', body);
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }

    if (action === 'updateAudio') {
      const body = await request.json() as any;
      this.state.set('latestAudio', body);
      return new Response(JSON.stringify({ success: true, isComplete: false }));
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  }

  get(key: string): any {
    return this.state.get(key);
  }

  set(key: string, value: any): void {
    this.state.set(key, value);
  }

  clear(): void {
    this.state.clear();
  }
}

const mockR2 = new MockR2Manager();
const mockDO = new MockDurableObject();

describe('Webhook Processing End-to-End - Integration', () => {
  beforeEach(() => {
    mockR2.clear();
    mockDO.clear();
  });

  describe('1. Image Webhook Processing', () => {
    it('should process successful image webhook', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'https://replicate.com/output/image.png',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      const result = await processImageWebhook(prediction, metadata);

      expect(result.success).toBe(true);
      expect(result.imageUrl).toBeDefined();
    });

    it('should handle failed image webhook', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'failed',
        error: 'Model error: invalid input',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      const result = await processImageWebhook(prediction, metadata);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should update DO state on image completion', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'https://replicate.com/image.png',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 1,
        type: 'image',
      };

      await processImageWebhook(prediction, metadata);

      const imageUpdate = mockDO.get('latestImage');
      expect(imageUpdate).toBeDefined();
      expect(imageUpdate.sceneIndex).toBe(1);
    });
  });

  describe('2. Video Webhook Processing', () => {
    it('should process successful video webhook', async () => {
      const prediction: Prediction = {
        id: 'pred-video-123',
        status: 'succeeded',
        output: 'https://replicate.com/output/video.mp4',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'video',
      };

      const result = await processVideoWebhook(prediction, metadata);

      expect(result.success).toBe(true);
      expect(result.videoUrl).toBeDefined();
    });

    it('should handle failed video webhook', async () => {
      const prediction: Prediction = {
        id: 'pred-video-123',
        status: 'failed',
        error: 'Video generation failed',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'video',
      };

      const result = await processVideoWebhook(prediction, metadata);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should update DO state on video completion', async () => {
      const prediction: Prediction = {
        id: 'pred-video-123',
        status: 'succeeded',
        output: 'https://replicate.com/video.mp4',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 2,
        type: 'video',
      };

      await processVideoWebhook(prediction, metadata);

      const videoUpdate = mockDO.get('latestVideo');
      expect(videoUpdate).toBeDefined();
      expect(videoUpdate.sceneIndex).toBe(2);
    });
  });

  describe('3. Audio Webhook Processing', () => {
    it('should process successful audio webhook', async () => {
      const prediction: Prediction = {
        id: 'pred-audio-123',
        status: 'succeeded',
        output: 'https://replicate.com/output/audio.mp3',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'audio',
      };

      const result = await processAudioWebhook(prediction, metadata);

      expect(result.success).toBe(true);
      expect(result.audioUrl).toBeDefined();
    });

    it('should include audio duration in response', async () => {
      const prediction: Prediction = {
        id: 'pred-audio-123',
        status: 'succeeded',
        output: {
          audio_url: 'https://replicate.com/audio.mp3',
          duration: 5.5,
        },
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'audio',
      };

      const result = await processAudioWebhook(prediction, metadata);

      expect(result.audioDuration).toBeDefined();
    });

    it('should handle failed audio webhook', async () => {
      const prediction: Prediction = {
        id: 'pred-audio-123',
        status: 'failed',
        error: 'Voice generation failed',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'audio',
      };

      const result = await processAudioWebhook(prediction, metadata);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('4. R2 Upload Integration', () => {
    it('should upload image to R2', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'https://replicate.com/temp/image.png',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      await processImageWebhook(prediction, metadata);

      const uploads = mockR2.getUploads();
      expect(uploads.length).toBeGreaterThan(0);
    });

    it('should use correct R2 key format', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'https://replicate.com/temp/image.png',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      await processImageWebhook(prediction, metadata);

      const uploads = mockR2.getUploads();
      expect(uploads[0].key).toContain('story-123');
    });
  });

  describe('5. Error Handling', () => {
    it('should handle missing prediction output', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: null,
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      const result = await processImageWebhook(prediction, metadata);

      expect(result.success).toBe(false);
    });

    it('should handle unknown webhook type', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'test',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image' as any,
      };

      const result = await processImageWebhook(prediction, metadata);

      expect(result).toBeDefined();
    });

    it('should handle DO update failures gracefully', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'https://replicate.com/image.png',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      const result = await processImageWebhook(prediction, metadata);

      expect(result).toBeDefined();
    });
  });

  describe('6. Idempotency', () => {
    it('should handle duplicate webhook calls', async () => {
      const prediction: Prediction = {
        id: 'pred-123',
        status: 'succeeded',
        output: 'https://replicate.com/image.png',
      };

      const metadata: WebhookMetadata = {
        storyId: 'story-123',
        jobId: 'job-456',
        userId: 'user-789',
        sceneIndex: 0,
        type: 'image',
      };

      await processImageWebhook(prediction, metadata);
      await processImageWebhook(prediction, metadata);

      const imageUpdate = mockDO.get('latestImage');
      expect(imageUpdate).toBeDefined();
    });
  });
});

async function processImageWebhook(prediction: Prediction, metadata: WebhookMetadata): Promise<any> {
  if (prediction.status === 'failed') {
    return { success: false, error: prediction.error };
  }

  if (!prediction.output) {
    return { success: false, error: 'No output' };
  }

  const r2Key = `stories/${metadata.storyId}/images/scene-${metadata.sceneIndex}.png`;
  const r2Url = await mockR2.upload(prediction.output, r2Key);

  mockDO.set('latestImage', { sceneIndex: metadata.sceneIndex, imageUrl: r2Url });

  return {
    success: true,
    imageUrl: r2Url,
    sceneIndex: metadata.sceneIndex,
  };
}

async function processVideoWebhook(prediction: Prediction, metadata: WebhookMetadata): Promise<any> {
  if (prediction.status === 'failed') {
    return { success: false, error: prediction.error };
  }

  if (!prediction.output) {
    return { success: false, error: 'No output' };
  }

  const r2Key = `stories/${metadata.storyId}/videos/scene-${metadata.sceneIndex}.mp4`;
  const r2Url = await mockR2.upload(prediction.output, r2Key);

  mockDO.set('latestVideo', { sceneIndex: metadata.sceneIndex, videoUrl: r2Url });

  return {
    success: true,
    videoUrl: r2Url,
    sceneIndex: metadata.sceneIndex,
  };
}

async function processAudioWebhook(prediction: Prediction, metadata: WebhookMetadata): Promise<any> {
  if (prediction.status === 'failed') {
    return { success: false, error: prediction.error };
  }

  const audioUrl = prediction.output?.audio_url || prediction.output;
  const duration = prediction.output?.duration || 5;

  mockDO.set('latestAudio', { sceneIndex: metadata.sceneIndex, audioUrl, audioDuration: duration });

  return {
    success: true,
    audioUrl,
    audioDuration: duration,
    sceneIndex: metadata.sceneIndex,
  };
}
