import { BaseSkill } from './base';
import { SkillContext } from './types';

export class CameraFramingSkill extends BaseSkill {
  id = 'camera-framing';
  name = 'Camera Framing';
  version = '3.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.cameraVariant as string) || 'default';

    if (variant === 'skeleton-3d') {
      return this.skeleton3D();
    }

    if (variant === 'body-science') {
      return this.bodyScience();
    }

    return this.metadataDriven(context);
  }

  private metadataDriven(context: SkillContext): string {
    const intent = context.intent;
    const cameraStyle = intent?.cameraStyle || 'dynamic';
    const contentType = intent?.contentType || 'other';

    const cameraVocab = this.getCameraVocabulary(cameraStyle);
    const contentAdaptation = this.getContentAdaptation(contentType);

    return `══════════════════════════════════════════════════════════════
═══ CAMERA & LENS — DYNAMIC ═══

CAMERA STYLE: ${cameraStyle.toUpperCase()}

${cameraVocab}

${contentAdaptation}

ASPECT RATIO:
- 9:16 — mobile vertical (Shorts, Reels, TikTok)
- 16:9 — cinema widescreen, YouTube
- 1:1 — Instagram feed, social media
- 4:5 — Instagram portrait, editorial`;
  }

  private getCameraVocabulary(style: string): string {
    const vocabularies: Record<string, string> = {
      portrait: `PORTRAIT LENS VOCABULARY:
- 85mm portrait lens — flattering compression, shallow depth of field
- Close-up (CU) — face, product, subject isolation
- Medium close-up (MCU) — head + shoulders, character interaction
- Three-quarter angle — character depth, dimensional
- Soft bokeh background — subject separation
- Eye-level connection — intimacy, engagement`,

      macro: `MACRO LENS VOCABULARY:
- Macro lens — extreme close-up, surface detail, texture emphasis
- Extreme close-up (ECU) — eyes, details, texture, emotion
- Surface detail — material quality, imperfections, grain
- Shallow depth of field — selective focus, isolation
- Texture emphasis — micro-details, surface quality
- Material close-up — fabric weave, metal grain, organic texture`,

      wide: `WIDE LENS VOCABULARY:
- 35mm cinema lens — natural perspective, environmental context
- Wide establishing shot — environment, scale, atmosphere
- Medium shot (MS) — waist up, context + subject balance
- Environmental storytelling — subject in context
- Deep depth of field — everything in focus
- Natural perspective — human-eye equivalent`,

      aerial: `AERIAL VOCABULARY:
- Bird's eye view — god-like perspective, patterns, scale
- Overhead shot — layout, arrangement, overview
- Drone perspective — sweeping, cinematic scale
- High angle — vulnerability, overview, context
- Pattern recognition — repetitive elements, symmetry
- Scale emphasis — subject vs environment`,

      dynamic: `DYNAMIC CAMERA VOCABULARY:
- Dutch angle — tension, unease, dynamic energy
- Low angle — power, dominance, heroism
- Tilted framing — energy, movement, action
- Over-the-shoulder — conversation, perspective, intimacy
- Tracking shot — following action, movement
- Handheld feel — organic, documentary energy`,

      locked: `LOCKED CAMERA VOCABULARY:
- Fixed composition — stability, formality
- Symmetrical framing — balance, harmony
- Centered subject — focus, importance
- Minimal camera movement — stillness, contemplation
- Tripod-stable — professional, controlled
- Static framing — timeless, classic`,

      tracking: `TRACKING CAMERA VOCABULARY:
- Dolly shot — smooth forward/backward movement
- Tracking lateral — following subject sideways
- Steadicam — floating, smooth following
- Crane shot — vertical movement, reveal
- Slider — subtle horizontal movement
- Follow cam — subject-led movement`,

      handheld: `HANDHELD CAMERA VOCABULARY:
- Handheld feel — organic, documentary energy
- Slight shake — urgency, realism, immediacy
- Natural movement — human presence, authenticity
- Documentary style — raw, unpolished, real
- Intimate proximity — close, personal, immersive
- Reactive framing — following action naturally`,

      dutch: `DUTCH ANGLE VOCABULARY:
- Dutch angle — tension, unease, dynamic energy
- Tilted horizon — instability, excitement
- Diagonal composition — energy, movement
- Skewed perspective — drama, intensity
- Off-kilter framing — unease, anticipation
- Angled shots — dynamic, active`,

      overhead: `OVERHEAD VOCABULARY:
- Overhead god's-eye — patterns, layout, overview
- Top-down view — arrangement, organization
- Bird's eye — scale, context, environment
- Flat lay perspective — product, editorial
- Aerial perspective — sweeping, cinematic
- Pattern emphasis — symmetry, repetition`,
    };

    return vocabularies[style] || vocabularies.dynamic;
  }

  private getContentAdaptation(contentType: string): string {
    const adaptations: Record<string, string> = {
      product: `PRODUCT FRAMING:
- Hero shot — product centered, dramatic lighting
- Detail shot — texture, material, craftsmanship
- Environmental shot — product in context, lifestyle
- 360 orbit — product rotation, dimensionality
- Clean background — no distractions, product focus`,

      health: `HEALTH/BIOLOGY FRAMING:
- Macro for organ detail, cellular level
- Medium close-up for reactions, emotional beats
- X-ray view — semi-transparent, internal visibility
- Cross-section — layered anatomy, depth
- Dynamic angles — never flat, never boring`,

      story: `STORY FRAMING:
- Character at focal point — always clear subject
- Environmental context — world feels alive
- Emotional framing — tight for intimacy, wide for isolation
- Continuity — consistent character positioning
- Cinematic composition — film-quality framing`,

      educational: `EDUCATIONAL FRAMING:
- Clear focal point — information hierarchy
- Step-by-step flow — visual progression
- Diagram-quality clarity — readable, organized
- Information density — content-rich
- Visual organization — structured layout`,

      food: `FOOD FRAMING:
- Centered food focus — plating and arrangement
- Appetizing angles — 45-degree, overhead
- Detail shots — texture, freshness, steam
- Environmental context — table, setting
- Warm, inviting composition`,

      fitness: `FITNESS FRAMING:
- Dynamic angles — energy, movement
- Action-focused framing — motion, intensity
- Muscle definition — form, power
- Motivational composition — aspirational
- Energy and movement — active, dynamic`,

      tech: `TECHNOLOGY FRAMING:
- Clean, minimal — modern aesthetic
- Product focus — technology highlight
- Holographic elements — futuristic feel
- Circuit/board details — technical accuracy
- Futuristic composition — innovative, advanced`,

      entertainment: `ENTERTAINMENT FRAMING:
- Dynamic, energetic — exciting, engaging
- Character-focused — personality, expression
- Atmospheric — mood, setting
- Cinematic quality — film-like composition
- Visual spectacle — impressive, memorable`,

      nature: `NATURE FRAMING:
- Landscape context — environment, scale
- Wildlife close-up — detail, intimacy
- Macro for flora — texture, color
- Aerial for scope — sweeping, grand
- Natural composition — organic, flowing`,

      travel: `TRAVEL FRAMING:
- Establishing shots — location, context
- Cultural details — local flavor, authenticity
- Landscape wide — scenery, beauty
- Street-level — immersive, authentic
- Architectural — structure, design`,

      automotive: `AUTOMOTIVE FRAMING:
- Hero angle — 3/4 front, dramatic
- Detail shots — grille, wheels, interior
- Motion blur — speed, dynamic
- Environmental context — road, landscape
- Studio lighting — controlled, premium`,

      fashion: `FASHION FRAMING:
- Full-length — outfit, silhouette
- Detail shots — fabric, texture, accessories
- Editorial angles — artistic, dynamic
- Environmental context — lifestyle, setting
- Movement — fabric flow, dynamic poses`,

      finance: `FINANCE FRAMING:
- Clean, professional — trustworthy, reliable
- Data visualization — charts, graphs, numbers
- Corporate aesthetic — business, formal
- Minimalist — clear, focused
- Technology integration — digital, modern`,

      other: `GENERAL FRAMING:
- Match framing to content emotion
- Use appropriate lens for subject
- Consider environmental context
- Balance subject and environment
- Professional composition`,
    };

    return adaptations[contentType] || adaptations.other;
  }

  private skeleton3D(): string {
    return `══════════════════════════════════════════════════════════════
═══ CAMERA FRAMING — SKELETON ═══

❌ FORBIDDEN: front-facing portrait shots. Max 1 centered close-up per script.
✅ Vary orientation EVERY scene.

LENS SELECTION:
- 85mm for dramatic character close-ups
- 35mm for environmental storytelling
- Macro for bone texture, eye detail

SHOT VARIETY (rotate across scenes):
- Profile shot — skeleton in silhouette, dramatic lighting
- Three-quarter angle — character depth, dimensional
- Low angle — skeleton towering, imposing presence
- Over-the-shoulder — skeleton observing human world
- Extreme close-up — eye emotion, bone texture detail

COMPOSITION:
- Dynamic angles, never static
- Strong diagonal lines for energy
- Negative space for haunting atmosphere
- 9:16 vertical, cinematic framing`;
  }

  private bodyScience(): string {
    return `══════════════════════════════════════════════════════════════
═══ CAMERA AND COMPOSITION — BODY SCIENCE ═══

LENS SELECTION:
- Macro lens — organ detail, cellular level, texture emphasis
- 85mm — character reactions, emotional beats
- Wide lens — anatomical overview, spatial context

SHOT TYPES FOR BIOLOGY:
- Extreme close-up — cellular activity, molecular interaction
- Medium close-up — organ systems, anatomical relationships
- X-ray view — semi-transparent rib cage, internal visibility
- Cross-section — layered anatomy, depth visualization

COMPOSITION RULES:
- Extreme close-ups for intense biological moments
- Medium close-up for reactions (head + upper torso)
- Dynamic angles — never flat, never boring
- Depth layering — foreground organ + mid-ground system + background context
- 9:16 vertical aspect ratio (mobile optimized)

ANATOMICAL FRAMING:
- Heart: left chest cavity, slightly tilted angle
- Lungs: symmetrical framing, rib cage visible
- Brain: skull-level close-up, neural pathways visible
- Digestive: top-down flow, intestinal curves`;
  }
}

export const cameraFramingSkill = new CameraFramingSkill();
