// Cost Tracking Service - wraps legacy usage tracking

export interface CostTrackingParams {
  jobId: string;
  userId: string;
  storyId: string;
  sceneIndex: number;
  type: 'image' | 'video' | 'audio';
  model: string;
  provider: string;
}

export interface CostTrackingOptions {
  cpuTimeMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export class CostTrackingService {
  private env: any;
  private useMock: boolean;

  constructor(env: any) {
    this.env = env;
    this.useMock = env.GEN_PROVIDER === 'mock';
  }

  async trackGeneration(params: CostTrackingParams, options: CostTrackingOptions = {}): Promise<void> {
    if (this.useMock) {
      console.log('[CostTracking] Mock mode - skipping cost tracking');
      return;
    }

    try {
      const { trackWorkerCpuTime, trackAIUsageInternal } = await import('../../services/usage-tracking');

      if (options.cpuTimeMs && options.cpuTimeMs > 0) {
        await trackWorkerCpuTime(
          params.jobId,
          params.userId,
          params.storyId,
          options.cpuTimeMs,
          params.sceneIndex,
          params.type,
          this.env
        );
      }

      await trackAIUsageInternal(this.env, {
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        feature: `${params.type}-generation`,
        type: params.type as 'text' | 'image' | 'video' | 'audio',
        inputTokens: options.inputTokens,
        outputTokens: options.outputTokens,
        durationSeconds: options.durationSeconds,
        width: options.width,
        height: options.height,
        count: 1,
        correlationId: params.jobId,
        source: 'generation-engine',
      });

      console.log(`[CostTracking] Tracked ${params.type} generation for job ${params.jobId}`);
    } catch (error) {
      console.error('[CostTracking] Failed to track cost:', error);
    }
  }

  async trackImageGeneration(
    jobId: string,
    userId: string,
    storyId: string,
    sceneIndex: number,
    model: string,
    options: CostTrackingOptions = {}
  ): Promise<void> {
    await this.trackGeneration(
      { jobId, userId, storyId, sceneIndex, type: 'image', model, provider: 'replicate' },
      options
    );
  }

  async trackVideoGeneration(
    jobId: string,
    userId: string,
    storyId: string,
    sceneIndex: number,
    model: string,
    options: CostTrackingOptions = {}
  ): Promise<void> {
    await this.trackGeneration(
      { jobId, userId, storyId, sceneIndex, type: 'video', model, provider: 'replicate' },
      options
    );
  }

  async trackVoiceGeneration(
    jobId: string,
    userId: string,
    storyId: string,
    sceneIndex: number,
    model: string,
    options: CostTrackingOptions = {}
  ): Promise<void> {
    await this.trackGeneration(
      { jobId, userId, storyId, sceneIndex, type: 'audio', model, provider: 'elevenlabs' },
      options
    );
  }
}

export function createCostTrackingService(env: any): CostTrackingService {
  return new CostTrackingService(env);
}
