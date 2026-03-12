// Blocks exports

import { ScriptBlock } from './scriptBlock';
import { SceneBlock } from './sceneBlock';
import { ImageBlock } from './imageBlock';
import { VoiceBlock } from './voiceBlock';
import { VideoBlock } from './videoBlock';

export { ScriptBlock } from './scriptBlock';
export { SceneBlock } from './sceneBlock';
export { ImageBlock } from './imageBlock';
export { VoiceBlock } from './voiceBlock';
export { VideoBlock } from './videoBlock';

export const BLOCK_REGISTRY: Record<string, any> = {
  'script-gen': ScriptBlock,
  'scene-parse': SceneBlock,
  'image-gen': ImageBlock,
  'voice-gen': VoiceBlock,
  'video-gen': VideoBlock,
};

export function getBlock(blockId: string): any {
  return BLOCK_REGISTRY[blockId];
}

export function createBlock(blockId: string): any {
  const BlockClass = BLOCK_REGISTRY[blockId];
  if (!BlockClass) {
    throw new Error(`Unknown block: ${blockId}`);
  }
  return new BlockClass();
}
