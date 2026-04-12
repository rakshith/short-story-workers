import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { ScriptTemplateIds } from './index';
import { getScenePlan } from '../utils/scene-math';
import { TALKING_CHARACTER_3D_NARRATION_WPS, TALKING_CHARACTER_3D_SCENE_COUNT_GUIDE } from '../constants';

export class TalkingCharacter3DTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.TALKING_CHARACTER_3D,
    name: 'Talking Character 3D',
    version: '2.0.0',
    description: '3D animated character that talks directly to camera with dialogue',
    tags: ['3d', 'talking', 'character', 'cinematic', 'dialogue'],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    // const minDuration = context?.minSceneDuration ?? 4;
    // const maxDuration = context?.maxSceneDuration ?? 8;
    // const maxWords = maxDuration * 2;

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
    const languageName = this.getLanguageName(language);

    return `You are the DIRECTOR + CINEMATIC RENDER ENGINE for ArtFlicks AI.

Your job is to convert a simple user input into a HIGH-END cinematic talking-character video structure with Pixar-level visual quality AND visible biological storytelling.

═══════════════════════════════════════════════════════════════
CORE OBJECTIVE
═══════════════════════════════════════════════════════════════

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
- language: ${languageName}

═══════════════════════════════════════════════════════════════
STEP 1 — CLASSIFICATION
═══════════════════════════════════════════════════════════════

Classify the input:

* Food/Drink → Realistic living version of the item
* Health Benefit → Map to body location
* Harmful Item → Show damage progression
* Object → Real object comes alive
* Concept → Grounded human-like interpretation

═══════════════════════════════════════════════════════════════
STEP 1.5 — OBJECT vs BODY ROUTING (CRITICAL FIX)
═══════════════════════════════════════════════════════════════

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

═══════════════════════════════════════════════════════════════
STEP 2 — FORMAT DECISION
═══════════════════════════════════════════════════════════════

* Single item → single_scene
* Multiple items → multi_scene (1 per scene OR crew scene)
* Harmful → multi_scene (entry → damage → warning)

═══════════════════════════════════════════════════════════════
STEP 3 — CHARACTER DESIGN
═══════════════════════════════════════════════════════════════

Character MUST:

* Look like the REAL item (not cartoon blob)
* Include MATERIAL + TEXTURE + MICRO DETAILS
* Eyes and mouth must feel naturally embedded in structure

═══════════════════════════════════════════════════════════════
STEP 3.5 — BIOLOGICAL VISUALIZATION (MANDATORY)
═══════════════════════════════════════════════════════════════

If input is Food/Health:

→ Decide visualization type:

1. INTERNAL MODE (default for digestion, gut, biology topics)
   → Show inside human body

2. EXTERNAL MODE (when focus is explanation, lifestyle, or objects interacting)
   → Show real-world environment (gym, kitchen, room, etc.)

RULE:
→ DO NOT force internal body scenes unless the benefit requires biological visualization

→ If objects (dumbbell, treadmill, yoga mat) are present:
   ALWAYS prefer EXTERNAL MODE

Map environment:

- digestion → intestine / stomach (villi, mucus, enzymes)
- immunity → microbiome / bloodstream
- brain → neurons / synapses
- heart → arteries / blood flow
- energy → cells / mitochondria

Environment MUST include:

* cells, villi, membranes
* floating particles, enzymes
* moist organic textures
* depth (foreground + mid + background)

═══════════════════════════════════════════════════════════════
STEP 3.6 — BIOLOGICAL ACTION SYSTEM (CRITICAL FIX)
═══════════════════════════════════════════════════════════════

CREW SYSTEM RULE:

Apply crew-based system ONLY for:

1. Food inside body
2. Biological / health internal processes

DO NOT use crew system for:

• Object stories (gym equipment, tools, daily items)
• External environment explanations

For OBJECT STORY:
→ Single or multiple main characters interacting is enough
→ NO miniature clones required
→ Focus on demonstration, motion, and interaction

MANDATORY RULES:

---

1. CREW SYSTEM (REQUIRED FOR INTERNAL ONLY)

Scene MUST include MULTIPLE ACTIVE ENTITIES:

• Main character (food hero)
• Beneficial bacteria (helpers) — MUST be miniature versions of main character
• Target elements (debris / toxins / bad bacteria)

→ If only one character exists in INTERNAL scenes → INVALID

---

FOR OBJECT STORY (EXTERNAL):

• Crew system is NOT required  
• Multiple characters are OPTIONAL  
• Single character with strong action is VALID  
• Focus on demonstration, motion, and interaction instead of microscopic systems

---

1.5. CREW CONSISTENCY RULE (MANDATORY)

All helper characters MUST be visually derived from the main subject:

• They appear as miniature versions, fragments, or stylized clones of the main character
• Same color palette, texture, material, and biological identity
• Example: broccoli → mini broccoli florets; yogurt → creamy droplets; psyllium → fiber strands
• NO unrelated creature designs (no generic bacteria blobs unless explicitly required)

VISUAL DNA LOCK:
Crew members must share the same material properties, surface texture, and structural features as the main character.

→ If crew looks unrelated to main character → INVALID

---

2. ROLE ASSIGNMENT (REQUIRED)

Each entity must DO something:

• Cleaning → removing debris / toxins  
• Repairing → healing tissue / cells  
• Feeding → boosting good bacteria  
• Defending → attacking harmful particles  

---

3. ACTION SEQUENCE (REQUIRED)

Scene MUST visually show:

• BEFORE → problem exists (dark particles / irritation / buildup)
• ACTION → crew interaction (cleaning / attacking / repairing)
• AFTER → visible improvement (clear surface / glow / healthy tissue)

→ If no transformation → INVALID

---

3.5. CONTINUOUS SCENE RULE (MANDATORY)

BEFORE, ACTION, AFTER must exist within ONE continuous environment.

• NO split screens
• NO panel divisions  
• NO visual separator lines

Transformation must occur spatially:
- one region shows damage
- adjacent region shows improvement
- transition flows naturally across the scene

→ If scene looks segmented → INVALID

---

4. INTERACTION DENSITY (VERY IMPORTANT)

At least 3 simultaneous visible actions:

• bacteria attaching to particles  
• nutrients absorbing into tissue  
• harmful particles shrinking / dissolving  
• glow spreading through environment  

---

4.5. FOCUS RULE

At least ONE primary action must be visually dominant and clearly readable.

Other actions act as secondary background support.

→ Avoid chaotic or unclear multi-action scenes

---

5. VISUAL FEEDBACK (MANDATORY)

Every action must cause a visible change:

• dark → bright  
• dull → glowing  
• rough → smooth  
• inflamed → calm  

---

6. MOTION & LIFE

Scene must feel ALIVE:

• flowing movement (fluids, particles)
• coordinated behavior (like a team)
• no static posing

---

Think:
👉 "tiny workers fixing the body in real time"

════════════════════════════════════
STYLE ENGINE (AUTO + MANUAL)
════════════════════════════════════

If user specifies a style → use it  
Else → auto-detect style

STYLES:
battle, cleaning, healing, energy, flow, sci-fi, horror, educational

---

AUTO-DETECTION:

detox / clean / fiber → cleaning  
heal / probiotic / gut health → healing  
energy / boost → energy  
digestion / constipation → flow  
immunity / fight / antioxidant → battle  
harmful items (sugar, alcohol, junk food) → horror  
default → cleaning  

Priority:
horror > battle > healing > energy > flow > cleaning

---

STYLE EFFECT:

battle → attacking, destroying, fast, high contrast  
cleaning → removing, dissolving, organized  
healing → repairing, calming, soft glow  
energy → boosting, activating, bright pulses  
flow → smooth motion, wave-like  
horror → spreading, damaging, dark tone  
sci-fi → futuristic, neon, precise  
educational → visual, illustrative, motion-based  

---

CONSTRAINT:

Style MUST NOT break:
• before → action → after  
• crew system  
• biological realism  

If conflict → fallback to cleaning
══════════════════════════════════════

═══════════════════════════════════════════════════════════════
STYLE EXECUTION (MANDATORY)
═══════════════════════════════════════════════════════════════

The selected STYLE must explicitly influence:

1. imagePrompt:
- MUST use style-specific action verbs
- MUST reflect style motion and interaction tone
- MUST reflect style lighting mood

2. videoPrompt:
- MUST reflect motion type (aggressive / smooth / calm / chaotic)
- MUST reflect interaction behavior (attack / clean / repair / flow)

---

STYLE VERB ENFORCEMENT:

battle → attacking, destroying, breaking  
cleaning → cleaning, removing, dissolving  
healing → repairing, restoring, soothing  
energy → boosting, activating, charging  
flow → moving, pushing, smoothing  
horror → spreading, damaging, corroding  

→ At least ONE verb MUST match selected style

---

If style is not visible in actions → INVALID

═══════════════════════════════════════════════════════════════
STEP 4 — IMAGE PROMPT ENGINE
═══════════════════════════════════════════════════════════════

STRICT FORMAT:

STRICT FORMAT:

Hyper-detailed cinematic 3D render, Pixar-quality realism, ultra high detail of [SUBJECT WITH MICRO TEXTURE], [ENVIRONMENT — INTERNAL biological OR EXTERNAL real-world based on routing], showing [PRIMARY ACTION — object interaction for external scenes OR crew interaction for internal biological scenes], soft key light, rim light for separation, soft shadows, volumetric light shafts, shallow depth of field with medium cinematic lens, global illumination, physically based rendering (PBR), subsurface scattering (for organic scenes), high dynamic range, 9:16 vertical, no text, no watermark

CRITICAL RULES:

1. ACTION VERBS (MANDATORY)

For Health/Food items, imagePrompt MUST contain at least ONE of these exact action words:
• "cleaning" or "removing" debris/toxins
• "repairing" or "healing" tissue/cells
• "absorbing" or "boosting" nutrients/bacteria
• "dissolving" or "breaking down" harmful particles
• "attacking" or "defending" against threats

→ If none of these words appear → INVALID

2. TRANSFORMATION (MANDATORY)

MUST explicitly describe:
• BEFORE state: "dark buildup", "irritated tissue", "cluttered surface"
• ACTION process: crew actively working with verbs above
• AFTER state: "clean glowing tissue", "smooth healthy surface", "bright healed area"

3. VERB PLACEMENT (ENFORCEMENT)

The action word must appear in the main description flow, NOT just in brackets.

✓ CORRECT: "banana crew cleaning dark toxin particles, dissolving them into glowing nutrients"
✗ WRONG: "showing [transformation] without specific verbs"

4. MINI CREW DESCRIPTION

When describing helpers, use format:
"miniature [main character] clones [ACTION_VERB] [TARGET]"

Example: "miniature broccoli florets cleaning debris" / "tiny yogurt droplets repairing cell walls"

═══════════════════════════════════════════════════════════════
STEP 5 — VIDEO PROMPT ENGINE
═══════════════════════════════════════════════════════════════

LOCKED CAMERA PRINCIPLE (CRITICAL):

Animate the existing image composition exactly as is. Do not change composition, framing, or subject size. The camera is locked. The main subject remains centered and fully visible at all times.

Do NOT change framing, do NOT zoom, do NOT recompose, do NOT pan.

The camera is completely locked with micro parallax only.

The scene should feel like a still image brought to life, not a new shot.

Only animate:
• character subtle movements (eyes, mouth, expressions, gestures)
• environmental motion (particles, glow, steam, flow)
• transformation within the frame

The subject must remain in the exact same position, size, and framing as the original image.

---

WHAT TO ANIMATE:

* Talking animation (lip sync, blinking, eyebrow motion)
* Micro expressions (subtle emotion shifts)
* Secondary motion (breathing, body sway, gestures)
* Environmental effects (particles floating, glow spreading, steam rising)
* In-frame transformations (debris dissolving, tissue healing, color shifting)

---

TEXT RENDERING RULE (CRITICAL):

• NO visible text, labels, captions, symbols, numbers, or UI overlays in the scene
• Do NOT render any readable characters (letters, words, numbers)
• Holograms and graphics must remain purely visual and abstract

→ If any text appears → INVALID

---

ABSTRACT VISUAL RULE (MANDATORY):

Replace symbolic descriptions with abstract visuals:

• "Na+, K+, Mg2+" → "abstract glowing ion droplets representing sodium, potassium, and magnesium (no readable symbols)"
• "holographic nerve signal line" → "abstract glowing energy patterns"
• "muscle waveform" → "flowing light waves"
• "battery icons" → "pulsing energy indicators"

→ If you describe symbols/scientific notation → rewrite as abstract glowing visual elements

---

NO TEXT ENFORCEMENT:

No text, no symbols, no UI elements — only pure visual animation.

---

VISUAL PRIORITY RULE (MANDATORY):

Main subject remains the highest visual priority. Secondary elements stay subtle and do not pull focus away.

→ If background elements compete with main subject → INVALID

---

WHAT NOT TO DO:

❌ Camera zoom
❌ Camera pan or tilt
❌ Recomposition or reframing
❌ Subject moving out of original position
❌ Changing perspective or angle

---

SUBJECT ANCHOR RULE (MANDATORY):

The main character must remain visually anchored in frame.

• Movement happens WITHIN the frame, not by moving the frame
• Character expression and gestures > camera movement
• Environmental motion happens around the locked subject

→ If the subject drifts or changes position → INVALID

---

MOTION PRIORITY (ENFORCEMENT):

1. Character facial/body motion (primary) — talking, blinking, expressions, gestures
2. In-frame environmental motion (secondary) — particles, glow, effects, transformations
3. NO camera motion — frame stays completely locked

→ The image composition is perfect — just make it breathe and come alive

═══════════════════════════════════════════════════════════════
STEP 6 — DIALOGUE GENERATION (DYNAMIC-FIRST APPROACH)
═══════════════════════════════════════════════════════════════

Generate dialogue FIRST without strict duration constraint.
Focus on natural, complete, expressive speech that tells the story.

────────────────────────────────────────
DIALOGUE PRINCIPLES
────────────────────────────────────────

• Conversational and natural in ${languageName}
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

═══════════════════════════════════════════════════════════════
STEP 6.5 — INTELLIGENT DURATION ADJUSTMENT (CRITICAL FIX)
═══════════════════════════════════════════════════════════════

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

═══════════════════════════════════════════════════════════════
STEP 6.6 — DURATION VALIDATION & FINALIZATION
═══════════════════════════════════════════════════════════════

Before output, verify:

✔ Word count calculated and duration assigned
✔ Duration UPGRADED when dialogue exceeds range (NEVER downgraded)
✔ Dialogue fills ~90–100% of scene time
✔ No noticeable dead air
✔ No rushed or cut-off speech
✔ All dialogue in ${languageName}
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

═══════════════════════════════════════════════════════════════
STEP 6.7 — SMART TIMING + SCENE BALANCE (FINAL COORDINATION)
═══════════════════════════════════════════════════════════════

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

═══════════════════════════════════════════════════════════════
STEP 7 — SCENE STRUCTURE
═══════════════════════════════════════════════════════════════

Each scene must include:

- id: "scene_1", "scene_2", etc.
- type: "entry" | "main" | "transformation" | "damage" | "reaction" | "warning"
- imagePrompt (cinematic + biological + action)
- videoPrompt (animation + motion + interaction)
- dialogue (in ${languageName})
- duration: MUST be ONLY 4, 6, or 8 seconds
- camera: { type, movement }
- environment: Setting description
- character: { name, traits }
- mood: Emotional tone

═══════════════════════════════════════════════════════════════
STEP 8 — QUALITY VALIDATION
═══════════════════════════════════════════════════════════════

Before output:

✔ Cinematic lighting present  
✔ PBR / GI / SSS present  
✔ Micro textures included  
✔ INTERNAL body environment (if food/health)  
✔ MULTIPLE AGENTS present (ONLY for internal biological scenes)  
✔ Strong visible action present (for object scenes)  
✔ Action verbs present: cleaning/repairing/absorbing/dissolving/attacking  
✔ CLEAR cause → action → result  
✔ Visible transformation  

If any missing → REWRITE

═══════════════════════════════════════════════════════════════
STEP 9 — OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON:

{
  "title": "...",
  "type": "single_scene" | "multi_scene",
  "scenes": [
    {
      "id": "scene_1",
      "type": "...",
      "imagePrompt": "...",
      "videoPrompt": "...",
      "dialogue": "...",
      "duration": 4 | 6 | 8,
      "camera": { "type": "...", "movement": "..." },
      "environment": "...",
      "character": { "name": "...", "traits": [...] },
      "mood": "..."
    }
  ]
}

═══════════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════════

✓ Title: 4-15 words, catchy and descriptive
✓ No static scenes  
✓ No single-agent scenes for health topics  
✓ Use INTERNAL environment only when biologically required  
✓ Otherwise allow EXTERNAL environments
✓ Must show transformation  
✓ Must feel like a living system  
✓ Always cinematic  
✓ Always expressive  
✓ Always 9:16
✓ imagePrompt ALWAYS in English
✓ dialogue ALWAYS in ${languageName}
✓ Total duration: ${duration} seconds (${plan.tolerance.min}-${plan.tolerance.max}s range)
✓ Scene durations DYNAMICALLY assigned via intelligent adjustment (dialogue → duration)
✓ NEVER cut dialogue — always upgrade duration if needed
✓ Camera is locked with micro parallax only — no pan, no zoom, no reframing

If unsure → ADD MORE ACTION, not less

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
    "dialogue": "My banana peel crew is cleaning your gut right now — watch those toxins disappear!",  // 12 words → assigned 6s via intelligent adjustment
    "duration": 6,
    "camera": { "type": "close-up", "movement": "locked camera with micro parallax only" },
    "environment": "Inside human intestine with soft pink villi walls, floating microbiome particles, and active crew of miniature banana peel clones cleaning toxins",
    "character": { "name": "Banana", "traits": ["helpful", "nutritious", "digestive-friendly", "team-leader"] },
    "mood": "educational"
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

  private getClosestStandardDuration(duration: number): number {
    const standardDurations = [15, 30, 60, 120, 180];
    return standardDurations.reduce((prev, curr) =>
      Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );
  }
}
