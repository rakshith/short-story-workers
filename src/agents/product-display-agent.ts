// Product Display Agent — Detects best display strategy for product + avatar
// Decides between composite image (A) or agent-generated overlay (B)
// Uses heuristics + optional LLM refinement for intelligent decisions

import { BaseAgent } from './base-agent';
import { Env } from '../types/env';

// ── Types ──────────────────────────────────────────────────────

export type DisplayStrategy = 'composite' | 'pip-overlay' | 'full-screen-overlay';

export interface ProductDisplayInput {
  showcaseItems: Array<{
    url: string;
    type: 'image' | 'video';
    label?: string;
  }>;
  avatarImageUrl: string;
  script: string;
  aspectRatio: string;
  compositeImage?: string; // Optional: user provides avatar + product in one image
}

export interface ProductDisplayDecision {
  strategy: DisplayStrategy;
  confidence: number;
  reasoning: string;
  pipeline: {
    enableAvatarVideo: boolean;
    overlayType: 'composite' | 'pip' | 'full-screen' | 'none';
    pipPosition?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
    pipSize?: number;
    productImages: string[];
  };
}

// ── Agent ──────────────────────────────────────────────────────

export class ProductDisplayAgent extends BaseAgent<ProductDisplayInput, ProductDisplayDecision> {
  readonly name = 'ProductDisplayAgent';

  async execute(input: ProductDisplayInput): Promise<ProductDisplayDecision> {
    this.log(`Analyzing ${input.showcaseItems.length} showcase items for display strategy`);

    // Strategy 1: Composite image provided
    if (input.compositeImage) {
      this.log('Composite image detected — using composite strategy');
      return {
        strategy: 'composite',
        confidence: 0.95,
        reasoning: 'User provided composite image (avatar + product in one image)',
        pipeline: {
          enableAvatarVideo: true,
          overlayType: 'composite',
          productImages: [input.compositeImage],
        },
      };
    }

    // Strategy 2: Analyze product type from showcase items
    const decision = this.analyzeProductType(input);
    this.log(`Decision: ${decision.strategy} (confidence: ${decision.confidence})`, decision.reasoning);

    return decision;
  }

  private analyzeProductType(input: ProductDisplayInput): ProductDisplayDecision {
    const { showcaseItems, script } = input;
    const productImages = showcaseItems
      .filter(item => item.type === 'image')
      .map(item => item.url);

    // Detect SaaS/digital product from labels
    const saasKeywords = ['dashboard', 'screen', 'app', 'interface', 'software', 'tool', 'platform', 'ui', 'ux'];
    const hasSaaSLabel = showcaseItems.some(item =>
      item.label && saasKeywords.some(kw => item.label!.toLowerCase().includes(kw))
    );

    // Detect screenshots (no label, but image type)
    const allImages = showcaseItems.every(item => item.type === 'image');
    const hasMultipleItems = showcaseItems.length > 1;

    // SaaS product: screenshots with avatar narration
    if (hasSaaSLabel || (allImages && hasMultipleItems && this.looksLikeScreenshots(showcaseItems))) {
      return {
        strategy: 'pip-overlay',
        confidence: 0.85,
        reasoning: 'SaaS/digital product detected — avatar narrates over screenshots with PiP overlay',
        pipeline: {
          enableAvatarVideo: true,
          overlayType: 'pip',
          pipPosition: 'bottom-right',
          pipSize: 0.25,
          productImages,
        },
      };
    }

    // Physical product: single or few product images
    if (allImages && productImages.length > 0) {
      return {
        strategy: 'full-screen-overlay',
        confidence: 0.75,
        reasoning: 'Physical product detected — avatar narrates with product images as scenes',
        pipeline: {
          enableAvatarVideo: true,
          overlayType: 'full-screen',
          productImages,
        },
      };
    }

    // Fallback: avatar only
    return {
      strategy: 'pip-overlay',
      confidence: 0.5,
      reasoning: 'Unable to determine product type — defaulting to PiP overlay',
      pipeline: {
        enableAvatarVideo: true,
        overlayType: 'pip',
        pipPosition: 'bottom-right',
        pipSize: 0.25,
        productImages,
      },
    };
  }

  private looksLikeScreenshots(items: Array<{ url: string; type: string; label?: string }>): boolean {
    // Heuristic: multiple images without labels likely = screenshots
    // Screenshots tend to be rectangular (16:9, 4:3) vs product photos (various)
    // For now, use simple heuristic: >2 images = likely screenshots
    return items.length > 2;
  }
}
