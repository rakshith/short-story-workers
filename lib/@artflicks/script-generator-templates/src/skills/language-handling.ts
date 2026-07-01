import { BaseSkill } from './base';
import { SkillContext } from './types';

export class LanguageHandlingSkill extends BaseSkill {
  id = 'language-handling';
  name = 'Language Handling';
  version = '1.0.0';

  render(context: SkillContext): string {
    const { language, languageName } = context;
    const variant = (context.flags?.languageVariant as string) || 'default';

    switch (variant) {
      case 'script-to-shorts':
        return this.scriptToShorts(language, languageName);
      default:
        return this.default(language, languageName);
    }
  }

  private default(language: string, languageName: string): string {
    return `LANGUAGE REQUIREMENT:
- All narration and details: ${languageName} (${language})
- imagePrompt: ALWAYS in English

TITLE: Short, punchy, 4–8 words max.`;
  }

  private scriptToShorts(language: string, languageName: string): string {
    return `══════════════════════════════════════════════════════════════
                    LANGUAGE
══════════════════════════════════════════════════════════════
Narration MUST be in: ${languageName} (${language})
- ALL narration text must be in ${languageName}
- If user provides narration in wrong language, TRANSLATE to ${languageName}
- Maintain exact meaning when translating - only change the language
- Character names and proper nouns can remain unchanged
- imagePrompt and videoPrompt are ALWAYS in English regardless of narration language`;
  }
}

export const languageHandlingSkill = new LanguageHandlingSkill();
