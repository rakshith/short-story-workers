// Script Block - generates story script from prompt

import { Block, BlockInput, BlockOutput } from '../types';

export interface ScriptBlockInput extends BlockInput {
  data: {
    prompt: string;
    templateId?: string;
    duration?: number;
  };
}

export interface ScriptBlockOutput extends BlockOutput {
  data?: {
    story: any;
    sceneCount: number;
  };
}

export class ScriptBlock implements Block {
  readonly id = 'script-gen';
  readonly capability = 'script-generation';

  async execute(input: ScriptBlockInput): Promise<ScriptBlockOutput> {
    const { prompt, templateId, duration } = input.data;
    const { videoConfig, env } = input.context as any;

    try {
      const { createScriptService } = await import('../services/scriptService');
      const scriptService = createScriptService(env.OPENAI_API_KEY);

      const result = await scriptService.generate({
        prompt,
        templateId: templateId || videoConfig.templateId,
        videoConfig: {
          ...videoConfig,
          duration: duration || 30,
        },
      });

      return {
        success: true,
        data: {
          story: result.story,
          sceneCount: result.sceneCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Script generation failed',
      };
    }
  }
}
