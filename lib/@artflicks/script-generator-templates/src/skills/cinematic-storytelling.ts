import { BaseSkill } from './base';
import { SkillContext } from './types';

export class CinematicStorytellingSkill extends BaseSkill {
  id = 'cinematic-storytelling';
  name = 'Cinematic Storytelling';
  version = '1.0.0';

  render(context: SkillContext): string {
    const storyStyle = (context.flags?.storyStyle as string) || 'default';

    const examples = this.getExamples(storyStyle);
    const storyArc = this.getStoryArc(storyStyle, context);

    return `═══════════════════════════════════════════════════════════════
    🎬 THIS IS NOT A SLIDESHOW — IT'S A CINEMATIC STORY
═══════════════════════════════════════════════════════════════
The narration must flow as ONE continuous story. When you read
ALL scenes aloud back-to-back, it should sound like a single
seamless voiceover — like a documentary narrator telling a gripping
story while the camera keeps cutting to new visuals.

${examples}

KEY PRINCIPLES:
1. The narration across all scenes reads as ONE flowing monologue
2. Scene breaks are for VISUAL changes — the story never stops
3. Each scene's narration connects naturally to the next
4. Each scene MUST contain at least one complete sentence
5. Build tension ACROSS scenes through the narrative, not by breaking sentences

═══════════════════════════════════════════════════════════════
                    STORY ARC
═══════════════════════════════════════════════════════════════
${storyArc}`;
  }

  private getExamples(storyStyle: string): string {
    switch (storyStyle) {
      case 'character-driven':
        return `SLIDESHOW (❌ WRONG):
  Scene 1: "The hero was born in a small village."
  Scene 2: "He had a difficult childhood."
  Scene 3: "He found a sword."
  → Disconnected facts. No momentum. Boring.

CINEMATIC (✅ RIGHT):
  Scene 1: "No one expected the boy from the village to become a warrior."
  Scene 2: "He spent his nights training under the silver moon."
  Scene 3: "The day he pulled the blade from the stone, the earth trembled."
  Scene 4: "Everything changed in that single, silent moment."
  → One flowing story. Each cut = new visual. Voice never stops.`;

      case 'fast-paced':
        return `SLIDESHOW (❌ WRONG — disconnected, choppy, boring):
  Scene 1: "Grace O'Malley was an Irish pirate queen."
  Scene 2: "She was also known as Granuaile."
  Scene 3: "She gave birth on a ship."
  Scene 4: "A Turkish ship attacked."
  → Each scene is an isolated fact. No flow. No grip. Viewer scrolls away.

CINEMATIC (✅ RIGHT — flowing, gripping, one continuous story):
  Scene 1: "In 1593, a sixty-year-old pirate walked into the English court."
  Scene 2: "She looked Queen Elizabeth dead in the eye."
  Scene 3: "Her name was Grace O'Malley."
  Scene 4: "She was known as the sea queen of Ireland."
  Scene 5: "She had come to negotiate the release of her sons."
  Scene 6: "Neither spoke the other's language."
  Scene 7: "So they spoke in Latin."
  Scene 8: "And Elizabeth, for the first time, listened."
  → One flowing story. Each scene CUTS to a new visual. The voice NEVER pauses.
  → The viewer is hooked because the story pulls them forward across every cut.`;

      case 'skeleton-narrator':
        return `SLIDESHOW (❌ WRONG):
  Scene 1: "Your liver filters toxins."
  Scene 2: "It processes nutrients."
  Scene 3: "It produces bile."
  → Disconnected facts. No momentum. Boring.

CINEMATIC (✅ RIGHT):
  Scene 1: "Right now, your liver is filtering 1.4 liters of blood every minute."
  Scene 2: "But when you drink alcohol, it drops everything else."
  Scene 3: "Fat starts building up. Cells start dying."
  Scene 4: "And your liver forgets how to heal itself."
  → One flowing story. Each cut = new visual. Voice never stops.`;

      default:
        return `SLIDESHOW (❌ WRONG — disconnected, choppy, boring):
  Scene 1: "Grace O'Malley was an Irish pirate queen."
  Scene 2: "She was also known as Granuaile."
  Scene 3: "She gave birth on a ship."
  Scene 4: "A Turkish ship attacked."
  → Each scene is an isolated fact. No flow. No grip. Viewer scrolls away.

CINEMATIC (✅ RIGHT — flowing, gripping, one continuous story):
  Scene 1: "In 1593, a sixty-year-old pirate walked into the English court."
  Scene 2: "She looked Queen Elizabeth dead in the eye."
  Scene 3: "Her name was Grace O'Malley."
  Scene 4: "She was known as the sea queen of Ireland."
  Scene 5: "She had come to negotiate the release of her sons."
  Scene 6: "Neither spoke the other's language."
  Scene 7: "So they spoke in Latin."
  Scene 8: "And Elizabeth, for the first time, listened."
  → One flowing story. Each scene CUTS to a new visual. The voice NEVER pauses.
  → The viewer is hooked because the story pulls them forward across every cut.`;
    }
  }

  private getStoryArc(storyStyle: string, context: SkillContext): string {
    const { scenePlan } = context;

    if (storyStyle === 'character-driven') {
      return `SCENE 1 — HOOK (${scenePlan.perSceneDurationMin}–${scenePlan.perSceneDurationTarget}s)
Character in a compelling moment. Instant intrigue.

MIDDLE — RAPID CINEMATIC BUILD
- One complete sentence per scene
- Character at center of every visual
- Rising stakes, emotional shifts

FINAL — PAYOFF
- Resolve the character's journey
- Emotional closure, complete sentence`;
    }

    if (storyStyle === 'skeleton-narrator') {
      return `SCENE 1 — THE HOOK
Establish STAKES immediately + one SENSORY DETAIL + unresolved thread.

MIDDLE — ESCALATION ENGINE
Each scene raises stakes higher — never plateau.

SECOND-TO-LAST — POINT OF NO RETURN
Maximum tension. End on an open beat.

FINAL — THE ECHO
Close all loops. End on one HAUNTING line. Never summarize.`;
    }

    return `SCENE 1 — HOOK (${scenePlan.perSceneDurationMin}–${scenePlan.perSceneDurationTarget}s)
One jaw-dropping opening line. Curiosity, conflict, or bold claim.

MIDDLE — RAPID CINEMATIC BUILD
- One complete sentence per scene
- Rising stakes with every visual change
- Tension loops: questions opened, answered scenes later
- Emotional shifts scene-to-scene

FINAL SCENE — PAYOFF
- Resolve the story, emotional closure
- Complete sentence — not cut off
- Viewer should feel satisfied`;
  }
}

export const cinematicStorytellingSkill = new CinematicStorytellingSkill();
