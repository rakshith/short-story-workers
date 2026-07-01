import { BaseSkill } from './base';
import { SkillContext } from './types';

export class StyleVocabularySkill extends BaseSkill {
  id = 'style-vocabulary';
  name = 'Style Vocabulary';
  description = 'Style-specific vocabulary injection from preset stylePrompt';
  version = '1.0.0';

  render(context: SkillContext): string {
    const stylePrompt = context.stylePrompt;

    if (!stylePrompt) {
      return '';
    }

    return `
═══════════════════════════════════════════════════════════════════════════════════════
VISUAL STYLE (MUST FOLLOW — HIGHEST PRIORITY)
═══════════════════════════════════════════════════════════════════════════════════════

STYLE VOCABULARY:
${stylePrompt}

STYLE RULES:
- Use the EXACT vocabulary from the style above in ALL imagePrompt fields
- Match the aesthetic described above
- Use the textures, colors, and shading described above
- Follow the mood and atmosphere described above
- The style above is the PRIMARY visual directive — all visuals MUST match
- When describing subjects, append the style vocabulary to maintain consistency
- The style vocabulary should appear at the END of imagePrompt fields (after subject description)

STYLE INTEGRATION EXAMPLES:
✅ "Banana character in a kitchen, 2D cartoon style, flat colors, thick outlines"
✅ "Bloodstream scene with red blood cells, medical illustration, clean lines, vibrant colors"
❌ "Banana character in a kitchen" (missing style vocabulary)
❌ "2D cartoon style, flat colors, banana character in a kitchen" (style at start, not end)

═══════════════════════════════════════════════════════════════════════════════════════
`;
  }
}
