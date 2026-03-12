// Script Service - wraps script generation with mock support

import { ScriptTemplateIds } from '@artflicks/video-compiler';
import { generateUUID } from '../../utils/storage';

export interface ScriptGenerationInput {
  prompt: string;
  templateId?: string;
  videoConfig?: any;
}

export interface ScriptGenerationResult {
  story: any;
  sceneCount: number;
}

const MOCK_STORY_TEMPLATES = {
  'youtube-shorts': {
    title: 'Mock YouTube Short',
    scenes: [
      { sceneNumber: 1, details: 'Opening scene', imagePrompt: 'A beautiful sunrise over mountains with golden light, cinematic landscape', narration: 'Once upon a time, in a land far away, there was a brave adventurer.', cameraAngle: 'wide shot', mood: 'peaceful', duration: 5 },
      { sceneNumber: 2, details: 'Conflict arises', imagePrompt: 'A dark forest with mysterious fog, ominous trees, cinematic horror', narration: 'But one day, a great challenge appeared before them.', cameraAngle: 'medium shot', mood: 'tense', duration: 5 },
      { sceneNumber: 3, details: 'Resolution', imagePrompt: 'A castle on a hill at sunset, triumphant lighting, epic vista', narration: 'With courage in their heart, they overcame all obstacles and lived happily ever after.', cameraAngle: 'wide shot', mood: 'triumphant', duration: 5 },
    ]
  },
  'character-story': {
    title: 'Mock Character Story',
    scenes: [
      { sceneNumber: 1, details: 'Character introduction', imagePrompt: 'A brave warrior in shining armor, detailed character design, cinematic portrait', narration: 'Meet our hero, a legendary warrior known throughout the realm.', cameraAngle: 'portrait', mood: 'heroic', duration: 5 },
      { sceneNumber: 2, details: 'Adventure begins', imagePrompt: 'The warrior walking through a mystical forest, epic journey, dramatic lighting', narration: 'The warrior set off on an adventure that would change their life forever.', cameraAngle: 'wide shot', mood: 'adventurous', duration: 5 },
      { sceneNumber: 3, details: 'Victory', imagePrompt: 'Warrior standing victorious atop a mountain, epic sunset, legendary hero', narration: 'And so our hero returned home, hailed as the greatest warrior the realm had ever seen.', cameraAngle: 'wide shot', mood: 'triumphant', duration: 5 },
    ]
  },
  'skeleton-3d-shorts': {
    title: 'Mock Skeleton 3D Story',
    scenes: [
      { sceneNumber: 1, details: 'Skeleton character introduction', imagePrompt: 'A cute 3D skeleton character dancing, fun animation style, colorful background', narration: 'Meet Boney, the dancing skeleton!', cameraAngle: 'medium shot', mood: 'fun', duration: 5 },
      { sceneNumber: 2, details: 'Skeleton dancing', imagePrompt: '3D skeleton doing a funny dance, animated style, bright colors', narration: 'Boney loves to dance all day long!', cameraAngle: 'medium shot', mood: 'cheerful', duration: 5 },
      { sceneNumber: 3, details: 'Skeleton finale', imagePrompt: 'Skeleton waving goodbye with big smile, 3D animation, happy ending', narration: 'Thanks for watching! Dance with Boney again soon!', cameraAngle: 'medium shot', mood: 'happy', duration: 5 },
    ]
  }
};

export class ScriptService {
  private openAiApiKey: string;
  private useMock: boolean;

  constructor(openAiApiKey: string, useMock = false) {
    this.openAiApiKey = openAiApiKey;
    this.useMock = useMock;
  }

  async generate(input: ScriptGenerationInput): Promise<ScriptGenerationResult> {
    if (this.useMock) {
      return this.mockGenerate(input);
    }

    const templateId = input.templateId || ScriptTemplateIds.YOUTUBE_SHORTS;
    
    const { generateScript } = await import('../../services/script-generation');
    
    const result = await generateScript(
      {
        prompt: input.prompt,
        duration: input.videoConfig?.duration || 30,
        templateId,
      },
      this.openAiApiKey
    );

    return {
      story: result.story,
      sceneCount: result.story?.scenes?.length || 0,
    };
  }

  private mockGenerate(input: ScriptGenerationInput): ScriptGenerationResult {
    const templateId = input.templateId || 'youtube-shorts';
    const template = MOCK_STORY_TEMPLATES[templateId as keyof typeof MOCK_STORY_TEMPLATES] || MOCK_STORY_TEMPLATES['youtube-shorts'];
    
    const story = {
      id: generateUUID(),
      title: `${template.title}: ${input.prompt.substring(0, 30)}...`,
      scenes: template.scenes.map((scene, index) => ({
        ...scene,
        id: generateUUID(),
      })),
    };

    console.log(`[MockScriptService] Generated story with ${story.scenes.length} scenes`);

    return {
      story,
      sceneCount: story.scenes.length,
    };
  }
}

export function createScriptService(openAiApiKey: string, useMock = false): ScriptService {
  return new ScriptService(openAiApiKey, useMock);
}
