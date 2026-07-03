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
- Use the EXACT vocabulary from the style above in ALL imagePrompt AND videoPrompt fields
- Match the aesthetic described above in both static visuals AND motion/animation
- Use the textures, colors, and shading described above in imagePrompt
- Use the motion style, camera behavior, and transition feel described above in videoPrompt
- Follow the mood and atmosphere described above in both prompts
- The style above is the PRIMARY visual directive — all visuals AND motion MUST match
- When describing subjects, append the style vocabulary to maintain consistency
- The style vocabulary should appear at the END of imagePrompt fields (after subject description)
- The style vocabulary should influence the MOTION DESCRIPTION in videoPrompt fields

STYLE INTEGRATION EXAMPLES:
✅ imagePrompt: "Banana character in a kitchen, 2D cartoon style, flat colors, thick outlines"
✅ videoPrompt: "Banana character waves arms enthusiastically, bouncy cartoon motion, flat color animation style"
❌ imagePrompt: "Banana character in a kitchen" (missing style vocabulary)
❌ videoPrompt: "Slow push-in, rack focus, cross dissolve" (generic cinematic motion, ignores style)
❌ "2D cartoon style, flat colors, banana character in a kitchen" (style at start, not end)

═══════════════════════════════════════════════════════════════════════════════════════
`;
  }
}
