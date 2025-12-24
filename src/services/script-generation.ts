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

  // Calculate scene guidance dynamically based on duration
  let sceneGuidance = '';
  let recommendedScenes = 0;
  let sceneDuration = '';
  let targetAvgSceneDuration = 0;

  if (duration <= 30) {
    // Short videos: 5 seconds per scene on average
    targetAvgSceneDuration = 5;
    recommendedScenes = Math.round(duration / targetAvgSceneDuration);
    sceneDuration = '4-6 seconds';
    sceneGuidance = 'Keep the story concise and impactful. Focus on a single key message or moment. Each scene should be punchy with minimal narration.';
  } else if (duration <= 60) {
    // Medium videos: 6 seconds per scene on average
    targetAvgSceneDuration = 6;
    recommendedScenes = Math.round(duration / targetAvgSceneDuration);
    sceneDuration = '5-7 seconds';
    sceneGuidance = 'Tell a complete short story with a clear beginning, middle, and end. Keep narration concise.';
  } else if (duration <= 120) {
    // Longer videos: 9 seconds per scene on average
    targetAvgSceneDuration = 9;
    recommendedScenes = Math.round(duration / targetAvgSceneDuration);
    sceneDuration = '8-10 seconds';
    sceneGuidance = 'Develop a richer narrative with character development. Narration can be more substantial.';
  } else {
    // Long-form videos (3+ minutes): 12 seconds per scene on average
    targetAvgSceneDuration = 12;
    recommendedScenes = Math.round(duration / targetAvgSceneDuration);
    sceneDuration = '10-14 seconds';
    sceneGuidance = `Create a fully developed story with multiple acts. Make it cinematic and memorable. IMPORTANT: You have exactly ${duration} seconds - average ${targetAvgSceneDuration} seconds per scene across ${recommendedScenes} scenes to fill the entire duration.`;
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
