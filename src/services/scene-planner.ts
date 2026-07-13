// Scene Planner — Generates detailed scene plans from product classification
// Each scene gets: avatar behavior, visual strategy, camera policy, duration, narration tone

import { ProductAnalysis } from './vision-analyzer';
import {
  ClassificationResult,
  AvatarBehavior,
  VisualStrategy,
  MotionType,
  classifyScene,
} from './product-classifier';
import { ProductItem } from '../workflows/ai-ugc-ads';

// ── Types ──────────────────────────────────────────────────────

export type SceneKind = 'hook' | 'feature' | 'proof' | 'cta' | 'demo' | 'reveal';
export type SceneType = 'intro' | 'demo' | 'outro' | 'feature' | 'proof';

export interface ScenePlan {
  sceneKind: SceneKind;
  sceneType: SceneType;             // NEW: intro/demo/outro/feature/proof
  sceneIndex: number;
  duration: number;                    // seconds
  showcaseItemIndex: number;           // which uploaded item this scene uses
  visualStrategy: VisualStrategy;      // how to generate the visual
  avatarBehavior: AvatarBehavior;      // what the avatar does
  motionType: MotionType;              // specific motion/animation type
  camera: {
    angle: 'front' | 'three-quarter' | 'over-shoulder' | 'close-up' | 'wide';
    movement: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static' | 'ken-burns';
    intensity: 'low' | 'medium' | 'high';
  };
  avatar: {
    visibility: 'full-screen' | 'pip-corner' | 'pip-right' | 'none';
    scale: number;                     // 0-1, how big the avatar is
    position?: { x: number; y: number }; // PiP position if applicable
  };
  narration: {
    tone: 'excited' | 'informative' | 'premium' | 'casual' | 'urgent';
    sentenceStructure: 'short-punchy' | 'conversational' | 'detailed' | 'storytelling';
    vocabulary: 'trendy' | 'professional' | 'luxury' | 'everyday' | 'technical';
  };
  transition: {
    type: 'cut' | 'fade' | 'slide' | 'zoom' | 'crossfade';
    durationFrames: number;
  };
  effects?: {
    kenBurns?: { startScale: number; endScale: number; direction: 'in' | 'out' };
    pipOverlay?: { corner: 'top-right' | 'bottom-right' | 'bottom-left'; borderRadius: number };
  };
  narrationText: string;  // Set by workflow after scene planning
}

export interface ScenePlanResult {
  scenes: ScenePlan[];
  totalDuration: number;
  strategy: ClassificationResult;
}

// ── Scene Planner ──────────────────────────────────────────────

/**
 * Generate a complete scene plan from product classification and showcase items.
 *
 * @param classification - From product-classifier
 * @param analyses - Per-item vision analysis results
 * @param items - Showcase items from request
 * @param speechMode - 'auto' or 'provided'
 * @returns ScenePlanResult with all scenes planned
 */
export function planScenes(
  classification: ClassificationResult,
  analyses: ProductAnalysis[],
  items: ProductItem[],
  speechMode: 'auto' | 'provided'
): ScenePlanResult {
  const scenes: ScenePlan[] = [];

  // Determine scene structure based on product type
  const sceneStructure = determineSceneStructure(classification, items.length);

  for (let i = 0; i < sceneStructure.length; i++) {
    const { kind, sceneType, itemIndex, duration } = sceneStructure[i];

    // Get per-scene classification (handles mixed content)
    const sceneClassification = classifyScene(itemIndex, analyses, items.map(it => it.type));
    const analysis = analyses[itemIndex];

    const scene = buildScenePlan({
      sceneKind: kind,
      sceneType,
      sceneIndex: i,
      duration,
      itemIndex,
      classification: sceneClassification,
      analysis,
      speechMode,
    });

    scenes.push(scene);
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  return { scenes, totalDuration, strategy: classification };
}

// ── Scene Structure ────────────────────────────────────────────

interface SceneStructureEntry {
  kind: SceneKind;
  sceneType: SceneType;
  itemIndex: number;
  duration: number;
}

/**
 * Determine the scene structure based on product type and number of items.
 * SaaS Demo: intro (avatar) → demo (user content) → outro (avatar)
 * Physical: hook → features → proof → CTA (avatar always shown)
 */
function determineSceneStructure(
  classification: ClassificationResult,
  itemCount: number
): SceneStructureEntry[] {
  const maxScenes = Math.min(itemCount, 8);

  switch (classification.productType) {
    case 'physical':
      return physicalProductScenes(maxScenes);

    case 'screenshot':
      return screenshotScenes(maxScenes);

    case 'screen-recording':
      return screenRecordingScenes(maxScenes);

    case 'mixed':
      return mixedScenes(maxScenes, classification);

    default:
      return physicalProductScenes(maxScenes);
  }
}

function physicalProductScenes(count: number): SceneStructureEntry[] {
  // Physical products: Avatar holds/uses product throughout
  // Scene flow: hook → feature → proof → cta (avatar always shown)
  const scenes: SceneStructureEntry[] = [];

  if (count >= 1) scenes.push({ kind: 'hook', sceneType: 'intro', itemIndex: 0, duration: 5 });
  if (count >= 2) scenes.push({ kind: 'feature', sceneType: 'feature', itemIndex: 1, duration: 6 });
  if (count >= 3) scenes.push({ kind: 'reveal', sceneType: 'feature', itemIndex: 2, duration: 4 });
  if (count >= 4) scenes.push({ kind: 'feature', sceneType: 'feature', itemIndex: 3, duration: 6 });
  if (count >= 5) scenes.push({ kind: 'proof', sceneType: 'proof', itemIndex: 4, duration: 5 });
  if (count >= 6) scenes.push({ kind: 'feature', sceneType: 'feature', itemIndex: 5, duration: 5 });
  if (count >= 7) scenes.push({ kind: 'proof', sceneType: 'proof', itemIndex: 6, duration: 4 });
  if (count >= 8) scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: 7, duration: 5 });

  // Ensure we always have at least hook + cta
  if (scenes.length < 2) {
    scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: 0, duration: 5 });
  }

  // Ensure CTA is the last scene
  if (scenes[scenes.length - 1].kind !== 'cta') {
    scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: count - 1, duration: 5 });
  }

  return scenes;
}

