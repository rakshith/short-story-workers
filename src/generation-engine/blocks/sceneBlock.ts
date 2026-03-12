// Scene Block - parses scenes from generated script

import { Block, BlockInput, BlockOutput } from '../types';

export interface SceneBlockInput extends BlockInput {
  data: {
    story: any;
  };
}

export interface SceneBlockOutput extends BlockOutput {
  data?: {
    scenes: any[];
    sceneCount: number;
  };
}

export class SceneBlock implements Block {
  readonly id = 'scene-parse';
  readonly capability = 'scene-parsing';

  async execute(input: SceneBlockInput): Promise<SceneBlockOutput> {
    const { story } = input.data;

    try {
      const scenes = story?.scenes || [];
      
      if (!Array.isArray(scenes) || scenes.length === 0) {
        return {
          success: false,
          error: 'No scenes found in story',
        };
      }

      return {
        success: true,
        data: {
          scenes,
          sceneCount: scenes.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scene parsing failed',
      };
    }
  }
}
