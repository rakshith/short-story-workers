// Blocks exports

import { Block } from '../types';
import { ScriptBlock } from './scriptBlock';
import { ImageBlock } from './imageBlock';
import { VoiceBlock } from './voiceBlock';
import { VideoBlock } from './videoBlock';
import { AvatarBlock } from './avatarBlock';
import { TranscriptBlock } from './transcriptBlock';
import { SummaryBlock } from './summaryBlock';

// Registry keyed by capability name (used by nodeExecutor via node.capability)
const BLOCK_REGISTRY: Record<string, new () => Block> = {
  'script-generation': ScriptBlock,
  'image-generation': ImageBlock,
  'voice-generation': VoiceBlock,
  'video-generation': VideoBlock,
  'avatar-generation': AvatarBlock,
  'transcription': TranscriptBlock,
  'summary': SummaryBlock,
};

// Backward-compatible short-ID lookup
const SHORT_ID_MAP: Record<string, string> = {
  'script-gen': 'script-generation',
  'image-gen': 'image-generation',
  'voice-gen': 'voice-generation',
  'video-gen': 'video-generation',
  'avatar-gen': 'avatar-generation',
  'transcript-gen': 'transcription',
  'summary-gen': 'summary',
};

function getBlock(blockId: string): (new () => Block) | undefined {
  return BLOCK_REGISTRY[blockId] || BLOCK_REGISTRY[SHORT_ID_MAP[blockId]];
}

export function createBlock(capability: string): Block {
  const BlockClass = BLOCK_REGISTRY[capability] || BLOCK_REGISTRY[SHORT_ID_MAP[capability]];
  if (!BlockClass) {
    throw new Error(`Unknown block for capability: ${capability}`);
  }
  return new BlockClass();
}
