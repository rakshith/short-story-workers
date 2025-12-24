// Script generation service using Vercel AI SDK
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { StoryTimeline } from '../types';
import { getLanguageName } from '../utils/language-config';
import { getScriptWriterPrompt } from '../utils/systemPrompts';
import { SCRIPT_WRITER_SCENE_SCHEMA } from '../types/zod-types';

export interface ScriptGenerationParams {
  prompt: string;
  duration: number;
  language?: string;
  model?: string;
}

export interface ScriptGenerationResult {
  success: boolean;
  story?: StoryTimeline;
  error?: string;
}

export async function generateScript(
  params: ScriptGenerationParams,
  openaiApiKey: string
): Promise<ScriptGenerationResult> {
  const { prompt, duration, language = 'en', model } = params;

  // Calculate scene guidance
  let sceneGuidance = '';
  let recommendedScenes = 0;
  let sceneDuration = '';

  if (duration <= 30) {
    recommendedScenes = 6;
    sceneDuration = '4-6 seconds';
    sceneGuidance = 'Keep the story concise and impactful. Focus on a single key message or moment. Each scene should be punchy with minimal narration (10-15 words per scene).';
  } else if (duration <= 60) {
    recommendedScenes = 10;
    sceneDuration = '5-7 seconds';
    sceneGuidance = 'Tell a complete short story with a clear beginning, middle, and end. Keep narration concise (12-17 words per scene).';
  } else if (duration <= 120) {
    recommendedScenes = 12;
    sceneDuration = '8-10 seconds';
    sceneGuidance = 'Develop a richer narrative with character development. Narration can be more substantial (20-25 words per scene).';
  } else {
    recommendedScenes = 15;
    sceneDuration = '10-12 seconds';
    sceneGuidance = 'Create a fully developed story with multiple acts. Make it cinematic and memorable. Narration can be fuller (25-30 words per scene).';
  }

  const detailsGuidance = duration <= 60
    ? '2-3 sentences describing the action and context'
    : '3-4 sentences providing rich narrative context and emotional depth';

  const languageName = getLanguageName(language);
  const systemPrompt = getScriptWriterPrompt({
    languageName,
    languageCode: language,
    duration,
    recommendedScenes,
    sceneDuration,
    sceneGuidance,
    detailsGuidance,
  });

  try {
    const openai = createOpenAI({
      apiKey: openaiApiKey,
    });

    const { output } = await generateText({
      model: openai(model || 'gpt-5.2'),
      output: Output.object({
        schema: SCRIPT_WRITER_SCENE_SCHEMA,
      }),
      system: systemPrompt,
      prompt: prompt,
      temperature: 0.7,
    });

    // Convert to StoryTimeline format
    const story: StoryTimeline = {
      id: '', // Will be set later
      title: output?.title,
      totalDuration: output?.totalDuration || duration,
      scenes: (output?.scenes || []).map((scene) => ({
        sceneNumber: scene.sceneNumber,
        duration: scene.duration,
        narration: scene.narration,
        details: scene.details || '',
        imagePrompt: scene.imagePrompt,
        cameraAngle: scene.cameraAngle || '',
        mood: scene.mood || '',
      })),
    };

    return {
      success: true,
      story,
    };
  } catch (error) {
    console.error('[Script Generation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
