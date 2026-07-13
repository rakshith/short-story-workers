// Classification Agent — Determines product type and avatar behavior from vision analysis
// Wraps product-classifier.ts service

import { BaseAgent } from './base-agent';
import { classifyProduct, ClassificationResult } from '../services/product-classifier';
import { ProductAnalysis } from '../services/vision-analyzer';

export interface ClassificationAgentInput {
  analyses: ProductAnalysis[];
  itemTypes: Array<'image' | 'video'>;
}

export class ClassificationAgent extends BaseAgent<ClassificationAgentInput, ClassificationResult> {
  readonly name = 'ClassificationAgent';

  async execute(input: ClassificationAgentInput): Promise<ClassificationResult> {
    this.log(`Classifying ${input.analyses.length} product analyses...`);

    const result = classifyProduct(input.analyses, input.itemTypes);

    this.log(`Classification result:`, {
      productType: result.productType,
      productCategory: result.productCategory,
      avatarBehavior: result.avatarBehavior,
      visualStrategy: result.visualStrategy,
      confidence: result.confidence,
    });

    return result;
  }
}
