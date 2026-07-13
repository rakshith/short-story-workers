// Scene Planning Agent — Generates detailed scene plans from product classification
// Wraps scene-planner.ts service

import { BaseAgent } from './base-agent';
import { planScenes, ScenePlanResult } from '../services/scene-planner';
import { ClassificationResult } from '../services/product-classifier';
import { ProductAnalysis } from '../services/vision-analyzer';
import { ProductItem } from '../workflows/ai-ugc-ads';

export interface ScenePlanningAgentInput {
  classification: ClassificationResult;
  analyses: ProductAnalysis[];
  items: ProductItem[];
  speechMode: 'auto' | 'provided';
}

export class ScenePlanningAgent extends BaseAgent<ScenePlanningAgentInput, ScenePlanResult> {
  readonly name = 'ScenePlanningAgent';

  async execute(input: ScenePlanningAgentInput): Promise<ScenePlanResult> {
    this.log(`Planning scenes for ${input.items.length} items, speech mode: ${input.speechMode}...`);

    const result = planScenes(
      input.classification,
      input.analyses,
      input.items,
      input.speechMode
    );

    this.log(`Scene plan generated: ${result.scenes.length} scenes, ${result.totalDuration}s total`);

    for (const scene of result.scenes) {
      this.log(`  Scene ${scene.sceneIndex + 1}: ${scene.sceneKind}, ${scene.duration}s, ${scene.visualStrategy}, ${scene.avatarBehavior}`);
    }

    return result;
  }
}
