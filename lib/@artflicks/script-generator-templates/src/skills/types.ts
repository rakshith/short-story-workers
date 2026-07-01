import { ScenePlan } from '../utils/scene-math';
import { IntentMetadata } from '../types';

export interface SkillContext {
  prompt: string;
  duration: number;
  language: string;
  languageName: string;
  mediaType: 'image' | 'video';
  scenePlan: ScenePlan;
  hasCharacterImages: boolean;
  characterReferenceImages?: string[];
  flags?: Record<string, unknown>;
  intent?: IntentMetadata;
  stylePrompt?: string;
}

export interface Skill {
  id: string;
  name: string;
  version: string;
  render(context: SkillContext): string;
}

export type SkillOverrides = Record<string, Record<string, unknown>>;
