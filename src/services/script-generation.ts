// Script generation service using OpenAI SDK
import OpenAI from 'openai';
import { StoryTimeline, Scene, LanguageOption } from '../types';

export const languageOptions: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    enabled: true
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    enabled: false
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    enabled: false
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    enabled: false
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    enabled: false
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    enabled: false
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    enabled: false
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    enabled: false
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    enabled: false
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    enabled: false
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    enabled: false
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    enabled: false
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    enabled: false
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    enabled: false
  }
];

/**
 * Get language name by code
 * @param code Language code (e.g., 'en', 'es')
 * @returns Language name or 'English' as default
 */
export function getLanguageName(code: string): string {
  const language = languageOptions.find(lang => lang.code === code);
  return language?.name || 'English';
}

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

  const languageName = getLanguageName(language);
  const systemPrompt = `You are an expert script writer and visual storyteller specialized in creating scene-by-scene scripts for AI video generation.

LANGUAGE REQUIREMENT:
- CRITICAL: All narration, dialogue, and text content MUST be written in ${languageName} (language code: ${language})
- Write naturally in ${languageName} - use proper grammar, idioms, and cultural expressions appropriate for ${languageName} speakers
- Ensure all narration text flows naturally when spoken aloud in ${languageName}
- IMPORTANT EXCEPTION: The "imagePrompt" field MUST ALWAYS be written in English, regardless of the selected language. Image generation models work best with English prompts. All other fields (narration, details, etc.) should be in ${languageName}.

DURATION CONTEXT:
- Total video duration: ${duration} seconds (${Math.floor(duration / 60)}m ${duration % 60}s)
- Target number of scenes: ${recommendedScenes} scenes
- Scene duration range: ${sceneDuration} (varies per scene)
- Narrative guidance: ${sceneGuidance}
- IMPORTANT: Vary scene durations naturally - some scenes can be quick (3-5s), others longer (10-15s). Don't divide time equally!

Your task is to:
1. Create a compelling narrative script based on the user's prompt
2. Break it down into approximately ${recommendedScenes} visual scenes
3. Total duration MUST equal ${duration} seconds (ensure all scene durations add up correctly)
4. Each scene must include:
   - Scene number in sequence
   - Duration in seconds (vary naturally between scenes - use ${sceneDuration} as a guideline, not a fixed value)
   - Clear narration/dialogue that tells the story (⚠️ CRITICAL: narration word count MUST NOT exceed duration × 2.5)
   - Detailed visual description for image generation
   - Optimized image generation prompt (describe what should be in the image: subjects, objects, setting, characters, and actions)
   - Camera angle (wide shot, close-up, medium shot, bird's eye view, over-the-shoulder, etc.)
   - Mood/atmosphere (mysterious, joyful, tense, peaceful, dramatic, etc.)

⚠️ ABSOLUTE REQUIREMENT - NARRATION LENGTH:
Before writing any narration, calculate: MAX_WORDS = scene_duration × 2.5
Your narration MUST be ≤ MAX_WORDS. Example: 5-second scene = 12 words max, 10-second scene = 25 words max.
Exceeding this limit will cause audio to be cut off mid-sentence. ALWAYS count your words and stay under the limit.

IMPORTANT GUIDELINES:
✓ Vary scene durations naturally - quick cuts for action/transitions (3-5s), longer takes for important moments (10-15s)
✓ Start with a strong visual hook in the first scene
✓ Create smooth visual transitions between scenes (consider continuity)
✓ Write narration that flows naturally when spoken aloud
✓ Each image prompt should be highly detailed, describing what should be in the image: subjects, objects, setting, characters, and their actions
✓ Focus on the concrete visual elements and scene content - style and composition will be added later
✓ Make each scene visually distinct but maintain cohesive storytelling
✓ Ensure the sum of all scene durations equals EXACTLY ${duration} seconds

⚠️ CRITICAL NARRATION LENGTH CONSTRAINT - MUST FOLLOW STRICTLY:
✓ Narration length MUST NEVER exceed the scene duration - this is a HARD CONSTRAINT
✓ Calculate MAXIMUM word count per scene: MAX_WORDS = (scene duration in seconds) × 2.5
✓ Examples of MAXIMUM word counts:
  * 3-second scene = 7 words MAXIMUM
  * 5-second scene = 12 words MAXIMUM  
  * 6-second scene = 15 words MAXIMUM
  * 8-second scene = 20 words MAXIMUM
  * 10-second scene = 25 words MAXIMUM
  * 12-second scene = 30 words MAXIMUM
  * 15-second scene = 37 words MAXIMUM
✓ Count every word in your narration and ensure it does NOT exceed the maximum for that scene's duration
✓ If a scene is shorter (3-5s), use extremely concise, punchy narration
✓ If a scene is longer (10-15s), you can use fuller narration but still respect the word limit
✓ VALIDATION: After writing narration, count the words - if it exceeds (duration × 2.5), REWRITE IT SHORTER
✓ The voiceover will be cut off mid-sentence if narration is too long - this ruins the user experience

NARRATION REQUIREMENTS - CRAFT MAGNETIC STORYTELLING:
✓ LENGTH FIRST: ALWAYS calculate max words (duration × 2.5) BEFORE writing narration - this is your strict word budget
✓ OPEN WITH IMPACT: Every scene's first sentence must hook the listener instantly - create immediate intrigue, emotion, or tension
✓ EMOTIONAL RESONANCE: Infuse narration with feelings that resonate - curiosity, fear, hope, wonder, urgency, nostalgia, revelation
✓ SENSORY IMMERSION: Paint vivid mental images using all senses - what is seen, heard, felt, smelled, tasted in each moment
✓ MOMENTUM BUILDING: Each scene should propel the story forward, leaving listeners eager for what comes next
✓ POWER LANGUAGE: Choose words that carry weight and emotion - verbs that show action, adjectives that evoke atmosphere
✓ RHYTHMIC VARIATION: Mix short, punchy declarations with flowing, lyrical descriptions to create natural speech patterns
✓ ELIMINATE WEAKNESS: Never use passive voice, generic descriptors, or obvious statements - every word must earn its place
✓ TENSION IN TRANQUILITY: Even calm scenes should have undercurrents of emotion, foreshadowing, or character depth
✓ STORY-DRIVEN: Narration must advance plot, reveal character, or deepen atmosphere - never simply describe what's visible
✓ CONVERSATIONAL YET CRAFTED: Write as if telling a captivating story to a friend, but with literary precision
✓ BREVITY WHEN NEEDED: For short scenes (3-5s), use single powerful sentences (5-12 words) that pack maximum impact

IMAGE PROMPT REQUIREMENTS - COMPREHENSIVE VISUAL STORYTELLING:
✓ MANDATORY LENGTH: Each imagePrompt MUST be 200-400 characters (approximately 30-60 words) - NEVER use brief one-sentence descriptions under 200 characters or exceed 400 characters
✓ OPTIMAL RANGE: Aim for 250-350 characters for the perfect balance of detail and efficiency
✓ LAYERED DESCRIPTION: Build the image in layers - foreground subjects, midground action, background environment, atmospheric effects
✓ CHARACTER SPECIFICITY: Define exact physical characteristics - age range, build, facial features, expressions, emotional state, body language, gestures, clothing details including colors, fabrics, condition, style period
✓ ENVIRONMENTAL RICHNESS: Describe complete setting - location type, architectural or natural features, weather conditions, time of day, season, geographical characteristics, spatial layout
✓ LIGHTING MASTERY: Specify precise lighting - direction, quality, color temperature, intensity, shadows, highlights, light sources, time-based lighting effects
✓ COLOR STORYTELLING: Detail dominant color schemes, color relationships, saturation levels, contrast ratios, how colors create mood and guide viewer's eye
✓ COMPOSITION PRECISION: Describe depth planes, focal points, visual balance, leading lines, framing elements, negative space, perspective type
✓ TEXTURE & MATERIAL DETAIL: Specify surface qualities - rough/smooth, wet/dry, aged/new, reflective/matte, organic/manufactured textures
✓ MOTION & DYNAMICS: Capture movement, action trajectories, dynamic poses, interaction between elements, energy levels, directional flow
✓ EMOTIONAL VISUALIZATION: Include visual cues that convey feelings - posture, facial micro-expressions, environmental metaphors, symbolic elements
✓ ATMOSPHERIC DEPTH: Layer in effects like fog, mist, rain, snow, dust, smoke, light rays, particles, shadows, reflections
✓ SPATIAL RELATIONSHIPS: Define scale, distance, proximity, size comparisons, depth perception, dimensional qualities
✓ CINEMATIC VISION: Write prompts as if briefing a cinematographer on capturing a pivotal story moment
✓ CHARACTER COUNT DISCIPLINE: Monitor your prompt length - be detailed but concise, every word must add visual value within the 200-400 character limit

VISUAL CONTINUITY:
- Maintain consistent character appearances across scenes (same clothing, hair, physical features unless story requires change)
- Use smooth transitions (fade, match cut, visual parallels)
- Build visual momentum toward climactic moments
- End with a memorable final image

OUTPUT FORMAT:
- Return your response as a valid JSON object with the following structure:
  {
    "title": "Story Title",
    "totalDuration": ${duration},
    "scenes": [
      {
        "sceneNumber": 1,
        "duration": 5,
        "narration": "Scene narration text (max 12 words for 5s scene)",
        "imagePrompt": "Detailed image generation prompt (200-400 characters)",
        "cameraAngle": "Camera angle description",
        "mood": "Mood/atmosphere"
      }
    ]
  }

VALIDATION CHECKLIST (verify before submitting):
✓ Sum of all scene durations = ${duration} seconds
✓ Each narration word count ≤ (scene duration × 2.5)
✓ Each imagePrompt length is 200-400 characters
✓ All required fields present for every scene

Be creative, cinematic, and focus on creating visually stunning scenes with gripping narration that work together to tell a compelling story perfectly suited for ${duration} seconds. Remember: narration length is a HARD constraint - never exceed the word limit for each scene's duration.`;

  try {
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    const completion = await openai.chat.completions.create({
      model: model || '',
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

