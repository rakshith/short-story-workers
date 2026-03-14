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

