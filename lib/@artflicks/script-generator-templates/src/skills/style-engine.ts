import { BaseSkill } from './base';
import { SkillContext } from './types';

export class StyleEngineSkill extends BaseSkill {
  id = 'style-engine';
  name = 'Style Engine';
  version = '1.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.styleVariant as string) || 'default';

    switch (variant) {
      case 'talking-character-3d':
        return this.talkingCharacter3D();
      case 'skeleton-3d':
        return this.skeleton3D();
      default:
        return '';
    }
  }

  private talkingCharacter3D(): string {
    return `═══════════════════════════════════════════════════════════════
STYLE ENGINE (AUTO + MANUAL)
═══════════════════════════════════════════════════════════════

If user specifies a style → use it
Else → auto-detect style

STYLES:
battle, cleaning, healing, energy, flow, sci-fi, horror, educational

---

AUTO-DETECTION:

detox / clean / fiber → cleaning
heal / probiotic / gut health → healing
energy / boost → energy
digestion / constipation → flow
immunity / fight / antioxidant → battle
harmful items (sugar, alcohol, junk food) → horror
default → cleaning

Priority:
horror > battle > healing > energy > flow > cleaning

---

STYLE EFFECT:

battle → attacking, destroying, fast, high contrast
cleaning → removing, dissolving, organized
healing → repairing, calming, soft glow
energy → boosting, activating, bright pulses
flow → smooth motion, wave-like
horror → spreading, damaging, dark tone
sci-fi → futuristic, neon, precise
educational → visual, illustrative, motion-based

---

CONSTRAINT:

Style MUST NOT break:
• before → action → after
• crew system
• biological realism

If conflict → fallback to cleaning
═══════════════════════════════════════════════════════════════

══════════════════════════════════════════════════════════════
STYLE EXECUTION (MANDATORY)
══════════════════════════════════════════════════════════════

The selected STYLE must explicitly influence:

1. imagePrompt:
- MUST use style-specific action verbs
- MUST reflect style motion and interaction tone
- MUST reflect style lighting mood

2. videoPrompt:
- MUST reflect motion type (aggressive / smooth / calm / chaotic)
- MUST reflect interaction behavior (attack / clean / repair / flow)

---

STYLE VERB ENFORCEMENT:

battle → attacking, destroying, breaking
cleaning → cleaning, removing, dissolving
healing → repairing, restoring, soothing
energy → boosting, activating, charging
flow → moving, pushing, smoothing
horror → spreading, damaging, corroding

→ At least ONE verb MUST match selected style

---

If style is not visible in actions → INVALID`;
  }

  private skeleton3D(): string {
    return `═══ STORY STYLE — PICK ONE & COMMIT ═══

Read the user premise. Pick the ONE style below that fits best. Follow EVERY bullet point as a STRUCTURAL REQUIREMENT:

1. day_in_life — timestamps, sensory detail each scene
2. imagine_if — state changed variable upfront, ripple effects
3. last_person — silence/isolation atmosphere, psychology evolving
4. wake_up_in — zero-warning drop into new world, arc: Confusion→Discovery→Adaptation
5. what_would_happen — real science only, cause-and-effect chains
6. choose_fate — decision points OPTION A vs B
7. stuck_in — trap feels inescapable early
8. i_survived — urgent present tense despite past events
9. history_changed — anchor to real event/figure, butterfly effect
10. experiment — rules stated upfront, staged
11. secret_world — clues before reveal
12. role_reversal — both roles clear before swap`;
  }
}

export const styleEngineSkill = new StyleEngineSkill();
