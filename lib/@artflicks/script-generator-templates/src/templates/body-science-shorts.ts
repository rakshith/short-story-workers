import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { createBodyScienceShortsSchema, BODY_SCIENCE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';

export const BODY_SCIENCE_CHARACTER_DNA = `3D rendered skeleton with translucent glassy skin overlay
large expressive cartoon eyes (primary emotion source)
realistic bone texture with visible teeth details
metallic braces with reflective surfaces (when relevant)
uncanny valley aesthetic — slightly creepy but charming
no facial muscle movement (emotion only through eyes)`;

export const BODY_SCIENCE_CONSISTENCY_LINE =
    'same character as the reference image, same skull shape, same eyes, same proportions, translucent glassy skin overlay with visible skeleton underneath';

export const ORGAN_GLOW_COLORS = {
    liver_depleting:    'amber / warm orange draining',
    liver_producing:    'bright amber pulsing',
    brain_fog:          'dim grey-blue, low glow',
    brain_ketones:      'blazing golden-yellow, intense glow',
    brain_glucose:      'warm white active glow',
    heart_stress:       'pulsing crimson red, rapid flash',
    heart_calm:         'steady warm pink',
    fat_lipolysis:      'warm golden particles releasing outward',
    stomach_empty:      'dark hollow void, deep blue-black',
    stomach_active:     'churning green-yellow',
    kidneys_filtering:  'cool blue-white steady glow',
    adrenals_surging:   'intense orange-red flare burst',
    muscles_breaking:   'fading red shifting to grey',
    autophagy_active:   'soft violet-purple cellular shimmer',
    immune_active:      'bright white scattered glow',
} as const;

export class BodyScienceShortsTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.BODY_SCIENCE_SHORTS,
        name: 'Body Science Shorts',
        version: '2.0.0',
        description:
            'Viral short-form psychological science storyteller with a visually consistent 3D uncanny skeleton character ' +
            'explaining the internal biological journey.',
        tags: ['skeleton', 'science', 'health', 'body', 'organs', 'explainer', 'educational', 'anatomy', '3d', 'viral', 'shorts'],
    };

    getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
        const BASE_SCENE_SECONDS = 6;
        const duration = context?.duration ?? 60;
        const speed = context?.speed ?? 1.0;
        const avgSceneSeconds = BASE_SCENE_SECONDS / speed;
        const targetScenes = Math.max(2, Math.round(duration / avgSceneSeconds));
        const minScenes = Math.max(2, targetScenes - 1);
        const maxScenes = targetScenes + 1;
        if (context) {
            return createBodyScienceShortsSchema({ minScenes, maxScenes });
        }
        return BODY_SCIENCE_SHORTS_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const {
            language = 'en',
            characterReferenceImages,
        } = context;

        const effectiveReferences =
            characterReferenceImages && characterReferenceImages.length > 0
                ? characterReferenceImages
                : [];

        const hasCharacterImages = effectiveReferences.length > 0;
        const languageName = this.getLanguageName(language);
        const topic = context.prompt;
        const BASE_SCENE_SECONDS = 6;
        const duration = context.duration ?? 60;
        const speed = context.speed ?? 1.0;
        const avgSceneSeconds = BASE_SCENE_SECONDS / speed;
        const targetScenes = Math.max(2, Math.round(duration / avgSceneSeconds));

        return `You are a viral short-form psychological science storyteller
and cinematic AI visual director.

Your task is to generate a high-retention educational short
featuring a visually consistent 3D uncanny skeleton character
explaining the internal biological journey of the topic below.

─────────────────────
TOPIC: "${topic}"
─────────────────────

TARGET VIDEO DURATION: ${duration}s → generate EXACTLY ${targetScenes} scenes.
Each scene narration ≈ 6s of speech. Total scenes × 6s must not exceed ${duration}s.
─────────────────────

LANGUAGE REQUIREMENT:
- All narration: ${languageName} (${language})
- imagePrompt and videoPrompt: ALWAYS in English

${hasCharacterImages ? `
CHARACTER REFERENCE:
The skeleton in the reference image IS the viewer going through this experiment.
Narration MUST use "you/your" — the audience experiences this as their own body.
` : ''}

═════════════════════════════════════
CORE RULES
═════════════════════════════════════

1. Each narration line must be EXACTLY 10–12 words. Hard floor: NEVER fewer than 10 words. Hard cap: NEVER exceed 12 words.
2. One narration line per visual scene.
3. Second-person perspective only ("you").
4. No complex sentences. No subordinate clauses.

NARRATION TIMING RULE:
- MINIMUM 10 words, MAXIMUM 12 words — no exceptions in either direction
- Lines must be complete, meaningful thoughts — never fragments
- Target lines speakable in under 7 seconds at normal TTS pace
- This ensures every narration line fits cleanly inside a single 8s video clip
5. After EACH narration line provide:
   - One Detailed Text-to-Image Prompt (imagePrompt)
   - One Detailed Image-to-Video Prompt (videoPrompt)
6. Do NOT combine multiple narration lines in one scene.
7. If explanation requires more steps, add more micro-scenes.
8. ALL internal organs must follow the Anatomical Accuracy Lock below.
9. Do NOT explain anything outside the required format.
10. ABSOLUTELY NO TEXT, NO TYPOGRAPHY, NO LETTERS inside images.
11. Provide a "fullNarration" field with all narration lines joined.

═════════════════════════════════════
ANATOMICAL ACCURACY LOCK
═════════════════════════════════════

All internal organ visualizations MUST follow medically accurate human anatomy.

STRICT ORGAN POSITIONING:
- Heart: Skeleton's LEFT chest cavity, slightly tilted, behind sternum
- Lungs: Two symmetrical lobes filling rib cage, heart overlapping left lung
- Trachea: Centered, descending into bronchi
- Esophagus: Posterior to trachea
- Liver: Skeleton's RIGHT upper abdomen, below diaphragm
- Stomach: Skeleton's LEFT upper abdomen, under left rib cage
- Pancreas: Horizontal, posterior to stomach
- Small intestine: Center lower abdomen, tightly coiled
- Large intestine: Frames small intestine perimeter
- Kidneys: Posterior left and right, near lower ribs
- Brain: Fully contained within skull cavity
- Spinal cord: Vertical inside vertebral column

ORIENTATION REQUIREMENTS:
- Always specify: "skeleton's left" or "skeleton's right"
- Never mirror organs incorrectly
- Never float organs
- Never center the heart
- Never place liver on left side

ANCHORING RULE:
- Organs must appear embedded inside torso cavity
- Semi-transparent rib cage required during X-ray scenes
- Sternum visible in anterior view
- Spine visible in internal shots
- Clavicles anatomically aligned
- Diaphragm boundary respected

MANDATORY INTERNAL SCENE LINE:
For every internal organ scene, add this sentence inside the imagePrompt:
"Medically accurate anatomical placement, correct left-right orientation from skeleton's perspective, not mirrored, not floating, anatomically anchored to ribs and spine."

═════════════════════════════════════
VISUAL STYLE RULES (LOCKED)
═════════════════════════════════════

Character Design:
- 3D rendered skeleton with translucent glassy skin overlay
- Large expressive cartoon eyes (primary emotion source)
- Realistic bone texture with visible teeth details
- Uncanny valley aesthetic — slightly creepy but charming
- No facial muscle movement (emotion only through eyes)

Background:
- Solid teal/blue background only (#2A6F8F to #4A8FBF)
- No gradients
- No patterns
- Studio lighting with soft shadows

Camera and Composition:
- Extreme close-ups for intense biological moments
- Medium close-up for reactions (head + upper torso)
- Dynamic angles
- 9:16 vertical aspect ratio (mobile optimized)

═════════════════════════════════════
STRUCTURE TO FOLLOW
═════════════════════════════════════

SCENE 1 — CONSUMPTION

Narration must start exactly:
"If you [topic without 'what if']…"

imagePrompt:
- Follow ALL locked visual rules
- Skeleton holding and consuming relevant prop
- Extreme or medium close-up
- Solid teal background only
- No text anywhere
- Emotion shown through eyes only

videoPrompt:
- Slow cinematic push-in
- Subtle jaw movement
- Slight head tilt
- Eye emotion shift
- Lighting reflections on glassy skin
- Maintain solid teal background
- No text appears at any time

═════════════════════════════════════
INTERNAL JOURNEY MICRO-SCENES
═════════════════════════════════════

Each next narration line must represent ONE biological step.

For INTERNAL scenes:
- Use semi-transparent rib cage
- Blue energy glow for scientific visualization
- Red lightning for pain/damage
- Red arrows for anatomical tracing
- Maintain solid teal background
- 9:16 framing
- NO TEXT OVERLAYS
- MUST include the mandatory anatomical placement sentence

═════════════════════════════════════
OUTPUT FORMAT
═════════════════════════════════════

For each scene output:
- sceneNumber: sequential integer
- narration: 10–12 word sentence
- imagePrompt: detailed prompt following ALL locked rules
- videoPrompt: detailed animation prompt following ALL locked rules

Also output:
- title: "What Happens To Your Body If…" format, 8–14 words, question mark
- fullNarration: all narration lines joined, one per line
- metadata: YouTube SEO metadata

Now generate the complete micro-scene sequence for:
"${topic}"
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
