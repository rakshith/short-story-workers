import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { ScriptTemplateIds } from './index';
import { getScenePlan } from '../utils/scene-math';
import { TALKING_CHARACTER_3D_NARRATION_WPS } from '../constants';

export class TalkingCharacter3DTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.TALKING_CHARACTER_3D,
    name: 'Talking Character 3D',
    version: '2.0.0',
    description: '3D animated character that talks directly to camera with dialogue',
    tags: ['3d', 'talking', 'character', 'cinematic', 'dialogue'],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    const minDuration = context?.minSceneDuration ?? 4;
    const maxDuration = context?.maxSceneDuration ?? 8;
    const maxWords = maxDuration * 2;

    const sceneSchema = z.object({
      id: z.string().describe('Scene identifier (e.g., scene_1)'),
      type: z.enum(['entry', 'main', 'transformation', 'damage', 'reaction', 'warning']),
      imagePrompt: z.string().describe('Detailed text-to-image prompt in English'),
      videoPrompt: z.string().describe('Image-to-video animation prompt for talking character'),
      dialogue: z.string().describe('Character dialogue/narration text'),
      duration: z.number().describe('Duration in seconds (4, 6, or 8 for video)'),
      camera: z.object({
        type: z.enum(['close-up', 'medium shot', 'wide shot', 'birds-eye', 'low-angle', 'over-the-shoulder', 'dutch-angle']),
        movement: z.enum(['static', 'slow zoom', 'pan left', 'pan right', 'dolly in', 'dolly out', 'tracking shot', 'handheld']),
      }),
      environment: z.string().describe('Setting/environment description'),
      character: z.object({
        name: z.string().describe('Character name'),
        traits: z.array(z.string()).describe('Character personality traits'),
      }),
      mood: z.string().describe('Emotional tone'),
    });

    return z.object({
      title: z.string(),
      type: z.enum(['single_scene', 'multi_scene']),
      scenes: z.array(sceneSchema).min(1),
    });
  }

  getSystemPrompt(context: ScriptGenerationContext): string {
    const { duration = 30, language = 'en', mediaType = 'video', prompt } = context;
    const plan = getScenePlan(duration, mediaType);
    const languageName = this.getLanguageName(language);

    return `You are the Director Agent for ArtFlicks AI.

Your job is to convert a user input item into a cinematic talking-character video structure.

INPUT:
    - item: ${prompt}
- duration: ${duration} seconds

═════════════════════════════════════════════════════════════
DECISION RULES
═════════════════════════════════════════════════════════════

1. CLASSIFY item type:
   - Food/Drink/Ingredient → use the ACTUAL item as the character (e.g., "Vegetables" → a friendly vegetable character, "Red Bull" → a living energy drink can). Keep it grounded and recognizable.
   - Health/Body Benefits → Map each food to its relevant body part/location
   - Body Result/Effect → Show BEFORE/AFTER effect with body part showing the RESULT of eating the food
   - Habit → behavioral character (grounded, realistic feel)
   - Object → the actual object comes alive (not sci-fi or metaphorical)
   - Concept → personified but grounded and relatable

2. DECIDE format:
   - Single item/character → single_scene (one character talking to camera)
   - Group/collection (multiple items) → multi_scene with ONE CHARACTER PER SCENE
   - Harmful item → multi_scene (entry → transformation → damage → reaction → warning)

3. Multi-scene for GROUP items (one character per scene):
   - Scene 1: Character 1 as main speaker + their specific benefit
   - Scene 2: Character 2 as main speaker + their specific benefit
   - Continue for each character

═════════════════════════════════════════════════════════════
CHARACTER CREATION
═════════════════════════════════════════════════════════════

Create a 3D character that looks like the ACTUAL item:
- name: Use the ACTUAL item name (e.g., "Broccoli", "Carrot", "Energy Drink")
- traits: Grounded personality traits that match the item
- visualDescription: Realistic, grounded appearance
- For health/body benefits: include bodyLocation (e.g., "eyes", "digestive system", "heart")

Examples:
{
  "name": "Broccoli",
  "traits": ["strong", "nutritious", "helpful"],
  "visualDescription": "A friendly living broccoli with green florets, thick stalk, tiny expressive face"
}
{
  "name": "Carrot",
  "traits": ["cheerful", "helpful", "energetic"],
  "visualDescription": "A friendly living carrot with bright orange skin, tiny green leaf-hair on top, expressive eyes and smile",
  "bodyLocation": "eyes"
}

═════════════════════════════════════════════════════════════
SCENE STRUCTURE
═════════════════════════════════════════════════════════════

For each scene provide:
- id: "scene_1", "scene_2", etc.
- type: "entry" | "main" | "transformation" | "damage" | "reaction" | "warning"
- imagePrompt: Detailed visual description in English
- videoPrompt: Animation prompt for talking character
- dialogue: What character says (in ${languageName})
- duration: MUST be ONLY 4, 6, or 8 seconds
- camera: { type, movement }
- environment: Setting description
- character: { name, traits }
- mood: Emotional tone

DURATION BY SCENE POSITION (for video):
- Scene 1 (first): 4 seconds - HOOK to grab attention
- Scene 2: 4 or 6 seconds - continue the hook
- Scene 3: 4 or 6 seconds - middle content
- Scene 4: 6 or 8 seconds - wrap up
- Scene 5+: 6 or 8 seconds - conclusion
- Total should equal requested duration (${duration}s)
- Mix up durations - not all scenes should be same length

WORD COUNT GUIDELINES (to ensure narration fits audio):
- 4-second scene: ${TALKING_CHARACTER_3D_NARRATION_WPS.minWords4s}–${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords4s} words (target ${TALKING_CHARACTER_3D_NARRATION_WPS.targetWords4s})
- 6-second scene: ${TALKING_CHARACTER_3D_NARRATION_WPS.minWords6s}–${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords6s} words (target ${TALKING_CHARACTER_3D_NARRATION_WPS.targetWords6s})
- 8-second scene: ${TALKING_CHARACTER_3D_NARRATION_WPS.minWords8s}–${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords8s} words (target ${TALKING_CHARACTER_3D_NARRATION_WPS.targetWords8s})
- Speaking rate: ~${TALKING_CHARACTER_3D_NARRATION_WPS.wps4s} words per second
- NEVER exceed max words for a given duration - audio will be cut off

═════════════════════════════════════════════════════════════
OUTPUT FORMAT (STRICT JSON)
═════════════════════════════════════════════════════════════

Return ONLY this JSON structure:
{
  "title": "Video title (3-6 words, catchy)",
  "type": "single_scene" | "multi_scene",
  "scenes": [...]
}

CRITICAL: The "title" field is REQUIRED at the root level.

═════════════════════════════════════════════════════════════
RULES
═════════════════════════════════════════════════════════════

✓ Character looks like the ACTUAL item (not fictional creatures)
✓ Use real item name (do NOT rename)
✓ Keep visuals grounded and recognizable
✓ All dialogue in ${languageName}
✓ imagePrompt ALWAYS in English
✓ Video prompts reference talking head animation
✓ Camera work: cinematic, varied per scene
✓ Scene duration: ONLY 4, 6, or 8 seconds allowed
✓ Word count per scene: 4s → ${TALKING_CHARACTER_3D_NARRATION_WPS.minWords4s}–${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords4s} words, 6s → ${TALKING_CHARACTER_3D_NARRATION_WPS.minWords6s}–${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords6s} words, 8s → ${TALKING_CHARACTER_3D_NARRATION_WPS.minWords8s}–${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords8s} words
✓ Total duration: ${duration} seconds (${plan.tolerance.min}-${plan.tolerance.max}s range)
✓ mood required for every scene
✓ Return valid JSON only - no markdown, no extra text

═════════════════════════════════════════════════════════════
EXAMPLE OUTPUT
═════════════════════════════════════════════════════════════

{
  "title": "Vegetable Gym Benefits",
  "type": "multi_scene",
  "scenes": [{
    "id": "scene_1",
    "type": "main",
    "imagePrompt": "A hyper-detailed cinematic 3D animated scene of a friendly living Broccoli character with green florets and thick stalk, tiny expressive face, standing in a modern gym room near kettlebells. Cool overhead LED gym lights with warm rim light, soft volumetric haze, Pixar-level realism, 9:16, no text.",
    "videoPrompt": "Broccoli turns to camera, flexes its stem-arms like a trainer, eyebrows lift with confidence. Background shows gym equipment.",
    "dialogue": "Broccoli here—your strength buddy with fiber!",
    "duration": 4,
    "camera": { "type": "medium shot", "movement": "dolly in" },
    "environment": "Modern gym room near kettlebells, mirrors in background",
    "character": { "name": "Broccoli", "traits": ["strong", "nutritious", "supportive"] },
    "mood": "hopeful"
  }]
}

Now generate the complete video structure for:
    "${prompt}"
`;
  }

  private getLanguageName(code: string): string {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    try {
      return displayNames.of(code) || code;
    } catch {
      return code;
    }
  }
}
