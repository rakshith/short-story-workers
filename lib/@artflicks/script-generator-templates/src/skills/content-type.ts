import { BaseSkill } from './base';
import { SkillContext } from './types';

export class ContentTypeSkill extends BaseSkill {
  id = 'content-type';
  name = 'Content Type';
  version = '1.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.contentTypeVariant as string) || 'default';

    switch (variant) {
      case 'product':
        return this.product();
      case 'health':
        return this.health();
      case 'story':
        return this.story();
      case 'educational':
        return this.educational();
      case 'food':
        return this.food();
      case 'fitness':
        return this.fitness();
      case 'tech':
        return this.tech();
      default:
        return this.default();
    }
  }

  private default(): string {
    return `══════════════════════════════════════════════════════════════
═══ CONTENT-AWARE VISUAL LANGUAGE ═══

Adapt visual vocabulary based on content category:

PRODUCT/COMMERCIAL:
- Premium materials, luxury feel
- Clean backgrounds, product focus
- Reflections, surface quality
- Environmental context (lifestyle)

HEALTH/BIOLOGY:
- Organic textures, biological accuracy
- Translucent materials, subsurface scattering
- Cellular/molecular level detail
- Transformation sequences

STORY/NARRATIVE:
- Character consistency, emotional depth
- Environmental storytelling
- Atmospheric mood, lighting continuity
- Cinematic composition

EDUCATIONAL:
- Clear visual hierarchy
- Information density
- Step-by-step progression
- Visual clarity over aesthetics

FOOD/BEVERAGE:
- Appetizing presentation
- Fresh ingredients, textures
- Warm, inviting lighting
- Plating and presentation

FITNESS/SPORTS:
- Dynamic action, energy
- Muscle definition, form
- Motion blur, intensity
- Motivational atmosphere

TECHNOLOGY:
- Clean, modern aesthetic
- Holographic elements
- Circuit/board textures
- Futuristic lighting`;
  }

  private product(): string {
    return `══════════════════════════════════════════════════════════════
═══ PRODUCT / COMMERCIAL CONTENT ═══

VISUAL VOCABULARY:
- Premium materials, luxury feel
- Clean backgrounds, product focus
- Reflections, surface quality
- Environmental context (lifestyle)

LIGHTING:
- Studio lighting, controlled
- Rim light for product separation
- Soft fill for dimension
- No harsh shadows

TEXTURE:
- Material accuracy (metal, glass, fabric)
- Surface quality (smooth, textured, matte)
- Micro-details (grain, finish, imperfections)
- PBR materials for physical accuracy

COMPOSITION:
- Centered product focus
- Rule of thirds for editorial
- Negative space for premium feel
- Clean background, no distractions

MOOD:
- Premium, high-quality
- Trustworthy, reliable
- Aspirational, desirable
- Professional, polished`;
  }

  private health(): string {
    return `══════════════════════════════════════════════════════════════
═══ HEALTH / BIOLOGY CONTENT ═══

VISUAL VOCABULARY:
- Organic textures, biological accuracy
- Translucent materials, subsurface scattering
- Cellular/molecular level detail
- Transformation sequences

LIGHTING:
- Warm, organic tones
- Soft, diffused light
- Rim light for organic separation
- Volumetric light for depth

TEXTURE:
- Subsurface scattering (skin, tissue)
- Organic imperfections (realism)
- Cellular detail (micro level)
- Material accuracy (bone, tissue, fluid)

COMPOSITION:
- Close-up for detail
- Medium for context
- Cross-section for anatomy
- Dynamic angles for interest

MOOD:
- Educational, informative
- Fascinating, engaging
- Natural, organic
- Scientific, accurate`;
  }

  private story(): string {
    return `══════════════════════════════════════════════════════════════
═══ STORY / NARRATIVE CONTENT ═══

VISUAL VOCABULARY:
- Character consistency, emotional depth
- Environmental storytelling
- Atmospheric mood, lighting continuity
- Cinematic composition

LIGHTING:
- Mood-appropriate (warm for comfort, cool for mystery)
- Continuity across scenes
- Emotional emphasis
- Atmospheric depth

TEXTURE:
- Character-appropriate detail
- Environmental authenticity
- Material consistency
- Atmospheric effects

COMPOSITION:
- Character at focal point
- Environmental context
- Emotional framing
- Story continuity

MOOD:
- Emotionally resonant
- Atmospherically rich
- Cinematic quality
- Story-driven`;
  }

  private educational(): string {
    return `══════════════════════════════════════════════════════════════
═══ EDUCATIONAL CONTENT ═══

VISUAL VOCABULARY:
- Clear visual hierarchy
- Information density
- Step-by-step progression
- Visual clarity over aesthetics

LIGHTING:
- Even, consistent lighting
- No dramatic shadows
- Clear visibility
- Functional over artistic

TEXTURE:
- Clear, readable details
- Information-focused
- Diagram-quality clarity
- Simplified for understanding

COMPOSITION:
- Clear focal point
- Information hierarchy
- Step-by-step flow
- Visual organization

MOOD:
- Clear, informative
- Professional, trustworthy
- Easy to understand
- Engaging but not distracting`;
  }

  private food(): string {
    return `══════════════════════════════════════════════════════════════
═══ FOOD / BEVERAGE CONTENT ═══

VISUAL VOCABULARY:
- Appetizing presentation
- Fresh ingredients, textures
- Warm, inviting lighting
- Plating and presentation

LIGHTING:
- Warm, golden tones
- Soft, diffused light
- Appetizing glow
- Natural, inviting

TEXTURE:
- Freshness indicators
- Material accuracy (food, drink)
- Surface quality (crispy, smooth, juicy)
- Micro-details (droplets, crumbs, steam)

COMPOSITION:
- Centered food focus
- Plating and arrangement
- Environmental context (table, setting)
- Appetizing angles

MOOD:
- Appetizing, delicious
- Fresh, inviting
- Warm, comforting
- Premium, quality`;
  }

  private fitness(): string {
    return `══════════════════════════════════════════════════════════════
═══ FITNESS / SPORTS CONTENT ═══

VISUAL VOCABULARY:
- Dynamic action, energy
- Muscle definition, form
- Motion blur, intensity
- Motivational atmosphere

LIGHTING:
- Dramatic, high-contrast
- Rim light for muscle definition
- Dynamic lighting for action
- Motivational atmosphere

TEXTURE:
- Muscle definition detail
- Sweat, intensity indicators
- Material accuracy (gear, equipment)
- Dynamic effects (motion blur)

COMPOSITION:
- Dynamic angles
- Action-focused framing
- Energy and movement
- Motivational context

MOOD:
- Energizing, motivational
- Powerful, intense
- Dynamic, active
- Inspiring, aspirational`;
  }

  private tech(): string {
    return `══════════════════════════════════════════════════════════════
═══ TECHNOLOGY CONTENT ═══

VISUAL VOCABULARY:
- Clean, modern aesthetic
- Holographic elements
- Circuit/board textures
- Futuristic lighting

LIGHTING:
- Cool, blue tones
- Neon accents
- Futuristic glow
- Clean, precise

TEXTURE:
- Circuit board details
- Holographic effects
- Material accuracy (metal, glass, plastic)
- Micro-details (components, connections)

COMPOSITION:
- Clean, minimal
- Technology focus
- Futuristic framing
- Modern aesthetic

MOOD:
- Futuristic, innovative
- Clean, precise
- Advanced, sophisticated
- High-tech, modern`;
  }
}

export const contentTypeSkill = new ContentTypeSkill();
