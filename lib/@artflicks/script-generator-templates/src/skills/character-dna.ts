import { BaseSkill } from './base';
import { SkillContext } from './types';

export const SKELETON_CHARACTER_DNA = `CHARACTER DNA
transparent humanoid body shell
visible ivory skeleton
large round cartoon eyes
smooth skull shape
wide surprised expression`;

export const SKELETON_CONSISTENCY_LINE = 'same character as the reference image, same skull shape, same eyes, same proportions';

export const BODY_SCIENCE_CHARACTER_DNA = `3D rendered skeleton with translucent glassy skin overlay
large expressive cartoon eyes (primary emotion source)
realistic bone texture with visible teeth details
metallic braces with reflective surfaces (when relevant)
uncanny valley aesthetic — slightly creepy but charming
no facial muscle movement (emotion only through eyes)`;

export const BODY_SCIENCE_CONSISTENCY_LINE =
  'same character as the reference image, same skull shape, same eyes, same proportions, translucent glassy skin overlay with visible skeleton underneath';

export class CharacterDnaSkill extends BaseSkill {
  id = 'character-dna';
  name = 'Character DNA';
  version = '1.0.0';

  render(context: SkillContext): string {
    const characterType = (context.flags?.characterType as string) || 'default';
    const hasCharacterImages = context.hasCharacterImages;

    switch (characterType) {
      case 'skeleton':
        return this.skeleton(hasCharacterImages);
      case 'body-science-skeleton':
        return this.bodyScienceSkeleton(hasCharacterImages);
      case 'character-story':
        return this.characterStory(hasCharacterImages, context);
      default:
        return '';
    }
  }

  private skeleton(hasCharacterImages: boolean): string {
    return `══════════════════════════════════════════════════════════════
═══ CHARACTER ═══

${SKELETON_CHARACTER_DNA}

${SKELETON_CONSISTENCY_LINE}

MAIN CHARACTER: 💀 SKELETON (protagonist in every scene)
SUPPORTING CAST: Normal humans — regular people, villagers, crowds

${hasCharacterImages ? `═══ REFERENCE IMAGE = "YOU" ═══
The skeleton in the reference image IS YOU. Narration uses "you/your" — first-person.
` : ''}`;
  }

  private bodyScienceSkeleton(hasCharacterImages: boolean): string {
    return `${hasCharacterImages ? `
CHARACTER REFERENCE:
The skeleton in the reference image IS the viewer going through this experiment.
Narration MUST use "you/your" — the audience experiences this as their own body.
` : ''}`;
  }

  private characterStory(hasCharacterImages: boolean, context: SkillContext): string {
    return `══════════════════════════════════════════════════════════════
                    CHARACTER SYSTEM
═══════════════════════════════════════════════════════════════
${
  hasCharacterImages
    ? `✅ CHARACTER REFERENCE IMAGES PROVIDED (${context.characterReferenceImages?.length ?? 0})

The image AI will use these for visual consistency.

imagePrompt RULES:
1. ❌ DO NOT describe physical appearance (face, hair, body, clothes)
2. ✅ DO describe: action/pose, emotion, position, environment interaction
3. ✅ Refer to them as "The character in the reference image"
4. ✅ Character MUST appear in EVERY imagePrompt`
    : `⚠️ NO CHARACTER REFERENCE

Define clear physical traits in Scene 1 and repeat EXACTLY in every imagePrompt.
Example: "A young woman with short silver hair and a red scarf, standing in the rain..."`
}`;
  }
}

export const characterDnaSkill = new CharacterDnaSkill();
