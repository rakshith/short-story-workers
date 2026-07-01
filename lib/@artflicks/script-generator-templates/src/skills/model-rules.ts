import { BaseSkill } from './base';
import { SkillContext } from './types';

export class ModelRulesSkill extends BaseSkill {
  id = 'model-rules';
  name = 'Model Rules';
  version = '1.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.modelVariant as string) || 'default';

    switch (variant) {
      case 'flux':
        return this.flux();
      case 'midjourney':
        return this.midjourney();
      case 'kling':
        return this.kling();
      case 'seedance':
        return this.seedance();
      case 'veo':
        return this.veo();
      case 'runway':
        return this.runway();
      default:
        return this.default();
    }
  }

  private default(): string {
    return `══════════════════════════════════════════════════════════════
═══ MODEL-SPECIFIC RULES ═══

Adapt your prompt structure based on the target generation model:

FLUX (Image Generation):
- Prefix: "photo of" or "cinematic 3D render of"
- Be specific about lighting, materials, composition
- Use natural language descriptions
- Include aspect ratio at end

MIDJOURNEY (Image Generation):
- Use "--ar 9:16" for vertical, "--ar 16:9" for widescreen
- Include style parameters: "--style raw" for photorealistic
- Use "--q 2" for quality boost
- Descriptive, poetic language works well

KLING (Video Generation):
- Focus on motion and action descriptions
- Specify camera movements explicitly
- Keep prompts concise but descriptive
- Include duration guidance

SEEDANCE (Video Generation):
- Emphasize visual storytelling
- Describe transformations and progressions
- Include mood and atmosphere
- Be specific about timing

VEO (Video Generation):
- Detailed scene descriptions
- Specify camera movements and angles
- Include lighting and atmosphere
- Describe character actions clearly

RUNWAY (Video Generation):
- Focus on cinematic quality
- Describe motion and transitions
- Include visual style guidance
- Be specific about framing`;
  }

  private flux(): string {
    return `══════════════════════════════════════════════════════════════
═══ FLUX IMAGE GENERATION RULES ═══

PROMPT STRUCTURE:
[Style prefix], [subject description], [lighting], [materials], [composition], [aspect ratio]

STYLE PREFIXES:
- "photo of" — photorealistic
- "cinematic 3D render of" — stylized 3D
- "digital painting of" — artistic
- "hyper-detailed render of" — technical

LIGHTING KEYWORDS:
- "dramatic Rembrandt lighting"
- "soft golden hour light"
- "volumetric god rays"
- "rim lighting for subject separation"

MATERIAL KEYWORDS:
- "subsurface scattering"
- "physically based rendering (PBR)"
- "micro-textures"
- "high dynamic range"

COMPOSITION:
- "shallow depth of field"
- "rule of thirds composition"
- "negative space"
- "leading lines"

FORMAT:
- Natural language, comma-separated
- Be specific but not verbose
- Include aspect ratio at end: "--ar 9:16"

EXAMPLE:
"cinematic 3D render of a weathered wooden sailing ship cutting through stormy dark waves, dramatic rim lighting highlighting the sail edges, realistic wood grain texture with PBR materials, shallow depth of field with focus on the ship, dynamic diagonal composition, --ar 9:16"`;
  }

  private midjourney(): string {
    return `══════════════════════════════════════════════════════════════
═══ MIDJOURNEY IMAGE GENERATION RULES ═══

PROMPT STRUCTURE:
[Description], [style], [parameters]

STYLE PARAMETERS:
- "--style raw" — photorealistic, less artistic interpretation
- "--style scenic" — landscape, environment focus
- "--style expressive" — artistic, emotional

QUALITY PARAMETERS:
- "--q 2" — quality boost (use for final outputs)
- "--q 1" — standard quality (faster iteration)

ASPECT RATIO:
- "--ar 9:16" — mobile vertical (Shorts, Reels, TikTok)
- "--ar 16:9" — cinema widescreen, YouTube
- "--ar 1:1" — Instagram feed
- "--ar 4:5" — Instagram portrait

LIGHTING KEYWORDS:
- "dramatic cinematic lighting"
- "soft diffused light"
- "golden hour warm tones"
- "rim lighting"
- "volumetric light shafts"

MOOD KEYWORDS:
- "ethereal atmosphere"
- "moody dramatic tone"
- "vibrant energetic feel"
- "serene peaceful ambiance"

FORMAT:
- Poetic, descriptive language works well
- Midjourney interprets artistic intent
- Use commas to separate concepts
- Parameters at end

EXAMPLE:
"dramatic cinematic 3D render of a weathered wooden sailing ship cutting through stormy dark waves, dramatic rim lighting highlighting the sail edges, realistic wood grain texture with PBR materials, shallow depth of field with focus on the ship, dynamic diagonal composition --ar 9:16 --style raw --q 2"`;
  }

  private kling(): string {
    return `══════════════════════════════════════════════════════════════
═══ KLING VIDEO GENERATION RULES ═══

PROMPT STRUCTURE:
[Subject], [action/motion], [camera], [atmosphere], [duration]

MOTION KEYWORDS:
- "smooth camera movement"
- "dynamic action sequence"
- "subtle character animation"
- "environmental motion"

CAMERA KEYWORDS:
- "locked camera"
- "slow push-in"
- "tracking shot following"
- "crane up revealing"
- "handheld documentary style"

ATMOSPHERE:
- "dramatic lighting"
- "moody atmosphere"
- "vibrant colors"
- "cinematic quality"

DURATION GUIDANCE:
- "5 second clip"
- "10 second sequence"
- "15 second scene"

RULES:
- Be specific about motion and action
- Describe what changes over time
- Include camera movement explicitly
- Keep concise but descriptive

EXAMPLE:
"Weathered wooden sailing ship cutting through stormy dark waves, dramatic rim lighting highlighting the sail edges, slow push-in camera movement, stormy atmospheric conditions, 5 second clip"`;
  }

  private seedance(): string {
    return `══════════════════════════════════════════════════════════════
═══ SEEDANCE VIDEO GENERATION RULES ═══

PROMPT STRUCTURE:
[Subject], [transformation/action], [visual style], [timing], [mood]

TRANSFORMATION KEYWORDS:
- "gradual transformation"
- "smooth progression"
- "dynamic change"
- "evolving visual"

VISUAL STYLE:
- "cinematic quality"
- "dramatic lighting"
- "vibrant colors"
- "atmospheric depth"

TIMING:
- "slow motion emphasis"
- "real-time action"
- "time-lapse progression"
- "speed ramp effect"

MOOD:
- "ethereal atmosphere"
- "dramatic tension"
- "serene peaceful"
- "energetic vibrant"

RULES:
- Emphasize visual storytelling
- Describe transformations and progressions
- Include mood and atmosphere
- Be specific about timing

EXAMPLE:
"Weathered wooden sailing ship cutting through stormy dark waves, dramatic rim lighting highlighting the sail edges, gradual transformation from calm to storm, cinematic quality with atmospheric depth, 5 second clip"`;
  }

  private veo(): string {
    return `══════════════════════════════════════════════════════════════
═══ VEO VIDEO GENERATION RULES ═══

PROMPT STRUCTURE:
[Scene description], [character action], [camera movement], [lighting], [atmosphere]

SCENE DESCRIPTION:
- Detailed environment setup
- Character positioning and context
- Visual style and quality

CHARACTER ACTION:
- Specific character movements
- Gesture and expression details
- Interaction with environment

CAMERA MOVEMENT:
- Explicit camera behaviors
- Framing and composition changes
- Timing of movements

LIGHTING:
- Key light positioning
- Atmosphere and mood
- Color temperature

ATMOSPHERE:
- Environmental effects
- Mood and tone
- Visual depth

RULES:
- Detailed scene descriptions
- Specify camera movements and angles
- Include lighting and atmosphere
- Describe character actions clearly

EXAMPLE:
"Weathered wooden sailing ship cutting through stormy dark waves, dramatic rim lighting highlighting the sail edges, slow push-in camera movement, stormy atmospheric conditions with dramatic lighting, 5 second clip"`;
  }

  private runway(): string {
    return `══════════════════════════════════════════════════════════════
═══ RUNWAY VIDEO GENERATION RULES ═══

PROMPT STRUCTURE:
[Subject], [cinematic quality], [motion], [visual style], [duration]

CINEMATIC QUALITY:
- "film-quality footage"
- "cinematic depth of field"
- "professional color grading"
- "high production value"

MOTION:
- "smooth camera movement"
- "dynamic action"
- "subtle character animation"
- "environmental motion"

VISUAL STYLE:
- "dramatic lighting"
- "atmospheric mood"
- "vibrant colors"
- "cinematic composition"

DURATION:
- "5 second clip"
- "10 second sequence"
- "15 second scene"

RULES:
- Focus on cinematic quality
- Describe motion and transitions
- Include visual style guidance
- Be specific about framing

EXAMPLE:
"Weathered wooden sailing ship cutting through stormy dark waves, dramatic rim lighting highlighting the sail edges, film-quality footage with cinematic depth of field, slow push-in camera movement, 5 second clip"`;
  }
}

export const modelRulesSkill = new ModelRulesSkill();