function screenshotScenes(count: number): SceneStructureEntry[] {
  // SaaS Demo: intro (avatar) → demo (user content) → outro (avatar)
  const scenes: SceneStructureEntry[] = [];

  // Intro: Avatar face shown, introduces tool
  if (count >= 1) scenes.push({ kind: 'hook', sceneType: 'intro', itemIndex: 0, duration: 4 });

  // Demo scenes: User's content, avatar voice only (no face)
  if (count >= 2) scenes.push({ kind: 'feature', sceneType: 'demo', itemIndex: 1, duration: 7 });
  if (count >= 3) scenes.push({ kind: 'demo', sceneType: 'demo', itemIndex: 2, duration: 7 });
  if (count >= 4) scenes.push({ kind: 'feature', sceneType: 'demo', itemIndex: 3, duration: 6 });
  if (count >= 5) scenes.push({ kind: 'proof', sceneType: 'demo', itemIndex: 4, duration: 5 });
  if (count >= 6) scenes.push({ kind: 'demo', sceneType: 'demo', itemIndex: 5, duration: 6 });
  if (count >= 7) scenes.push({ kind: 'feature', sceneType: 'demo', itemIndex: 6, duration: 5 });

  // Outro: Avatar face shown again, final message
  if (count >= 8) {
    scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: 7, duration: 4 });
  } else if (scenes.length >= 2) {
    // Replace last demo with outro if we don't have 8 items
    const lastDemo = scenes.pop();
    if (lastDemo) {
      scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: lastDemo.itemIndex, duration: 4 });
    }
  }

  // Ensure we always have at least intro + outro
  if (scenes.length < 2) {
    scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: 0, duration: 4 });
  }

  // Ensure outro is the last scene
  if (scenes[scenes.length - 1].sceneType !== 'outro') {
    scenes.push({ kind: 'cta', sceneType: 'outro', itemIndex: count - 1, duration: 4 });
  }

  return scenes;
}

function screenRecordingScenes(count: number): SceneStructureEntry[] {
  // Screen recordings: Same as screenshots (intro → demo → outro)
  return screenshotScenes(count);
}

function mixedScenes(count: number, classification: ClassificationResult): SceneStructureEntry[] {
  // Mixed content: default to physical product scenes
  return physicalProductScenes(count);
}

// ── Scene Builder ──────────────────────────────────────────────

interface BuildSceneInput {
  sceneKind: SceneKind;
  sceneType: SceneType;
  sceneIndex: number;
  duration: number;
  itemIndex: number;
  classification: {
    visualStrategy: VisualStrategy;
    avatarBehavior: AvatarBehavior;
    motionType: MotionType;
  };
  analysis?: ProductAnalysis;
  speechMode: 'auto' | 'provided';
}

function buildScenePlan(input: BuildSceneInput): ScenePlan {
  const { sceneKind, sceneType, sceneIndex, duration, itemIndex, classification, analysis, speechMode } = input;

  // Camera policy per scene kind
  const camera = buildCameraPolicy(sceneKind, classification);

  // Avatar visibility per scene type (intro/outro show avatar, demo hides it for SaaS)
  const avatar = buildAvatarPolicy(sceneKind, sceneType, classification);

  // Narration tone per scene kind
  const narration = buildNarrationPolicy(sceneKind, speechMode);

  // Transition per scene kind
  const transition = buildTransitionPolicy(sceneKind);

  // Effects — disabled for now, focus on avatar holding product
  const effects = undefined;

  return {
    sceneKind,
    sceneType,
    sceneIndex,
    duration,
    showcaseItemIndex: itemIndex,
    visualStrategy: classification.visualStrategy,
    avatarBehavior: classification.avatarBehavior,
    motionType: classification.motionType,
    camera,
    avatar,
    narration,
    transition,
    effects,
    narrationText: '',  // Populated by workflow after planning
  };
}

