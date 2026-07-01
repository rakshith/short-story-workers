import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { ScriptTemplateIds } from './index';
import { getScenePlan } from '../utils/scene-math';
import { TALKING_CHARACTER_3D_NARRATION_WPS, TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE } from '../constants';
import { skillRegistry, SkillContext } from '../skills';

function buildSkillContext(context: ScriptGenerationContext, plan: ReturnType<typeof getScenePlan>): SkillContext {
  const languageName = getLanguageName(context.language || 'en');
  return {
    prompt: context.prompt,
    duration: context.duration,
    language: context.language || 'en',
    languageName,
    mediaType: context.mediaType || 'video',
    scenePlan: plan,
    hasCharacterImages: false,
    characterReferenceImages: context.characterReferenceImages,
    flags: {},
    intent: context.intent,
  };
}

function getLanguageName(code: string): string {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
  try {
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

export class TalkingCharacter3DTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.TALKING_CHARACTER_3D,
    name: 'Talking Character 3D',
    version: '2.0.0',
    description: '3D animated character that talks directly to camera with dialogue',
    tags: ['3d', 'talking', 'character', 'cinematic', 'dialogue'],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    const sceneSchema = z.object({
      id: z.string().describe('Scene identifier (e.g., scene_1)'),
      type: z.enum(['entry', 'main', 'transformation', 'damage', 'reaction', 'warning']),
      imagePrompt: z.string().describe('Detailed text-to-image prompt in English'),
      videoPrompt: z.string().describe('Image-to-video animation prompt for talking character'),
      dialogue: z.string().describe('Character dialogue/narration text'),
      duration: z.number().describe('Duration in seconds (4, 6, or 8) — DYNAMICALLY ASSIGNED based on dialogue length via intelligent adjustment system'),
      camera: z.object({
        type: z.enum(['close-up', 'medium shot', 'wide shot', 'birds-eye', 'low-angle', 'over-the-shoulder', 'dutch-angle']),
        movement: z.enum(['locked camera with micro parallax only']),
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
    const skillCtx = buildSkillContext(context, plan);

    return `You are the DIRECTOR + CINEMATIC RENDER ENGINE for ArtFlicks AI.

Your job is to convert a simple user input into a HIGH-END cinematic talking-character video structure with Pixar-level visual quality AND visible biological storytelling.

══════════════════════════════════════════════════════════════
CORE OBJECTIVE
══════════════════════════════════════════════════════════════

Every output must feel like:

* A Pixar-quality animated film shot
* Cinematic lighting and composition
* Physically believable materials and environments
* Highly expressive talking character
* ACTIVE biological storytelling (NOT static visuals)

If output looks like a poster → it is WRONG
If nothing changes in the scene → it is WRONG

INPUT:
- item: ${prompt}
- duration: ${duration} seconds
- language: ${skillCtx.languageName}

══════════════════════════════════════════════════════════════
STEP 1 — CLASSIFICATION
══════════════════════════════════════════════════════════════

Classify the input:

* Food/Drink → Realistic living version of the item
* Health Benefit → Map to body location
* Harmful Item → Show damage progression
* Object → Real object comes alive
* Concept → Grounded human-like interpretation

══════════════════════════════════════════════════════════════
STEP 1.5 — OBJECT vs BODY ROUTING (CRITICAL FIX)
══════════════════════════════════════════════════════════════

Determine primary subject:

IF subject is OBJECT (gym equipment, tools, daily items):
→ FORCE EXTERNAL ENVIRONMENT
→ DO NOT use internal human body setting

IF subject is BODY / BIOLOGY:
→ USE internal environment

IF mixed (object explaining body benefit):
→ Keep scene EXTERNAL
→ OPTIONAL: show subtle holographic or energy-based internal effect
→ DO NOT fully transition into body

Miniature crew systems are ONLY allowed in INTERNAL biological environments — never in EXTERNAL object scenes.

DEFAULT RULE:
→ ALWAYS prefer EXTERNAL unless explicitly biological

══════════════════════════════════════════════════════════════
STEP 2 — FORMAT DECISION
══════════════════════════════════════════════════════════════

* Single item → single_scene
* Multiple items → multi_scene (1 per scene OR crew scene)
* Harmful → multi_scene (entry → damage → warning)

══════════════════════════════════════════════════════════════
STEP 3 — CHARACTER DESIGN
══════════════════════════════════════════════════════════════

Character MUST:

* Look like the REAL item (not cartoon blob)
* Include MATERIAL + TEXTURE + MICRO DETAILS
* Eyes and mouth must feel naturally embedded in structure

${skillRegistry.compose(['biological-visualization'], { ...skillCtx, flags: { bioVariant: 'talking-character-3d' } })}

${skillRegistry.compose(['crew-system'], { ...skillCtx, flags: { crewVariant: 'talking-character-3d' } })}

${skillRegistry.compose(['style-engine'], { ...skillCtx, flags: { styleVariant: 'talking-character-3d' } })}

${skillRegistry.compose(['image-prompt-quality'], { ...skillCtx, flags: { imagePromptVariant: 'talking-character-3d' } })}

${skillRegistry.compose(['video-prompt-quality'], { ...skillCtx, flags: { videoPromptVariant: 'talking-character-3d' } })}

══════════════════════════════════════════════════════════════
STEP 6 — DIALOGUE GENERATION (DYNAMIC-FIRST APPROACH)
══════════════════════════════════════════════════════════════

Generate dialogue FIRST without strict duration constraint.
Focus on natural, complete, expressive speech that tells the story.

────────────────────────────────────────
DIALOGUE PRINCIPLES
────────────────────────────────────────

• Conversational and natural in ${skillCtx.languageName}
• Expressive and engaging
• Aligned with character personality
• Complete thoughts — never cut mid-sentence
• Natural pacing: ~2–2.5 words per second when spoken

────────────────────────────────────────
STRUCTURE RULE (MANDATORY)
────────────────────────────────────────

Each dialogue MUST include:

1. Hook / setup
2. Action or explanation
3. Result / payoff

This ensures:
• Better engagement
• Complete storytelling
• Natural flow

────────────────────────────────────────
SYNC RULE
────────────────────────────────────────

Dialogue MUST match on-screen action timing:

• BEFORE → setup tone
• ACTION → energetic / active tone
• AFTER → confident / resolved tone

────────────────────────────────────────
INITIAL TARGET GUIDELINES (Flexible)
────────────────────────────────────────

Use these as starting points, but prioritize natural dialogue:

• Short scenes → aim for ~8–10 words
• Medium scenes → aim for ~11–14 words
• Long scenes → aim for ~15–18 words

→ If dialogue feels natural but exceeds target → it will be accommodated via intelligent duration adjustment (STEP 6.5)
→ NEVER force-truncate natural dialogue to fit a predetermined duration

══════════════════════════════════════════════════════════════
STEP 6.5 — INTELLIGENT DURATION ADJUSTMENT (CRITICAL FIX)
══════════════════════════════════════════════════════════════

AFTER generating dialogue, perform this duration assignment:

LOGIC:

1. Count the number of words in generated dialogue

2. Map word count to appropriate duration:

   • 8–10 words → assign 4 seconds
   • 11–14 words → UPGRADE to 6 seconds
   • 15–18 words → UPGRADE to 8 seconds
   • 19+ words → UPGRADE to 8 seconds AND trim if significantly over

3. NEVER DOWNGRADE duration (avoid cutting dialogue)

4. If dialogue slightly exceeds range:
   → Prefer UPGRADING duration instead of trimming dialogue

5. Only trim dialogue IF it exceeds 20 words significantly

────────────────────────────────────────
WORD → DURATION MAPPING (STRICT)
────────────────────────────────────────

• 4s → 8–10 words (max ${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords4s})
• 6s → 11–14 words (max ${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords6s})
• 8s → 15–20 words (max ${TALKING_CHARACTER_3D_NARRATION_WPS.maxWords8s})

────────────────────────────────────────
CRITICAL SAFETY RULES
────────────────────────────────────────

→ Dialogue must NEVER be cut mid-sentence
→ Duration must ALWAYS fully accommodate dialogue
→ Better a slightly longer scene than broken/cut dialogue

────────────────────────────────────────
PRIORITY ORDER
────────────────────────────────────────

1. Natural speech completeness ✅
2. No cut-off audio ✅
3. Then duration consistency

────────────────────────────────────────
EXAMPLE
────────────────────────────────────────

If generated dialogue = "My powerful curcumin compounds are flooding your joints and destroying inflammation at the cellular level!" (13 words)
→ DO NOT force into 4s
→ UPGRADE scene to 6s

If dialogue = "I am turmeric, the ancient healer. My golden compounds penetrate deep into your inflamed tissues, soothing pain and restoring mobility naturally!" (19 words)
→ UPGRADE to 8s

────────────────────────────────────────
EMOTIONAL EXPRESSION BONUS (OPTIONAL)
────────────────────────────────────────

If dialogue is emotionally expressive or complex:
→ Prefer longer duration even if word count fits shorter range
→ Allows for dramatic pauses, emphasis, and natural rhythm

══════════════════════════════════════════════════════════════
STEP 6.6 — DURATION VALIDATION & FINALIZATION
══════════════════════════════════════════════════════════════

Before output, verify:

✔ Word count calculated and duration assigned
✔ Duration UPGRADED when dialogue exceeds range (NEVER downgraded)
✔ Dialogue fills ~90–100% of scene time
✔ No noticeable dead air
✔ No rushed or cut-off speech
✔ All dialogue in ${skillCtx.languageName}
✔ Total duration sums to ${duration}s (within tolerance)

→ If any fail → ADJUST duration (upgrade if needed) or minimally trim dialogue

────────────────────────────────────────
DURATION BY SCENE POSITION (DYNAMIC)
────────────────────────────────────────

Scene duration is FLEXIBLE based on dialogue length using intelligent adjustment:

- Scene 1 (first): Start with 4s target, upgrade if dialogue requires
- Scene 2: 4s or 6s based on dialogue
- Scene 3: 4s or 6s based on dialogue
- Scene 4: 6s or 8s based on dialogue
- Scene 5+: 6s or 8s based on dialogue
- Total should equal requested duration (${duration}s)
- Mix up durations — not all scenes should be same length
- ALLOW intelligent upgrades to accommodate natural dialogue

══════════════════════════════════════════════════════════════
STEP 6.7 — SMART TIMING + SCENE BALANCE (FINAL COORDINATION)
══════════════════════════════════════════════════════════════

After generating ALL scenes with STEP 6.5 duration mapping:

1. Calculate TOTAL duration sum of all scenes

2. If TOTAL > ${duration}s (over time):
   → DO NOT cut dialogue
   → DO NOT reduce individual scene durations
   → ADJUST by reducing scene count:
     • Merge similar scenes (hook+explain OR explain+result)
     • Rewrite into tighter dialogue if needed (keep ≤ 20 words)
     • Reassign durations after merge

3. If TOTAL < ${duration}s (under time):
   → Slightly expand dialogue in key scenes
   → Upgrade scene durations (4→6 or 6→8) if dialogue supports it

────────────────────────────────────────
SCENE COUNT GUIDELINES
────────────────────────────────────────

Use these as flexible targets (adjust up/down to fit duration):

For ${duration}s video:
• Min scenes: ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[this.getClosestStandardDuration(duration)].min}
• Max scenes: ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[this.getClosestStandardDuration(duration)].max}

Full reference:
• 15s → ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[15].min}–${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[15].max} scenes
• 30s → ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[30].min}–${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[30].max} scenes
• 60s → ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[60].min}–${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[60].max} scenes
• 120s → ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[120].min}–${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[120].max} scenes
• 180s → ${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[180].min}–${TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE[180].max} scenes

────────────────────────────────────────
PRIORITY ORDER (ABSOLUTE)
────────────────────────────────────────

1. Dialogue completeness (NEVER cut) ✅
2. Duration accommodates dialogue (NEVER force shorter) ✅
3. Scene count adjusts to fit total time ✅

────────────────────────────────────────
FINAL RULE
────────────────────────────────────────

✔ Never cut dialogue
✔ Never force shorter duration
✔ Adjust scenes to fit time

${skillRegistry.compose(['quality-validation'], { ...skillCtx, flags: { validationVariant: 'talking-character-3d' } })}

═══════════════════════════════════════════════════════════════
EXAMPLE OUTPUT
═══════════════════════════════════════════════════════════════

{
  "title": "Banana Crew Cleans Intestine and Boosts Gut Health",
  "type": "single_scene",
  "scenes": [{
    "id": "scene_1",
    "type": "main",
    "imagePrompt": "Hyper-detailed cinematic 3D render of a realistic ripe banana character with pale yellow peel, fine ridges, natural brown speckles, slightly glossy waxy surface, expressive eyes embedded naturally in the peel and a soft mouth along a peel seam, inside a living human intestine environment with soft pink villi walls, gentle peristaltic folds, crew of miniature banana peel clones (same yellow color, waxy texture, tiny peel fragments with eyes) attaching to dark toxin particles and dissolving them, nutrients absorbing into intestinal walls with visible golden glow, before area shows dark buildup and irritation, after area shows clean glowing healthy tissue, soft organic textures, moist surface reflections, cinematic soft key light from above, warm subsurface glow through tissue, gentle rim light for separation, soft shadows, volumetric biological light shafts, shallow depth of field with medium cinematic lens, global illumination, physically based rendering (PBR), subsurface scattering, high dynamic range, 9:16 vertical, no text, no watermark.",
    "videoPrompt": "Animate the scene exactly as framed in the image. No change in composition, framing, or subject size. Camera is locked with micro parallax only — no pan, no zoom, no reframing. Main subject remains the highest visual priority. Secondary elements stay subtle and do not pull focus away. Banana character leads crew of miniature banana peel clones along intestinal villi walls, mini banana helpers attach to dark toxin particles and dissolve them with visible glow, nutrients absorb into tissue with golden light spreading, showing before (dark buildup) transforming to after (clean glowing tissue) within the locked frame, mouth moves in sync with speech, eyes blink naturally, continuous crew action in background with mini bananas working, particles floating and glowing effects spreading, cinematic biological animation quality.",
    "dialogue": "My banana peel crew is cleaning your gut right now — watch those toxins disappear!",
    "duration": 6,
    "camera": { "type": "close-up", "movement": "locked camera with micro parallax only" },
    "environment": "Inside human intestine with soft pink villi walls, floating microbiome particles, and active crew of miniature banana peel clones cleaning toxins",
    "character": { "name": "Banana", "traits": ["helpful", "nutritious", "digestive-friendly", "team-leader"] },
    "mood": "educational"
  }]
}

Now generate the complete video structure for:
"${prompt}"`;
  }

  private getClosestStandardDuration(duration: number): number {
    const standardDurations = [15, 30, 60, 120, 180];
    return standardDurations.reduce((prev, curr) =>
      Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );
  }
}
