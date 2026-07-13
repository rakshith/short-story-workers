// Vision Agent — Analyzes uploaded product media using Gemini Flash vision
// Wraps vision-analyzer.ts service

import { BaseAgent } from './base-agent';
import { analyzeProductMediaBatch, ProductAnalysis, VisionAnalyzerResult } from '../services/vision-analyzer';

export interface VisionAgentInput {
  items: Array<{ url: string; type: 'image' | 'video' }>;
}

export interface VisionAgentOutput {
  analyses: ProductAnalysis[];
  results: VisionAnalyzerResult[];
  successCount: number;
  totalCount: number;
}

export class VisionAgent extends BaseAgent<VisionAgentInput, VisionAgentOutput> {
  readonly name = 'VisionAgent';

  async execute(input: VisionAgentInput): Promise<VisionAgentOutput> {
    const apiKey = this.env.AI_GATEWAY_API_KEY;

    if (!apiKey) {
      this.warn('AI_GATEWAY_API_KEY not set, returning empty analyses');
      return { analyses: [], results: [], successCount: 0, totalCount: input.items.length };
    }

    this.log(`Analyzing ${input.items.length} product media items...`);

    const results = await analyzeProductMediaBatch(input.items, apiKey);
    const analyses = results
      .filter(r => r.success && r.analysis)
      .map(r => r.analysis!);

    this.log(`Analysis complete: ${analyses.length}/${input.items.length} successful`);

    return {
      analyses,
      results,
      successCount: analyses.length,
      totalCount: input.items.length,
    };
  }
}
