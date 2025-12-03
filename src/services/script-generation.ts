// Script generation service using OpenAI SDK
import OpenAI from 'openai';
import { StoryTimeline, Scene } from '../types';

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

// Scene schema for validation
interface GeneratedScene {
  sceneNumber: number;
  duration: number;
  narration: string;
  details: string;
  imagePrompt: string;
  cameraAngle: string;
  mood: string;
}

interface GeneratedScript {
  title: string;
  totalDuration: number;
  scenes: GeneratedScene[];
}

export async function generateScript(
  params: ScriptGenerationParams,
  openaiApiKey: string
): Promise<ScriptGenerationResult> {
  const { prompt, duration, language = 'en' } = params;

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

  const systemPrompt = `You are an expert script writer specialized in creating scene-by-scene scripts for AI video generation.

DURATION CONTEXT:
- Total video duration: ${duration} seconds
- Target number of scenes: ${recommendedScenes} scenes
- Scene duration range: ${sceneDuration}
- Narrative guidance: ${sceneGuidance}

Your task is to create a JSON response with this exact structure:
{
  "title": "Story title",
  "totalDuration": ${duration},
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 6,
      "narration": "Scene narration text",
      "details": "Visual description",
      "imagePrompt": "Detailed image generation prompt in English",
      "cameraAngle": "wide shot",
      "mood": "mysterious"
    }
  ]
}

IMPORTANT GUIDELINES:
✓ Create approximately ${recommendedScenes} scenes
✓ Total of all scene durations MUST equal ${duration} seconds
✓ Vary scene durations naturally (3-15 seconds)
✓ Each imagePrompt must be detailed and in English
✓ Narration word count = (duration × 2.5 words/sec)
✓ Camera angles: wide shot, close-up, medium shot, bird's eye view, over-the-shoulder
✓ Moods: mysterious, joyful, tense, peaceful, dramatic, etc.

Respond ONLY with valid JSON, no additional text.`;

  try {
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No content generated',
      };
    }

    const generated: GeneratedScript = JSON.parse(content);

    // Convert to StoryTimeline format
    const story: StoryTimeline = {
      id: '', // Will be set later
      title: generated.title || 'Generated Story',
      totalDuration: generated.totalDuration,
      scenes: generated.scenes.map((scene) => ({
        sceneNumber: scene.sceneNumber,
        duration: scene.duration,
        narration: scene.narration,
        details: scene.details,
        imagePrompt: scene.imagePrompt,
        cameraAngle: scene.cameraAngle,
        mood: scene.mood,
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

