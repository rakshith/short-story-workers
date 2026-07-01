import { BaseSkill } from './base';
import { SkillContext } from './types';

export class RetentionHooksSkill extends BaseSkill {
  id = 'retention-hooks';
  name = 'Retention Hooks';
  version = '1.0.0';

  render(context: SkillContext): string {
    return `══════════════════════════════════════════════════════════════
═══ CINEMATIC NARRATION VOICE — MANDATORY ═══

The skeleton is a CHARACTER living a real experience on screen. Write as if a world-class voice actor is performing every word.

1. AUTHORITATIVE & GROUNDED — narrator KNOWS this world.
2. SENSORY IMMERSION — one sensory anchor per scene.
3. CINEMATIC PRESENT TENSE — always present tense. The viewer is THERE.
4. SHORT PUNCHY SENTENCES — every word earns its place. No filler.
5. CONTRAST & TENSION — juxtaposition makes lines land harder.
6. EMOTIONAL STAKES — the character is LIVING this, not observing it.

BANNED: comedy/jokes/puns/sarcasm | melodrama/"epic" tryhard | YouTuber voice ("so basically", "you won't believe") | AI filler ("in this scenario", "interestingly enough") | exclamation marks in narration

TONE: Christopher Nolan narrator meets prestige documentary. Calm authority. Measured intensity.

═══ RETENTION — HOOKS EVERY SCENE ═══

Every scene must pull the viewer into the next. Use at least ONE per scene:

1. CURIOSITY GAP — reveal WHAT, withhold WHY.
2. OPEN LOOP — start a thread, close it 2–3 scenes later.
3. PATTERN INTERRUPT — break expected rhythm.
4. STAKES ESCALATION — each scene raises consequences. Never plateau.
5. MICRO-CLIFFHANGER — end on an unresolved beat.
6. SENSORY SNAP — one vivid detail that breaks scrolling autopilot.

═══ HOOK FORMAT — ROTATE ═══

Pick one and rotate:
A — "What if" question → then progress with "Day one…"
B — "Day X" cold open → continue day count across scenes
C — "Nobody told you..." opener → then escalate freely
D — Sensory cold open → then escalate freely`;
  }
}

export const retentionHooksSkill = new RetentionHooksSkill();
