import { BaseSkill } from './base';
import { SkillContext } from './types';

export class VideoPromptQualitySkill extends BaseSkill {
  id = 'video-prompt-quality';
  name = 'Video Prompt Quality';
  version = '3.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.videoPromptVariant as string) || 'default';

    if (variant === 'talking-character-3d') {
      return this.talkingCharacter3D();
    }

    if (variant === 'body-science') {
      return this.bodyScience();
    }

    if (variant === 'script-to-shorts') {
      return this.scriptToShorts();
    }

    return this.metadataDriven(context);
  }

  private metadataDriven(context: SkillContext): string {
    const intent = context.intent;
    const mood = intent?.mood || 'cinematic';
    const atmosphere = intent?.atmosphere || 'neutral';
    const contentType = intent?.contentType || 'other';

    const motionVocab = this.getMotionVocabulary(mood);
    const transitionVocab = this.getTransitionVocabulary(atmosphere);
    const contentAdaptation = this.getContentAdaptation(contentType);

    return `══════════════════════════════════════════════════════════════
═══ VIDEO PROMPT QUALITY — DYNAMIC ═══

MOOD: ${mood.toUpperCase()}

${motionVocab}

ATMOSPHERE: ${atmosphere.toUpperCase()}

${transitionVocab}

${contentAdaptation}

MOTION RULES:
- Primary subject has intentional, purposeful movement
- Camera movement serves story (not random)
- Transitions feel natural, not jarring
- Every scene has distinct motion profile`;
  }

  private getMotionVocabulary(mood: string): string {
    const vocabularies: Record<string, string> = {
      premium: `PREMIUM MOTION VOCABULARY:
- Slow, deliberate movements — luxury feel
- Elegant camera work — refined, sophisticated
- Minimal motion — focus on quality
- Subtle parallax — depth, dimension
- Controlled, precise — professional quality`,

      dramatic: `DRAMATIC MOTION VOCABULARY:
- Push-in for emphasis — dramatic approach
- Slow reveal — building tension
- Crane up for scale — grand, epic
- Tracking shot following — emotional journey
- Rack focus — shifting attention, reveal`,

      educational: `EDUCATIONAL MOTION VOCABULARY:
- Step-by-step progression — clear, logical
- Visual hierarchy movement — guide eye
- Diagram-style animation — informational
- Smooth transitions — easy to follow
- Highlight and emphasis — key points`,

      energetic: `ENERGETIC MOTION VOCABULARY:
- Fast tracking — exciting, dynamic
- Whip pan — quick transitions
- Handheld energy — urgency, excitement
- Quick cuts — pace, rhythm
- Dynamic camera angles — action-oriented`,

      serene: `SERENE MOTION VOCABULARY:
- Slow, gentle movements — peaceful
- Floating camera — dreamlike quality
- Smooth dolly — graceful, flowing
- Minimal camera movement — stillness, calm
- Gentle parallax — subtle depth`,

      mysterious: `MYSTERIOUS MOTION VOCABULARY:
- Slow reveal — building intrigue
- Shadow movement — atmospheric
- Creeping camera — tension, anticipation
- Rack focus — revealing, discovering
- Low-angle approach — ominous, powerful`,

      playful: `PLAYFUL MOTION VOCABULARY:
- Bouncy, energetic — fun, lighthearted
- Quick pans — whimsical, surprising
- Dynamic angles — exciting, engaging
- Fast-paced cuts — rhythm, energy
- Unexpected movements — delight, surprise`,

      epic: `EPIC MOTION VOCABULARY:
- Crane up — revealing scale, grandeur
- Wide establishing — scope, context
- Slow push-in — dramatic emphasis
- Tracking shot — following journey
- Aerial movement — sweeping, cinematic`,

      intimate: `INTIMATE MOTION VOCABULARY:
- Close-up movement — personal, emotional
- Slow dolly in — approaching, connecting
- Handheld feel — organic, authentic
- Minimal camera movement — focus on subject
- Gentle breathing motion — life, presence`,

      cinematic: `CINEMATIC MOTION VOCABULARY:
- Dolly in/out — smooth forward/backward
- Tracking shot — following subject laterally
- Crane up/down — vertical movement, reveal
- Steadicam — floating, smooth following
- Orbit — 360-degree subject rotation`,
    };

    return vocabularies[mood] || vocabularies.cinematic;
  }

  private getTransitionVocabulary(atmosphere: string): string {
    const vocabularies: Record<string, string> = {
      warm: `WARM ATMOSPHERE TRANSITIONS:
- Soft cross dissolve — gentle, flowing
- Match cut on color — warm tones continuity
- Fade through warm — golden transition
- Iris in/out — vintage, warm feel
- Slow dissolves — gentle, comfortable`,

      cool: `COOL ATMOSPHERE TRANSITIONS:
- Hard cut — crisp, clean
- Match cut on shape — geometric continuity
- Whip pan — fast, energetic
- Jump cut — temporal, modern
- Sharp transitions — precise, cool`,

      neutral: `NEUTRAL ATMOSPHERE TRANSITIONS:
- Standard cuts — clean, professional
- Cross dissolve — soft temporal transition
- Match cut — visual continuity
- Fade in/out — scene beginning/ending
- Simple transitions — unobtrusive`,

      ethereal: `ETHEREAL ATMOSPHERE TRANSITIONS:
- Slow dissolves — dreamlike, flowing
- Iris transitions — vintage, magical
- Soft focus pulls — revealing, mystical
- Fade through white — heavenly, pure
- Gentle morphing — organic, flowing`,

      gritty: `GRITTY ATMOSPHERE TRANSITIONS:
- Hard cuts — raw, immediate
- Jump cuts — urgency, tension
- Whip pan — fast, energetic
- Handheld transitions — documentary feel
- Abrupt changes — startling, real`,

      minimalist: `MINIMALIST ATMOSPHERE TRANSITIONS:
- Simple cuts — clean, uncluttered
- Hard cuts — direct, efficient
- No transitions — immediate, focused
- Clean breaks — sharp, precise
- Minimal movement — still, calm`,

      maximalist: `MAXIMALIST ATMOSPHERE TRANSITIONS:
- Complex transitions — elaborate, impressive
- Multiple elements — rich, layered
- Dynamic movement — exciting, engaging
- Visual effects — spectacular, memorable
- Dense transitions — full, complete`,

      futuristic: `FUTURISTIC ATMOSPHERE TRANSITIONS:
- Glitch effects — digital, modern
- Holographic transitions — sci-fi, advanced
- Light streaks — energy, technology
- Digital morphing — transformation
- Neon wipes — electric, vibrant`,

      organic: `ORGANIC ATMOSPHERE TRANSITIONS:
- Morphing transitions — natural, flowing
- Growth transitions — organic, living
- Fluid movement — water-like, natural
- Soft dissolves — gentle, breathing
- Natural fades — earthy, authentic`,

      industrial: `INDUSTRIAL ATMOSPHERE TRANSITIONS:
- Mechanical transitions — precise, engineered
- Hard cuts — metallic, strong
- Geometric wipes — angular, structured
- Heavy transitions — weight, power
- Abrupt changes — industrial, raw`,
    };

    return vocabularies[atmosphere] || vocabularies.neutral;
  }

  private getContentAdaptation(contentType: string): string {
    const adaptations: Record<string, string> = {
      product: `PRODUCT VIDEO MOTION:
- Hero shot orbit — product rotation, dimensionality
- Detail pan — texture, material exploration
- Environmental reveal — lifestyle context
- Clean transitions — professional, polished
- Focus on product — no distractions`,

      health: `HEALTH/BIOLOGY VIDEO MOTION:
- Cellular movement — flow, pulse, rhythm
- Transformation sequences — before/during/after
- Organic motion — biological accuracy
- Micro-level animation — cellular detail
- Educational progression — clear, informative`,

      story: `STORY VIDEO MOTION:
- Character movement — expression, gesture
- Environmental motion — world feels alive
- Emotional pacing — match narration rhythm
- Cinematic transitions — story continuity
- Atmospheric movement — mood, setting`,

      educational: `EDUCATIONAL VIDEO MOTION:
- Step-by-step progression — clear, logical
- Visual hierarchy — guide attention
- Diagram animation — informational
- Smooth, easy to follow — no confusion
- Highlight key points — emphasis`,

      food: `FOOD VIDEO MOTION:
- Appetizing presentation — plating, reveal
- Steam/freshness effects — hot, fresh
- Ingredient movement — dynamic, appealing
- Warm, inviting motion — comfortable
- Texture exploration — crispy, smooth, juicy`,

      fitness: `FITNESS VIDEO MOTION:
- Dynamic action — energy, power
- Muscle movement — form, definition
- Motivational pacing — inspiring, energizing
- High energy cuts — intensity, drive
- Aspirational movement — goals, achievement`,

      tech: `TECHNOLOGY VIDEO MOTION:
- Holographic effects — futuristic, advanced
- Digital transitions — modern, clean
- Circuit animation — technical, precise
- Glitch effects — digital, contemporary
- Smooth, precise movement — high-tech`,

      entertainment: `ENTERTAINMENT VIDEO MOTION:
- Dynamic, exciting — engaging, fun
- Quick cuts — pace, energy
- Character animation — personality, expression
- Visual spectacle — impressive, memorable
- Rhythmic movement — music-driven`,

      nature: `NATURE VIDEO MOTION:
- Organic flow — natural, authentic
- Wildlife movement — alive, real
- Landscape reveals — scope, beauty
- Seasonal changes — time, transformation
- Natural rhythms — breathing, flowing`,

      travel: `TRAVEL VIDEO MOTION:
- Location reveals — discovery, exploration
- Cultural movement — authentic, local
- Landscape pans — scope, beauty
- Street-level movement — immersive, real
- Architectural reveals — structure, design`,

      automotive: `AUTOMOTIVE VIDEO MOTION:
- Dynamic driving — speed, power
- Detail pans — design, craftsmanship
- Environmental context — road, landscape
- Motion blur — speed, excitement
- Studio orbits — premium, controlled`,

      fashion: `FASHION VIDEO MOTION:
- Fabric movement — flow, drape
- Model movement — pose, walk
- Editorial pacing — sophisticated, elegant
- Detail reveals — texture, design
- Environmental context — lifestyle, setting`,

      finance: `FINANCE VIDEO MOTION:
- Data visualization — charts, graphs
- Professional movement — trustworthy, reliable
- Clean transitions — precise, efficient
- Minimal motion — focus on information
- Corporate aesthetic — business, formal`,

      other: `GENERAL VIDEO MOTION:
- Match movement to content emotion
- Serve the story with camera
- Every scene has distinct motion
- Transitions feel motivated`,
    };

    return adaptations[contentType] || adaptations.other;
  }

  private talkingCharacter3D(): string {
    return `══════════════════════════════════════════════════════════════
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

→ The image composition is perfect — just make it breathe and come alive`;
  }

  private bodyScience(): string {
    return `══════════════════════════════════════════════════════════════
═══ VIDEO MOTION — BODY SCIENCE ═══

ANIMATION STYLE:
- Locked camera (same as talking-character-3d)
- Biological motion: flow, pulse, rhythm, transformation
- Environmental motion: particles, energy flow, cellular activity

MOTION VOCABULARY:
- Pulse — rhythmic beating (heart, vessels)
- Flow — directional movement (blood, nutrients, signals)
- Cascade — sequential activation (nervous system, immune response)
- Diffusion — spreading outward (oxygen, chemicals)
- Contraction — squeezing, compressing (muscles, organs)
- Expansion — swelling, inflating (lungs, cells)

TRANSFORMATION LANGUAGE:
- Regeneration — healing, rebuilding, restoring
- Purification — cleaning, filtering, detoxifying
- Synthesis — creating, building, producing
- Transport — moving, delivering, distributing
- Defense — protecting, attacking, neutralizing

RULES:
- Motion matches biological process being shown
- Organic, flowing movement (not mechanical)
- Color shifts indicate state changes
- No text, no labels — pure visual storytelling`;
  }

  private scriptToShorts(): string {
    return `══════════════════════════════════════════════════════════════
═══ CAMERA MOVEMENTS — SCRIPT TO SHORTS ═══

CAMERA MOVEMENT VOCABULARY:
- Slow push-in — dramatic emphasis, intimacy
- Pull-out — reveal, expand context
- Tracking shot — follow action laterally
- Crane up/down — vertical reveal, authority
- Rack focus — shift attention between subjects
- Pan left/right — horizontal scanning
- Tilt up/down — vertical scanning
- Handheld — organic, documentary energy
- Aerial view — god-like perspective, scale
- Overhead god's-eye — patterns, layout, overview

TRANSITION VOCABULARY:
- Match cut — visual continuity (shape, color, motion)
- Jump cut — temporal jump, energy, urgency
- Cross dissolve — soft temporal transition
- Whip pan — fast motion blur between scenes
- L-cut/J-cut — audio leads/trails visual
- Fade in/out — scene beginning/ending

TIMING:
- Slow motion — emphasis, beauty, detail
- Time-lapse — passage of time, transformation
- Speed ramp — accelerate/decelerate within shot
- Freeze frame — moment emphasis, title card

VARIETY RULE:
- VARY across scenes — don't repeat same shot type
- Match movement to content emotion
- Each scene has distinct camera behavior`;
  }
}

export const videoPromptQualitySkill = new VideoPromptQualitySkill();
