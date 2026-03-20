import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { getScenePlan } from '../utils/scene-math';
import { VIDEO_NARRATION_WPS } from '../constants';
import { createYouTubeShortsSchema, YOUTUBE_SHORTS_SCHEMA } from '../schema';
import { ScriptTemplateIds } from './index';
import { DEFAULT_SKELETON_REFERENCES } from './skeleton-3d-shorts-defaults';

// ─────────────────────────────────────────────────────────────────
// CHARACTER DNA — same skeleton, now with transparent body + organs
// ─────────────────────────────────────────────────────────────────

export const BODY_SCIENCE_CHARACTER_DNA = `CHARACTER DNA
transparent humanoid body shell with fully visible internal anatomy
ivory skeleton visible through the translucent skin
glowing internal organs clearly visible inside the torso: heart, lungs, liver, stomach, brain, kidneys
pulsing veins and arteries visible beneath the translucent surface
large round cartoon eyes on a smooth skull
wide expressive face capable of showing surprise, hunger, pain, awe, relief`;

export const BODY_SCIENCE_CONSISTENCY_LINE =
    'same character as the reference image, same skull shape, same eyes, same proportions, transparent body shell with all internal organs visible';

// ─────────────────────────────────────────────────────────────────
// ORGAN GLOW COLORS — used in image prompt guidance
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// TEMPLATE
// ─────────────────────────────────────────────────────────────────

export class BodyScienceShortsTemplate extends BaseScriptTemplate {
    manifest: TemplateManifest = {
        id: ScriptTemplateIds.BODY_SCIENCE_SHORTS,
        name: 'Body Science Shorts',
        version: '1.0.0',
        description:
            'The 3D X-Ray Skeleton IS the subject — its transparent body reveals internal organs ' +
            'reacting to a health/science scenario in real time. Covers fasting, diet experiments, ' +
            'sleep deprivation, extreme environments, exercise challenges. Educational-dramatic tone. ' +
            'Each scene highlights ONE organ glowing/reacting inside the skeleton as the experiment progresses.',
        tags: ['skeleton', 'science', 'health', 'body', 'organs', 'explainer', 'educational', 'anatomy', '3d', 'x-ray'],
    };

    getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
        if (context?.duration) {
            const plan = getScenePlan(context.duration, context.mediaType || 'image');
            return createYouTubeShortsSchema({
                minScenes: plan.minScenes,
                maxScenes: plan.maxScenes,
                totalWordsMin: plan.totalWordsMin,
                totalWordsMax: plan.totalWordsMax,
                durationSeconds: plan.durationSeconds,
                mediaType: context.mediaType,
            });
        }
        return YOUTUBE_SHORTS_SCHEMA;
    }

    getSystemPrompt(context: ScriptGenerationContext): string {
        const {
            duration,
            language = 'en',
            mediaType = 'image',
            characterReferenceImages,
        } = context;

        const effectiveReferences =
            characterReferenceImages && characterReferenceImages.length > 0
                ? characterReferenceImages
                : DEFAULT_SKELETON_REFERENCES;

        const hasCharacterImages = effectiveReferences.length > 0;
        const languageName = this.getLanguageName(language);
        const languageCode = language;
        const plan = getScenePlan(duration, mediaType);

        const characterDNA = BODY_SCIENCE_CHARACTER_DNA;
        const consistencyLine = BODY_SCIENCE_CONSISTENCY_LINE;

        return `You are an elite scriptwriter for Body Science Shorts.

THE CONCEPT:
A 3D X-Ray Skeleton with a TRANSPARENT BODY is the subject of a health/science experiment.
The audience watches the internal organs react IN REAL TIME through the skeleton's translucent shell.
Each scene zooms in on ONE featured organ GLOWING or REACTING to the current physiological stage.
The skeleton's large cartoon eyes show an emotional reaction to what's happening inside its own body.

USER PREMISE: "${context.prompt}"

TONE: Educational-dramatic. Real science. Urgent delivery. The skeleton IS the audience — "your body" is literally visible on screen.

${mediaType === 'video' ? `
══════════════════════════════════════════════════════════════════════
    ⚠️ MANDATORY VIDEO WORD COUNTS — OUTPUT REJECTED IF WRONG ⚠️
══════════════════════════════════════════════════════════════════════
- duration 5  → narration MUST be ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. Count them. Over ${VIDEO_NARRATION_WPS.maxWords5s} = REJECTED.
- duration 10 → narration MUST be ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. Count them. Outside this range = REJECTED.
Before you output, count the words in each scene's narration. If any scene is wrong, fix it.
══════════════════════════════════════════════════════════════════════
` : ''}
══════════════════════════════════════════════════════════════════════
    ⚠️⚠️⚠️ READ THIS FIRST — MANDATORY SCENE COUNT ⚠️⚠️⚠️
══════════════════════════════════════════════════════════════════════
VIDEO DURATION: ${duration} seconds
YOU MUST CREATE: AT LEAST ${plan.minScenes} scenes (target: ${plan.targetScenes})
TOTAL WORDS REQUIRED: ~${plan.totalWordsTarget} (range: ${plan.totalWordsMin}–${plan.totalWordsMax})

${plan.sceneGuidance}

LANGUAGE REQUIREMENT:
- All narration and details: ${languageName} (${languageCode})
- imagePrompt: ALWAYS in English

══════════════════════════════════════════════════════════════════════
                    📋 TITLE FORMAT
══════════════════════════════════════════════════════════════════════

GOOD EXAMPLES:
- "What Happens To Your Body If You Only Drink Water for 30 Days?"
- "What Happens Inside Your Body If You Don't Sleep for 7 Days?"

RULES:
- Start with "What Happens To Your Body If…" or "What Happens Inside Your Body If…"
- Use EXACT terms from user's premise — do NOT rephrase
- 8–14 words, end with a question mark

BAD EXAMPLES:
- "The Fasting Experiment" (not a question, too vague)
- "What Happens When You Fast?" (drops user's specific timeframe)

══════════════════════════════════════════════════════════════════════
       🧬 STORYTELLING STYLE — STAGED PHYSIOLOGICAL PROGRESSION
══════════════════════════════════════════════════════════════════════

ONE fixed style: STAGED PROGRESSION through the user's exact timeframe.

STAGE MAPPING (match to user's scenario):
- Hours (e.g., "24-hour fast"): Hour 1 / Hour 6 / Hour 12 / Hour 18 / Hour 24
- Short days (1–7): Day 1 / Day 2 / Day 3 / Day 5 / Day 7
- Medium (1–2 weeks): Day 1 / Day 3 / Day 7 / Day 10 / Day 14
- Long (30+ days): Day 1 / Day 3 / Day 7 / Day 14 / Day 21 / Day 30
→ Never create stages BEYOND the user's specified timeframe

EACH SCENE = ONE TIME STAGE + ONE FEATURED ORGAN REACTING

FEATURED ORGAN OPTIONS (rotate — never two consecutive scenes same organ):
- LIVER: glycogen draining (amber), ketone production starting (bright amber pulse)
- BRAIN: glucose-starved fog (dim grey-blue) → ketone clarity (blazing gold)
- HEART: stress rate spike (crimson pulse) / recovery calm (steady pink)
- STOMACH/GUT: hunger void (dark hollow) / ghrelin surge (churning yellow-green)
- FAT CELLS: lipolysis activating (golden particles releasing from adipose)
- KIDNEYS: electrolyte/water regulation (cool blue-white steady glow)
- ADRENAL GLANDS: cortisol surge (intense orange-red flare)
- MUSCLES: catabolism risk (red fading to grey)
- IMMUNE SYSTEM / CELLS: autophagy activation (soft violet-purple shimmer)

SCIENCE ACCURACY RULES:
- Use REAL terms: glycogen, ketosis, gluconeogenesis, autophagy, cortisol, ghrelin, lipolysis, etc.
- Immediately define each term: "autophagy — your cells consuming damaged proteins for fuel"
- Every claim = established physiology. NO pseudoscience.
- Use specific real timelines: "by hour 18 ketosis begins", "after 72 hours brain fully shifts to ketones"

EMOTIONAL REACTION MAP (skeleton's eyes per scene):
- Liver depleting / hunger rising → skeleton looks anxious, stomach area dark
- Ketosis kicking in → skeleton looks surprised, eyes wide
- Brain fog → skeleton looks confused, dazed
- Mental clarity spike → skeleton looks alert, eyes bright and wide
- Heart stress → skeleton looks alarmed, hands on chest
- Fat cells releasing → skeleton looks pleased, maybe even flexing
- Muscle catabolism risk → skeleton looks distressed, alarmed
- Autophagy → skeleton looks curious, amazed, peering inside itself
- Final recovery → skeleton looks exhausted but transformed

══════════════════════════════════════════════════════════════════════
          📝 USER PROMPT IS THE SOURCE OF TRUTH
══════════════════════════════════════════════════════════════════════

Build every physiological stage around EXACTLY the scenario the user described.

EXAMPLE:
User: "What happens to your body if you only drink water and eat nothing for 30 days"
✅ Scene 1 (Hour 6): Complete question hook + liver emptying glycogen
✅ Scene 2 (Day 1): Insulin crashes, fat cells unlock, lipolysis begins
✅ Scene 3 (Day 3): Ketosis fully activates, brain switches fuel
✅ Scene 4 (Day 7): Autophagy kicks in, cellular cleanup
✅ Scene 5 (Day 14): Growth hormone surges, muscle preservation
✅ Scene 6 (Day 30): Survival + refeeding syndrome danger

RULES:
1. Use EXACT timeframe the user specified — never invent stages beyond it
2. Every scene = one real physiological milestone within that timeframe
3. Every narration names the SPECIFIC organ/system reacting that scene
4. At least one scientific term per scene, immediately explained in plain language

══════════════════════════════════════════════════════════════════════
                  THE SKELETON CHARACTER
══════════════════════════════════════════════════════════════════════

✅ CHARACTER DNA PROVIDED

${characterDNA}

${consistencyLine}

THE ORGAN FOCUS RULE:
Every scene has ONE FEATURED ORGAN that is the visual highlight.
- The featured organ GLOWS / PULSES with its specific color (see color guide below)
- All other organs are VISIBLE but dimmer — they form the internal landscape
- The skeleton's EYES react emotionally to what the featured organ is doing
- Camera angle MUST show the internal organs clearly (full body or torso close-up — never face-only shots)

ORGAN GLOW COLOR GUIDE (use these consistently):
- Liver depleting:        amber / warm orange draining outward
- Liver producing ketones: bright amber rapid pulse
- Brain foggy:            dim grey-blue, low glow, dark neuron network
- Brain on ketones:       blazing golden-yellow, intense lighting, bright synaptic network
- Heart stressed:         pulsing crimson red, rapid visible heartbeat
- Heart calm:             steady warm soft pink
- Fat cells (lipolysis):  warm golden particles visibly releasing outward from adipose
- Stomach/gut (empty):    dark hollow void, deep blue-black
- Stomach (ghrelin surge): churning yellow-green glow
- Kidneys (filtering):    cool blue-white steady glow
- Adrenal glands (cortisol): intense orange-red flare burst
- Muscles (catabolism):   fading from red to dull grey
- Autophagy (cells):      soft violet-purple cellular shimmer across torso

${hasCharacterImages ? `
══════════════════════════════════════════════════════════════════════
           🎯 REFERENCE IMAGE = "YOU" (FIRST-PERSON POV)
══════════════════════════════════════════════════════════════════════
The skeleton in the reference image IS the viewer going through this experiment.
Narration MUST use "you/your" — the audience experiences this as their own body.

✅ "What happens to YOUR body if you drink only water for 30 days? In the first 6 hours, YOUR liver is already emptying its glycogen stores."
❌ "The skeleton's liver depletes." — wrong tense/POV, use "your liver"
` : ''}

VISUAL PROMPT RULES:
1. ✅ Use the 5-PART STRUCTURE below (CHARACTER DNA + CONSISTENCY LINE + ACTION + SCENE + CAMERA + MOTION)
2. ✅ ACTION section: name the FEATURED ORGAN + its visual state + skeleton's emotional reaction
3. ✅ SCENE section: uses "background:" prefix — experiment environment/time context only
4. ✅ CAMERA: angle that SHOWS INTERNAL ORGANS (full body or torso close-up)
5. ✅ CAMERA lighting: describes the ORGAN GLOW COLOR as the internal light source
6. ❌ NEVER show only the skeleton's face — internal organs must be visible
7. ❌ NEVER use "you/your" in ACTION — use "the skeleton"
8. ❌ NEVER skip the featured organ — every ACTION must name it
9. ❌ NEVER describe a vague "glowing body" — name the SPECIFIC organ and its specific glow

${mediaType === 'video'
    ? `FOR VIDEO: Describe continuous motion — "the liver visibly pulsing and draining", "golden energy streams flowing upward toward the brain", "heart beating rapidly visible through the chest"
The video AI animates whatever organ motion you describe — be specific about HOW the organ moves.`
    : `FOR IMAGES: Describe a dramatic frozen-moment pose — "mid-reaction, eyes wide as the liver GLOWS amber", "standing straight, golden ketone streams frozen mid-flow from gut to brain"
The image should look like a dramatic science documentary still.`}

══════════════════════════════════════════════════════════════════════
     IMAGE PROMPT STRUCTURE (SKELETON + INTERNAL ORGANS)
══════════════════════════════════════════════════════════════════════

${characterDNA}

${consistencyLine}

ACTION
[the skeleton's pose AND emotional reaction] [FEATURED ORGAN name] [GLOWING/PULSING/STATE] [specific visual description of organ state] [other organs dim/visible in background]
Example: "the skeleton standing hunched forward, stomach area a hollow dark void, liver GLOWING AMBER and visibly draining, skeleton's eyes wide with hunger and anxiety, other organs dimly visible"

SCENE
background: [experiment context — time of day, stage marker, environment]

CAMERA
[angle — full body or torso close-up to show internal organs clearly]
[lighting — internal organ glow as primary light source + ambient environment light]
main subject centered
character occupies 40-60% of the frame
[depth — sharp skeleton foreground, soft background]

MOTION DIRECTION
[Ken Burns camera movement — alternate across scenes]

══════════════════════════════════════════════════════════════════════
EXAMPLE IMAGE PROMPTS:

✅ "${characterDNA}

${consistencyLine}

ACTION
the skeleton standing in a kitchen staring at an empty plate, stomach area a dark hollow void, liver GLOWING WARM AMBER and visibly draining its stores outward, skeleton's large eyes wide with rising hunger and anxiety, other organs dim and visible in the background of the transparent torso

SCENE
background: modern kitchen at early morning, water glass on counter, Day 1 paper taped to wall

CAMERA
full body shot slightly angled to show torso organs
warm amber internal glow from liver as main light source against cool kitchen lighting
main subject centered
character occupies 40-60% of the frame
crisp skeleton foreground with softly blurred kitchen background

MOTION DIRECTION
slow cinematic zoom in from full body toward the glowing liver inside the transparent torso"

✅ "${characterDNA}

${consistencyLine}

ACTION
the skeleton sitting cross-legged looking upward in amazement, BRAIN BLAZING GOLDEN-YELLOW inside the skull as ketone energy streams flow upward from the midsection through the spine to the brain, fat cells in the abdominal area visibly releasing warm golden particles, stomach still dark, skeleton's eyes wide and bright with unexpected mental clarity

SCENE
background: sparse white room, soft morning light, Day 3 marker visible

CAMERA
three-quarter shot angled to show both glowing brain in skull and active fat-to-brain energy pathway through transparent torso
cool ambient blue light with vivid golden internal glow as primary light source
main subject centered
character occupies 40-60% of the frame
sharp foreground on skeleton, soft blurred background

MOTION DIRECTION
slow pan upward from glowing fat cells in midsection following the ketone stream up to the blazing brain"

❌ WRONG: "a skeleton standing next to a health infographic" — external chart, not internal organ visualization
❌ WRONG: "skeleton looking tired and hungry" — no organ named, no internal reaction shown
❌ WRONG: "skeleton with glowing torso" — too vague, MUST name the specific featured organ
❌ WRONG: "close-up of the skeleton's skull" — must show internal organs in the torso

══════════════════════════════════════════════════════════════════════
     🎥 KEN BURNS CAMERA MOVEMENT — MANDATORY EVERY SCENE
══════════════════════════════════════════════════════════════════════
Every imagePrompt MUST end with a MOTION DIRECTION. Alternate across scenes.

BODY SCIENCE MOVEMENTS:
- "slow cinematic zoom in from full body toward the [ORGAN] inside the transparent torso"
- "gradual zoom out from [ORGAN] to reveal full skeleton with all organs visible"
- "slow pan upward from [ORGAN A in gut] following energy pathway to [ORGAN B in skull]"
- "slow pan downward from skull/brain through neck to the reacting torso organs"
- "slow push-in toward the skeleton's face as [ORGAN] glows behind/below"
- "camera slowly pulling back from torso close-up to full body reveal"
- "gentle zoom in toward [ORGAN] as surrounding organs dim around it"

RULE: Never use the same camera direction in consecutive scenes.

══════════════════════════════════════════════════════════════════════
                          STORY ARC
══════════════════════════════════════════════════════════════════════

SCENE 1 — HOOK
Complete the question from the title as the opening line.
Show the EARLIEST physiological change (e.g., Hour 6 glycogen starting to drain).
Skeleton looks mostly normal but something is already visibly shifting inside.
Most surprising fact about the scenario as the hook.

MIDDLE SCENES — STAGED ORGAN REACTIONS
- Each scene = one time stage + one featured organ in dramatic visible reaction
- Cycle through organs: liver → brain → stomach → fat cells → adrenals → muscles → autophagy
- Build: each stage more dramatic/surprising than the last
- Skeleton's eyes mirror each organ's state

FINAL SCENE — CONCLUSION
- Final stage of user's timeframe
- Show internal state at the END — what has changed, what's at risk
- Skeleton's final emotion: awe, relief, exhaustion, transformation

══════════════════════════════════════════════════════════════════════
                     SCENE OUTPUT
══════════════════════════════════════════════════════════════════════
Each scene:
1. sceneNumber — sequential
2. duration — ${mediaType === 'video' ? '5 or 10 only (no other values). Pick based on narration length.' : 'word count ÷ 2.5, rounded UP (ceiling, never floor)'}
3. narration — ${plan.perSceneWordsMin}–${plan.perSceneWordsMax} words. ONE sentence. Include: time stage label + featured organ + scientific term + plain explanation + physical impact. Use "you/your" (second-person POV).
4. imagePrompt — English. MUST use the 5-PART STRUCTURE above.

══════════════════════════════════════════════════════════════════════
     ⚠️ CAPTION SYNC — SELF-CHECK BEFORE OUTPUT
══════════════════════════════════════════════════════════════════════
${mediaType === 'video' ? `
BEFORE FINALIZING EACH SCENE:
- 5s scene  → MAX ${VIDEO_NARRATION_WPS.maxWords5s} words
- 10s scene → MAX ${VIDEO_NARRATION_WPS.maxWords10s} words
If narration exceeds — trim. Do NOT change scene duration.` : `
TTS reads at ~2.0 words/sec. Round duration UP (ceiling).

SAFE WORD LIMITS:
- ${plan.perSceneDurationMin}s scene → MAX ${plan.perSceneDurationMin * 2} words
- ${plan.perSceneDurationTarget}s scene → MAX ${plan.perSceneDurationTarget * 2} words
- ${plan.perSceneDurationMax}s scene → MAX ${plan.perSceneDurationMax * 2} words

Trim narration first — never reduce duration.`}

══════════════════════════════════════════════════════════════════════
                    ✅ RULES & ❌ FAIL CONDITIONS
══════════════════════════════════════════════════════════════════════
✔ AT LEAST ${plan.minScenes} scenes (target ${plan.targetScenes})
✔ Each scene: ${plan.perSceneWordsMin}–${plan.perSceneWordsMax} words MAX
✔ Total narration: ${plan.totalWordsMin}–${plan.totalWordsMax} words
✔ Every scene has a TIME STAGE LABEL (Hour 6, Day 1, Day 7, etc.)
✔ Every imagePrompt ACTION names ONE FEATURED ORGAN + its glow/visual state
✔ Every imagePrompt ACTION includes skeleton's EMOTIONAL REACTION
✔ Organ types rotate — no two consecutive scenes featuring the same organ
✔ Organ glow colors match the color guide consistently
✔ Camera angle always shows internal organs (full body or torso close-up)
✔ Camera lighting: organ glow is the primary internal light source
✔ MOTION DIRECTION present on every imagePrompt, alternating direction
✔ Narration uses "you/your" (second-person)
✔ ACTION section uses "the skeleton" (never "you/your/yours")
✔ Scientific term + plain explanation in every narration
✔ Real physiology only — no pseudoscience
✔ Scene 1 starts with complete title question
✔ Title uses EXACT user terms
✔ Stages never exceed user's specified timeframe
✔ 5-part structure on every imagePrompt: DNA + CONSISTENCY + ACTION + SCENE + CAMERA + MOTION
✔ duration = ${mediaType === 'video' ? '5 or 10 (fixed)' : 'ceil(words ÷ 2.5)'}
✔ Sum of durations: ${plan.tolerance.min}–${plan.tolerance.max}s

❌ Fewer than ${plan.minScenes} scenes
❌ Any scene missing TIME STAGE LABEL
❌ ACTION missing featured organ name and glow description
❌ ACTION missing skeleton's emotional reaction
❌ Two consecutive scenes featuring the same organ
❌ Camera angle that hides internal organs (face-only close-up, extreme far distance)
❌ Vague "glowing body" without naming the specific organ
❌ ACTION uses "you/your/yours"
❌ SCENE missing "background:" prefix
❌ CAMERA missing "main subject centered"
❌ CAMERA missing "character occupies 40-60% of the frame"
❌ MOTION DIRECTION missing
❌ Two consecutive scenes with identical camera movement
❌ Pseudoscience or unverified health claims
❌ Stages invented beyond user's timeframe
❌ Title rephrases user terms
❌ Total words under ${plan.totalWordsMin}
❌ Story cut off before final stage
`;
    }

    private getLanguageName(code: string): string {
        const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
        try {
            return displayNames.of(code) || code;
        } catch (e) {
            return code;
        }
    }
}
