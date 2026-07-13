// Pipeline config — defines media generation steps per workflow
// Queue consumer reads this config to determine what to generate and post-actions
// This is the single source of truth for "what steps does this workflow need"
// Phase 1: Hardcoded in code → Phase 2: Stored in database → Phase 3: Created via UI

import { computeSceneDuration } from '@artflicks/video-compiler';
import { resolveBehaviors } from '../utils/behavior-resolver';

// ── Types ──────────────────────────────────────────────────────

export interface PipelineStep {
  type: 'audio' | 'image' | 'video' | 'avatar-video' | 'video-model';
  enabled: boolean;
  postActions?: Array<{
    type: string;           // 'avatar-video', 'video-model', 'webhook', etc.
    agent?: string;         // 'AvatarAgent', 'VideoModelAgent', etc.
    condition?: string;     // 'always', 'never', 'physical', 'screenshot', 'screen-recording'
  }>;
}

export interface WorkflowPipelineConfig {
  videoType: string;
  mediaType: 'image' | 'video';      // Determines what gets queued
  skipsImageStep?: boolean;           // If true, video generated directly (no intermediate image)
  steps: PipelineStep[];
}

// ── Registry ───────────────────────────────────────────────────

const registry = new Map<string, WorkflowPipelineConfig>();

export function registerPipelineConfig(config: WorkflowPipelineConfig) {
  registry.set(config.videoType, config);
}

export function getPipelineConfig(videoType: string): WorkflowPipelineConfig | undefined {
  return registry.get(videoType);
}

// ── Condition Evaluator ────────────────────────────────────────

/**
 * Evaluate a condition string against a scene.
 * Simple string matching — no JS expression evaluation (security risk).
 *
 * @param condition - 'always', 'never', 'physical', 'screenshot', 'screen-recording', 'intro', 'outro', 'demo', 'has-avatar', 'physical-or-intro-outro'
 * @param scene - The scene object with composer.classification.productType and composer.sceneType
 * @returns true if condition is met
 */
export function evaluateCondition(condition: string | undefined, scene: any): boolean {
  if (!condition || condition === 'always') return true;
  if (condition === 'never') return false;

  const productType = scene?.composer?.classification?.productType;
  const sceneType = scene?.composer?.sceneType;

  switch (condition) {
    case 'physical':
      return productType === 'physical';
    case 'screenshot':
      return productType === 'screenshot';
    case 'screen-recording':
      return productType === 'screen-recording';
    case 'mixed':
      return productType === 'mixed';
    case 'has-avatar':
      return scene?.composer?.avatarBehavior !== 'no-avatar';
    // Scene type conditions for ai-ugc-ads
    case 'intro':
      return sceneType === 'intro';
    case 'outro':
      return sceneType === 'outro';
    case 'demo':
      return sceneType === 'demo';
    case 'intro-or-outro':
      // Only for SaaS demo (NOT physical products — physical uses video-model for all scenes)
      return (sceneType === 'intro' || sceneType === 'outro') && productType !== 'physical';
    // Combined conditions for ai-ugc-ads
    case 'physical-or-intro-outro':
      // Physical products: all scenes get avatar video
      // SaaS Demo: only intro/outro scenes get avatar video
      return productType === 'physical' || sceneType === 'intro' || sceneType === 'outro';
    case 'physical-intro-outro':
      // Physical products: only intro/outro scenes get avatar lip-sync
      return productType === 'physical' && (sceneType === 'intro' || sceneType === 'outro');
    case 'physical-demo':
      // Physical products: demo scenes get product animation (no avatar)
      return productType === 'physical' && sceneType !== 'intro' && sceneType !== 'outro';
    default:
      return false;
  }
}

// ── Post-Action Executor ───────────────────────────────────────

export interface PostActionContext {
  jobId: string;
  userId: string;
  storyId: string;
  sceneIndex: number;
  totalScenes: number;
  videoConfig: any;
  baseUrl: string;
  env: any;
}

