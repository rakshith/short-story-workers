import { BaseSkill } from './base';
import { SkillContext } from './types';

export class NarrationRulesSkill extends BaseSkill {
  id = 'narration-rules';
  name = 'Narration Rules';
  version = '1.0.0';

  render(context: SkillContext): string {
    const { scenePlan } = context;
    return `═══════════════════════════════════════════════════════════════
                    NARRATION RULES
═══════════════════════════════════════════════════════════════
${scenePlan.narrationGuidance}`;
  }
}

export const narrationRulesSkill = new NarrationRulesSkill();
