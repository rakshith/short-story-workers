// Script generation service using Vercel AI SDK
import { generateText, LanguageModelUsage, Output } from 'ai';
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
  usage?: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export async function generateScript(
  params: ScriptGenerationParams,
  openaiApiKey: string
): Promise<ScriptGenerationResult> {
  const { prompt, duration, language = 'en', model } = params;

  // Calculate scene breakdown - each scene MUST be exactly 5s or 10s only
  // This ensures compatibility with video inference models

  // let num5sScenes = 0;
  // let num10sScenes = 0;

  // if (duration <= 15) {
  //   // Force 3 x 5s = 15s
  //   num5sScenes = 3;
  //   num10sScenes = 0;

  // } else if (duration <= 30) {
  //   // Force 6 x 5s = 30s
  //   num5sScenes = 6;
  //   num10sScenes = 0;

  // } else if (duration <= 60) {
  //   // Up to 60s → only 5s scenes
  //   num5sScenes = Math.floor(duration / 5);
  //   num10sScenes = 0;

  // } else if (duration <= 120) {
  //   // 120s → 12 x 5s + 6 x 10s = 120s
  //   num5sScenes = 12;
  //   num10sScenes = 6;

  // } else {
  //   // 180s → 18 x 5s + 9 x 10s = 180s
  //   num5sScenes = 18;
  //   num10sScenes = 9;
  // }


  // const recommendedScenes = num5sScenes + num10sScenes;

  // // Build scene duration guidance
  // let sceneDuration = '';
  // let sceneGuidance = '';

  // if (num5sScenes > 0 && num10sScenes > 0) {
  //   sceneDuration = `exactly 5 seconds OR exactly 10 seconds (use ${num5sScenes}x 5s scenes and ${num10sScenes}x 10s scenes)`;
  // } else if (num5sScenes > 0) {
  //   sceneDuration = 'exactly 5 seconds';
  // } else {
  //   sceneDuration = 'exactly 10 seconds';
  // }

  // if (duration <= 30) {
  //   sceneGuidance = `STRICT REQUIREMENT: You MUST create EXACTLY ${recommendedScenes} scenes, each exactly 5 seconds. Total = ${recommendedScenes} × 5s = ${duration}s. DO NOT create more or fewer scenes. DO NOT exceed ${duration} seconds total.`;
  // } else if (duration <= 60) {
  //   sceneGuidance = `STRICT REQUIREMENT: You MUST create EXACTLY ${recommendedScenes} scenes totaling EXACTLY ${duration} seconds. Use a mix of 5s and 10s scenes. DO NOT create more or fewer scenes. DO NOT exceed ${duration} seconds total.`;
  // } else if (duration <= 120) {
  //   sceneGuidance = `STRICT REQUIREMENT: You MUST create EXACTLY ${recommendedScenes} scenes (${num5sScenes}x 5s + ${num10sScenes}x 10s) totaling EXACTLY ${duration} seconds. DO NOT exceed ${duration} seconds total.`;
  // } else {
  //   sceneGuidance = `STRICT REQUIREMENT: You MUST create EXACTLY ${recommendedScenes} scenes (${num5sScenes}x 5s + ${num10sScenes}x 10s) totaling EXACTLY ${duration} seconds. DO NOT exceed ${duration} seconds total.`;
  // }

  // const detailsGuidance = duration <= 60
  //   ? '2-3 sentences describing the action and context'
  //   : '3-4 sentences providing rich narrative context and emotional depth';

  const languageName = getLanguageName(language);
  const systemPrompt = getScriptWriterPrompt({
    languageName,
    languageCode: language,
    duration
  });

  try {
    const openai = createOpenAI({
      apiKey: openaiApiKey,
    });

    const { output, usage } = await generateText({
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
      usage: usage ? {
        promptTokens: (usage as LanguageModelUsage).inputTokens || 0,
        outputTokens: (usage as LanguageModelUsage).outputTokens || 0,
        totalTokens: (usage as LanguageModelUsage).totalTokens || 0,
      } : undefined,
    };
  } catch (error) {
    console.error('[Script Generation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