/**
 * Execute a post-action after a pipeline step completes.
 * Currently supports 'avatar-video' type (AvatarAgent).
 * Extensible — add new action types as needed.
 */
export async function executePostAction(
  action: { type: string; agent?: string; condition?: string },
  scene: any,
  stepResult: any,
  ctx: PostActionContext
): Promise<void> {
  if (action.type === 'avatar-video') {
    if (!stepResult.audioUrl) {
      console.warn(`[PipelineConfig] No audio URL for scene ${ctx.sceneIndex}, skipping avatar-video`);
      return;
    }
    const { AvatarAgent } = await import('../agents/avatar-agent');
    const agent = new AvatarAgent(ctx.env);

    // Extract display strategy and product images from composer metadata
    const displayStrategy = scene?.composer?.displayStrategy;
    const productImages = scene?.composer?.displayPipeline?.productImages || [];

    await agent.execute({
      avatarImageUrl: scene.composer?.avatarImageUrl || '',
      audioUrl: stepResult.audioUrl,
      aspectRatio: ctx.videoConfig?.aspectRatio || '9:16',
      model: scene.composer?.avatarModel || 'standard',
      userId: ctx.userId,
      jobId: ctx.jobId,
      storyId: ctx.storyId,
      sceneIndex: ctx.sceneIndex,
      baseUrl: ctx.baseUrl,
      // Product display support
      productImages,
      displayStrategy,
      // AI Director creative fields — flow to motion instructions
      shotDescription: scene.composer?.shotDescription,
      cameraStyle: scene.composer?.cameraStyle,
    });
  } else if (action.type === 'video-model') {
    // Use Wan 2.7 or Seedance for video generation (replaces Kling Avatar v2 for physical products)
    const { VideoModelAgent } = await import('../agents/video-model-agent');
    const agent = new VideoModelAgent(ctx.env);

    // Extract video model info from videoConfig
    const videoModel = ctx.videoConfig?.videoModel;
    const videoVariant = ctx.videoConfig?.videoVariant || 'default';
    const videoModelKey = ctx.videoConfig?.videoModelKey || 'wan-2.7-720p';
    const audioInput = ctx.videoConfig?.audioInput || 'driving_audio';
    const audioParam = ctx.videoConfig?.audioParam || 'audio_url';
    const audioArray = ctx.videoConfig?.audioArray;
    const generateAudio = ctx.videoConfig?.generateAudio;
    const resolution = ctx.videoConfig?.resolution || '720p';

    if (!videoModel) {
      console.error(`[PipelineConfig] video-model post-action requires videoModel in videoConfig`);
      return;
    }

    const behaviors = resolveBehaviors(scene, ctx.videoConfig);
    const drivingAudioUrl = behaviors.useDrivingAudio ? stepResult.audioUrl : undefined;

    // Scene duration — use the same calculation as AiUgcAdsAdapter to prevent
    // video files being shorter than timeline slots (which causes frozen frames)
    const isLastScene = ctx.sceneIndex === ctx.totalScenes - 1;
    const sceneDuration = computeSceneDuration(scene, isLastScene);

    await agent.execute({
      imageUrl: scene.composer?.avatarImageUrl || '',
      audioUrl: drivingAudioUrl,
      aspectRatio: ctx.videoConfig?.aspectRatio || '9:16',
      resolution,
      sceneDuration,
      videoModel,
      videoVariant,
      videoModelKey,
      audioInput,
      audioParam,
      audioArray,
      generateAudio,
      userId: ctx.userId,
      jobId: ctx.jobId,
      storyId: ctx.storyId,
      sceneIndex: ctx.sceneIndex,
      baseUrl: ctx.baseUrl,
      // AI Director creative fields
      shotDescription: scene.composer?.shotDescription,
      cameraStyle: scene.composer?.cameraStyle,
      prompt: scene.composer?.shotDescription,  // Use shot description as video prompt
    });
  }
}