function buildCameraPolicy(
  sceneKind: SceneKind,
  classification: { motionType: MotionType }
): ScenePlan['camera'] {
  // Base camera settings per scene kind
  const cameraByKind: Record<SceneKind, ScenePlan['camera']> = {
    hook: { angle: 'front', movement: 'zoom-in', intensity: 'high' },
    feature: { angle: 'three-quarter', movement: 'pan-left', intensity: 'medium' },
    proof: { angle: 'close-up', movement: 'static', intensity: 'low' },
    cta: { angle: 'front', movement: 'zoom-out', intensity: 'medium' },
    demo: { angle: 'over-shoulder', movement: 'static', intensity: 'low' },
    reveal: { angle: 'close-up', movement: 'zoom-in', intensity: 'high' },
  };

  const base = cameraByKind[sceneKind] || cameraByKind.feature;

  // Adjust for motion type
  switch (classification.motionType) {
    case 'apply-product':
      return { ...base, angle: 'close-up', movement: 'static' };
    case 'screen-nav':
      return { ...base, angle: 'wide', movement: 'ken-burns', intensity: 'low' };
    case 'lifestyle-walk':
      return { ...base, angle: 'wide', movement: 'pan-right', intensity: 'medium' };
    default:
      return base;
  }
}

function buildAvatarPolicy(
  sceneKind: SceneKind,
  sceneType: SceneType,
  classification: { avatarBehavior: AvatarBehavior }
): ScenePlan['avatar'] {
  // If avatar is PiP overlay (SaaS), show full-screen for intro/outro, PiP for demo
  if (classification.avatarBehavior === 'pip-overlay') {
    // Intro and outro: avatar face shown full-screen
    if (sceneType === 'intro' || sceneType === 'outro') {
      return { visibility: 'full-screen', scale: 1.0 };
    }
    // Demo scenes: avatar in PiP corner
    return {
      visibility: 'pip-corner',
      scale: 0.3,
      position: { x: 0.7, y: 0.65 }, // bottom-right corner
    };
  }

  if (classification.avatarBehavior === 'no-avatar') {
    return { visibility: 'none', scale: 0 };
  }

  // Physical product avatar policy (avatar always shown)
  const avatarByKind: Record<SceneKind, ScenePlan['avatar']> = {
    hook: { visibility: 'full-screen', scale: 1.0 },
    feature: { visibility: 'full-screen', scale: 0.9 },
    proof: { visibility: 'full-screen', scale: 0.8 },
    cta: { visibility: 'full-screen', scale: 1.0 },
    demo: { visibility: 'full-screen', scale: 0.85 },
    reveal: { visibility: 'full-screen', scale: 0.7 }, // Product is star, avatar smaller
  };

  return avatarByKind[sceneKind] || avatarByKind.feature;
}

function buildNarrationPolicy(
  sceneKind: SceneKind,
  speechMode: 'auto' | 'provided'
): ScenePlan['narration'] {
  // Narration style per scene kind
  const narrationByKind: Record<SceneKind, ScenePlan['narration']> = {
    hook: { tone: 'excited', sentenceStructure: 'short-punchy', vocabulary: 'trendy' },
    feature: { tone: 'informative', sentenceStructure: 'conversational', vocabulary: 'everyday' },
    proof: { tone: 'premium', sentenceStructure: 'detailed', vocabulary: 'professional' },
    cta: { tone: 'urgent', sentenceStructure: 'short-punchy', vocabulary: 'trendy' },
    demo: { tone: 'informative', sentenceStructure: 'conversational', vocabulary: 'technical' },
    reveal: { tone: 'premium', sentenceStructure: 'storytelling', vocabulary: 'luxury' },
  };

  return narrationByKind[sceneKind] || narrationByKind.feature;
}

function buildTransitionPolicy(sceneKind: SceneKind): ScenePlan['transition'] {
  const transitionByKind: Record<SceneKind, ScenePlan['transition']> = {
    hook: { type: 'cut', durationFrames: 6 },        // Fast cut to hook attention
    feature: { type: 'slide', durationFrames: 12 },   // Smooth slide between features
    proof: { type: 'fade', durationFrames: 18 },      // Elegant fade for proof
    cta: { type: 'zoom', durationFrames: 12 },        // Zoom to CTA for urgency
    demo: { type: 'cut', durationFrames: 6 },         // Fast cuts during demo
    reveal: { type: 'crossfade', durationFrames: 15 }, // Crossfade for reveal
  };

  return transitionByKind[sceneKind] || transitionByKind.feature;
}
