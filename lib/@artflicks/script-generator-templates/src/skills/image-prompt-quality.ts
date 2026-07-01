import { BaseSkill } from './base';
import { SkillContext } from './types';

export class ImagePromptQualitySkill extends BaseSkill {
  id = 'image-prompt-quality';
  name = 'Image Prompt Quality';
  version = '3.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.imagePromptVariant as string) || 'default';

    if (variant === 'talking-character-3d') {
      return this.talkingCharacter3D();
    }

    if (variant === 'skeleton-3d') {
      return this.skeleton3D();
    }

    return this.metadataDriven(context);
  }

  private metadataDriven(context: SkillContext): string {
    const intent = context.intent;
    const lightingStyle = intent?.lightingStyle || 'cinematic';
    const textureStyle = intent?.textureStyle || 'premium';
    const contentType = intent?.contentType || 'other';
    const mood = intent?.mood || 'cinematic';

    const lightingVocab = this.getLightingVocabulary(lightingStyle);
    const textureVocab = this.getTextureVocabulary(textureStyle);
    const moodAdaptation = this.getMoodAdaptation(mood);

    return `══════════════════════════════════════════════════════════════
═══ IMAGE PROMPT QUALITY — DYNAMIC ═══

LIGHTING STYLE: ${lightingStyle.toUpperCase()}

${lightingVocab}

TEXTURE STYLE: ${textureStyle.toUpperCase()}

${textureVocab}

${moodAdaptation}

COMPOSITION RULES:
- Scene 1 = most striking visual
- EVERY scene must look visually DIFFERENT (change angle, setting, lighting, or subject)
- The visual should match what's being narrated in that moment
- Strong color palette per scene — avoid washed out`;
  }

  private getLightingVocabulary(style: string): string {
    const vocabularies: Record<string, string> = {
      studio: `STUDIO LIGHTING VOCABULARY:
- Controlled studio lighting — precise, professional
- Rim light for subject separation — always include
- Soft fill light — dimension without harshness
- Key light from 45-degree angle — natural, flattering
- No harsh shadows — keep clean, readable
- Three-point lighting setup — key, fill, rim`,

      golden_hour: `GOLDEN HOUR LIGHTING VOCABULARY:
- Golden hour warmth — soft, directional, magical
- Magic hour tones — blue/purple transitional mood
- Warm color temperature — inviting, comfortable
- Long shadows — depth, dimension
- Soft diffused light — flattering, gentle
- Natural directional light — authentic, organic`,

      dramatic: `DRAMATIC LIGHTING VOCABULARY:
- Rembrandt lighting — dramatic side light, triangle on cheek
- Split lighting — half-face, mystery, drama
- High contrast — bold, impactful
- Deep shadows — mood, atmosphere
- Strong rim light — subject separation, halo
- Chiaroscuro — light/dark contrast, Renaissance feel`,

      soft: `SOFT LIGHTING VOCABULARY:
- Diffused soft light — gentle, flattering
- Overcast lighting — even, shadowless
- Butterfly lighting — glamorous, shadow under nose
- Loop lighting — soft shadow from nose to cheek
- Bounced light — indirect, natural
- Wrapping light — wraps around subject, dimensional`,

      high_key: `HIGH-KEY LIGHTING VOCABULARY:
- Bright, even lighting — cheerful, optimistic
- Minimal shadows — clean, airy
- White backgrounds — pure, minimalist
- Fill light dominant — soft, approachable
- Overexposed feel — dreamy, ethereal
- Commercial quality — polished, professional`,

      low_key: `LOW-KEY LIGHTING VOCABULARY:
- Dark, moody lighting — mysterious, dramatic
- Strong shadows — depth, atmosphere
- Single light source — focused, intense
- High contrast — bold, cinematic
- Silhouette potential — outline, mystery
- Noir aesthetic — dark, sophisticated`,

      neon: `NEON LIGHTING VOCABULARY:
- Neon glow — vibrant, electric
- Colorful rim light — RGB, dynamic
- Cyberpunk aesthetic — futuristic, urban
- Glowing highlights — neon signs, screens
- Color contrast — complementary neon colors
- Reflective surfaces — wet streets, glass`,

      natural: `NATURE LIGHTING VOCABULARY:
- Natural daylight — authentic, organic
- Sunlight through windows — warm, inviting
- Dappled light — through leaves, pattern
- Cloudy soft light — even, gentle
- Directional sun — strong shadows, warmth
- Blue sky reflected — cool, open`,

      clinical: `CLINICAL LIGHTING VOCABULARY:
- Clean, white lighting — sterile, precise
- Even illumination — no shadows, clear
- Cool color temperature — medical, scientific
- High CRI — accurate color representation
- Shadowless — flat, diagrammatic
- Laboratory quality — precise, controlled`,

      cinematic: `CINEMATIC LIGHTING VOCABULARY:
- Cinematic three-point — key, fill, rim
- motivated lighting — source justified
- Atmosphere through light — mood, depth
- Color grading feel — warm/cool tones
- Volumetric light shafts — atmospheric depth
- God rays — divine, ethereal quality`,
    };

    return vocabularies[style] || vocabularies.cinematic;
  }

  private getTextureVocabulary(style: string): string {
    const vocabularies: Record<string, string> = {
      premium: `PREMIUM TEXTURE VOCABULARY:
- Physically based rendering (PBR) — realistic material response
- Micro-textures — surface detail visible at macro level
- Material accuracy — metal, glass, fabric, skin
- Reflection quality — accurate, realistic
- Surface imperfections — subtle, natural
- High dynamic range — full tonal range`,

      organic: `ORGANIC TEXTURE VOCABULARY:
- Subsurface scattering — organic translucency (skin, wax, leaves)
- Natural imperfections — pores, grain, veins
- Biological accuracy — cellular detail, tissue
- Organic materials — wood, stone, plant
- Wet/organic surfaces — moisture, life
- Texture variation — natural, not uniform`,

      technical: `TECHNICAL TEXTURE VOCABULARY:
- Circuit board details — precise, geometric
- Holographic effects — futuristic, iridescent
- Metallic surfaces — brushed, polished, chrome
- Glass and transparency — refraction, reflection
- Digital textures — pixels, screens, interfaces
- Clean geometry — sharp edges, precise angles`,

      minimalist: `MINIMALIST TEXTURE VOCABULARY:
- Clean surfaces — smooth, uncluttered
- Solid colors — flat, graphic
- Simple materials — matte, uniform
- Negative space — breathing room
- Essential elements only — no decoration
- Modern aesthetic — contemporary, fresh`,

      textured: `TEXTURED VOCABULARY:
- Rich surface detail — grain, weave, pattern
- Material depth — layers, dimension
- Weathered surfaces — aged, character
- Natural patterns — organic repetition
- Tactile quality — touchable, real
- Visual interest — detail rewards close looking`,

      smooth: `SMOOTH TEXTURE VOCABULARY:
- Polished surfaces — reflective, clean
- Soft gradients — gentle transitions
- Fluid forms — curves, flow
- Minimal texture — sleek, modern
- Glass-like quality — transparent, pure
- Refined materials — premium, finished`,

      rough: `ROUGH TEXTURE VOCABULARY:
- Textured surfaces — grain, uneven
- Weathered materials — aged, character
- Natural stone — organic, earthy
- Industrial surfaces — concrete, metal
- Tactile roughness — visual texture
- Authentic imperfections — real, not perfect`,

      glossy: `GLOSSY TEXTURE VOCABULARY:
- High gloss — reflective, mirror-like
- Wet surfaces — moisture, fresh
- Polished materials — refined, premium
- Specular highlights — bright reflections
- Glass and chrome — transparent, metallic
- Liquid surfaces — fluid, dynamic`,

      matte: `MATTE TEXTURE VOCABULARY:
- Matte finish — non-reflective, soft
- Paper and fabric — tactile, natural
- Diffuse surfaces — even, soft
- No reflections — pure color
- Soft touch quality — inviting, gentle
- Modern aesthetic — contemporary, clean`,

      holographic: `HOLOGRAPHIC TEXTURE VOCABULARY:
- Iridescence — rainbow shimmer (oil, soap bubbles, butterfly wings)
- Holographic effects — shifting colors
- Anisotropy — directional reflection (brushed metal, silk)
- Color shifting — angle-dependent colors
- Futuristic materials — sci-fi, advanced
- Light manipulation — prismatic, spectral`,
    };

    return vocabularies[style] || vocabularies.premium;
  }

  private getMoodAdaptation(mood: string): string {
    const adaptations: Record<string, string> = {
      premium: `PREMIUM MOOD:
- Clean, refined composition
- Luxury feel, high quality
- Minimalist background
- Focus on detail and craftsmanship`,

      dramatic: `DRAMATIC MOOD:
- High contrast lighting
- Strong shadows and highlights
- Emotional emphasis
- Cinematic atmosphere`,

      educational: `EDUCATIONAL MOOD:
- Clear visual hierarchy
- Information density
- Step-by-step progression
- Visual clarity over aesthetics`,

      energetic: `ENERGETIC MOOD:
- Dynamic composition
- Vibrant colors
- Movement and action
- Exciting, engaging`,

      serene: `SERENE MOOD:
- Soft, gentle lighting
- Calm colors (blues, greens)
- Peaceful composition
- Balanced, harmonious`,

      mysterious: `MYSTERIOUS MOOD:
- Low-key lighting
- Deep shadows
- Atmospheric fog/mist
- Intriguing, enigmatic`,

      playful: `PLAYFUL MOOD:
- Bright, cheerful colors
- Dynamic angles
- Fun composition
- Lighthearted, engaging`,

      epic: `EPIC MOOD:
- Grand scale
- Dramatic lighting
- Cinematic scope
- Impressive, awe-inspiring`,

      intimate: `INTIMATE MOOD:
- Close-up framing
- Warm lighting
- Personal connection
- Emotional depth`,

      cinematic: `CINEMATIC MOOD:
- Film-quality composition
- Dramatic lighting
- Professional color grading
- Story-driven visuals`,
    };

    return adaptations[mood] || adaptations.cinematic;
  }

  private talkingCharacter3D(): string {
    return `══════════════════════════════════════════════════════════════
STEP 4 — IMAGE PROMPT ENGINE
═══════════════════════════════════════════════════════════════

STRICT FORMAT:

Hyper-detailed cinematic 3D render, Pixar-quality realism, ultra high detail of [SUBJECT WITH MICRO TEXTURE], [ENVIRONMENT — INTERNAL biological OR EXTERNAL real-world based on routing], showing [PRIMARY ACTION — object interaction for external scenes OR crew interaction for internal biological scenes], soft key light, rim light for separation, soft shadows, volumetric light shafts, shallow depth of field with medium cinematic lens, global illumination, physically based rendering (PBR), subsurface scattering (for organic scenes), high dynamic range, 9:16 vertical, no text, no watermark

LIGHTING RULES:
- Soft key light from 45-degree angle (natural, flattering)
- Rim light for subject separation (always include)
- Volumetric light shafts for atmospheric depth
- Subsurface scattering for organic materials (skin, food, biological)
- Global illumination for realistic bounce light

TEXTURE RULES:
- Physically based rendering (PBR) for material accuracy
- Micro-textures on surfaces (pores, grain, imperfections)
- Material-appropriate reflection (matte vs glossy vs metallic)
- High dynamic range for full tonal range

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

Example: "miniature broccoli florets cleaning debris" / "tiny yogurt droplets repairing cell walls"`;
  }

  private skeleton3D(): string {
    return `══════════════════════════════════════════════════════════════
═══ VISUAL RULES ═══

LIGHTING:
- Rembrandt lighting for dramatic character shots
- Golden hour warm tones for emotional beats
- Cool blue for mysterious/somber moments
- Rim lighting for skeleton silhouette separation

TEXTURE:
- Bone texture: realistic grain, slight imperfections
- Clothing/fabric: appropriate material feel
- Environmental textures: dusty, aged, atmospheric
- PBR materials for physical accuracy

STRUCTURE:
- 4-PART image prompt structure: CHARACTER DNA + CONSISTENCY LINE + ACTION + SCENE
- ACTION = THE FOCUS — detailed character action + facing direction
- SCENE = "background:" prefix — setting only
- ❌ NEVER describe character appearance in ACTION/SCENE — DNA handles that`;
  }
}

export const imagePromptQualitySkill = new ImagePromptQualitySkill();
