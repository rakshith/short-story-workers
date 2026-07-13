// AI Director Agent — Orchestrator
// Step 1: VisionSubAgent (Gemini) analyzes product media
// Step 2: CreativeDirectorSubAgent generates narration, prompts, scene structure
// Separates vision analysis from creative generation for best-of-breed model usage

import { BaseAgent } from './base-agent';
import { CreativePlan, CreativeFreedom } from '../types/creative-plan';
import { analyzeProductMediaBatch, VisionAnalyzerResult, ProductAnalysis } from '../services/vision-analyzer';
import { CreativeDirectorAgent, CreativeDirectorInput } from './creative-director-agent';

export interface AIDirectorAgentInput {
  avatarImageUrl: string;
  productImages: Array<{ url: string; type: 'image' | 'video' }>;
  voiceoverUrl?: string;
  aspectRatio: string;
  creativeFreedom: CreativeFreedom;
  targetDuration?: number;
  userId: string;
  title?: string;
}

export interface AIDirectorAgentOutput {
  success: boolean;
  plan?: CreativePlan;
  visionResults?: VisionAnalyzerResult[];
  error?: string;
}

// ── Freedom mode default durations ─────────────────────────

const FREEDOM_DURATIONS: Record<CreativeFreedom, number> = {
  conservative: 15,
  balanced: 30,
  bold: 45,
  experimental: 60,
};

// ── Agent ──────────────────────────────────────────────────

export class AIDirectorAgent extends BaseAgent<AIDirectorAgentInput, AIDirectorAgentOutput> {
  readonly name = 'AIDirectorAgent';

  async execute(input: AIDirectorAgentInput): Promise<AIDirectorAgentOutput> {
    this.log(`Starting AI Director for user ${input.userId}, freedom: ${input.creativeFreedom}`);

    // ── Step 1: Vision Analysis (Gemini) ────────────────
    const visionResults = await this.analyzeProductMedia(input.productImages);
    const successfulAnalyses = visionResults
      .filter(r => r.success && r.analysis)
      .map(r => r.analysis!);

    if (successfulAnalyses.length === 0) {
      return {
        success: false,
        visionResults,
        error: 'Failed to analyze any product media',
      };
    }

    this.log(`Vision analysis complete: ${successfulAnalyses.length} items analyzed`);

    // ── Step 2: Creative Plan Generation (separate model) ─
    const targetDuration = input.targetDuration || FREEDOM_DURATIONS[input.creativeFreedom];

    const creativeDirector = new CreativeDirectorAgent(this.env);
    const creativeResult = await creativeDirector.execute({
      analyses: successfulAnalyses,
      creativeFreedom: input.creativeFreedom,
      targetDuration,
      title: input.title,
      aspectRatio: input.aspectRatio,
    });

    if (!creativeResult.success || !creativeResult.plan) {
      return {
        success: false,
        visionResults,
        error: creativeResult.error || 'Failed to generate creative plan',
      };
    }

    this.log(`Creative plan generated: ${creativeResult.plan.story.scenes.length} scenes, ${creativeResult.plan.story.totalDuration}s`);

    return {
      success: true,
      plan: creativeResult.plan,
      visionResults,
    };
  }

  private async analyzeProductMedia(
    items: Array<{ url: string; type: 'image' | 'video' }>
  ): Promise<VisionAnalyzerResult[]> {
    const apiKey = this.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      this.warn('AI_GATEWAY_API_KEY not set, returning empty analyses');
      return [];
    }

    return analyzeProductMediaBatch(items, apiKey);
  }
}
