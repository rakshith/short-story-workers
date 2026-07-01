import { BaseSkill } from './base';
import { SkillContext } from './types';

export class CrewSystemSkill extends BaseSkill {
  id = 'crew-system';
  name = 'Crew System';
  version = '1.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.crewVariant as string) || 'default';

    switch (variant) {
      case 'talking-character-3d':
        return this.talkingCharacter3D();
      case 'body-science':
        return this.bodyScience();
      default:
        return '';
    }
  }

  private talkingCharacter3D(): string {
    return `══════════════════════════════════════════════════════════════
STEP 3.6 — BIOLOGICAL ACTION SYSTEM (CRITICAL FIX)
══════════════════════════════════════════════════════════════

CREW SYSTEM RULE:

Apply crew-based system ONLY for:

1. Food inside body
2. Biological / health internal processes

DO NOT use crew system for:

• Object stories (gym equipment, tools, daily items)
• External environment explanations

For OBJECT STORY:
→ Single or multiple main characters interacting is enough
→ NO miniature clones required
→ Focus on demonstration, motion, and interaction

MANDATORY RULES:

---

1. CREW SYSTEM (REQUIRED FOR INTERNAL ONLY)

Scene MUST include MULTIPLE ACTIVE ENTITIES:

• Main character (food hero)
• Beneficial bacteria (helpers) — MUST be miniature versions of main character
• Target elements (debris / toxins / bad bacteria)

→ If only one character exists in INTERNAL scenes → INVALID

---

FOR OBJECT STORY (EXTERNAL):

• Crew system is NOT required
• Multiple characters are OPTIONAL
• Single character with strong action is VALID
• Focus on demonstration, motion, and interaction instead of microscopic systems

---

1.5. CREW CONSISTENCY RULE (MANDATORY)

All helper characters MUST be visually derived from the main subject:

• They appear as miniature versions, fragments, or stylized clones of the main character
• Same color palette, texture, material, and biological identity
• Example: broccoli → mini broccoli florets; yogurt → creamy droplets; psyllium → fiber strands
• NO unrelated creature designs (no generic bacteria blobs unless explicitly required)

VISUAL DNA LOCK:
Crew members must share the same material properties, surface texture, and structural features as the main character.

→ If crew looks unrelated to main character → INVALID

---

2. ROLE ASSIGNMENT (REQUIRED)

Each entity must DO something:

• Cleaning → removing debris / toxins
• Repairing → healing tissue / cells
• Feeding → boosting good bacteria
• Defending → attacking harmful particles

---

3. ACTION SEQUENCE (REQUIRED)

Scene MUST visually show:

• BEFORE → problem exists (dark particles / irritation / buildup)
• ACTION → crew interaction (cleaning / attacking / repairing)
• AFTER → visible improvement (clear surface / glow / healthy tissue)

→ If no transformation → INVALID

---

3.5. CONTINUOUS SCENE RULE (MANDATORY)

BEFORE, ACTION, AFTER must exist within ONE continuous environment.

• NO split screens
• NO panel divisions
• NO visual separator lines

Transformation must occur spatially:
- one region shows damage
- adjacent region shows improvement
- transition flows naturally across the scene

→ If scene looks segmented → INVALID

---

4. INTERACTION DENSITY (VERY IMPORTANT)

At least 3 simultaneous visible actions:

• bacteria attaching to particles
• nutrients absorbing into tissue
• harmful particles shrinking / dissolving
• glow spreading through environment

---

4.5. FOCUS RULE

At least ONE primary action must be visually dominant and clearly readable.

Other actions act as secondary background support.

→ Avoid chaotic or unclear multi-action scenes

---

5. VISUAL FEEDBACK (MANDATORY)

Every action must cause a visible change:

• dark → bright
• dull → glowing
• rough → smooth
• inflamed → calm

---

6. MOTION & LIFE

Scene must feel ALIVE:

• flowing movement (fluids, particles)
• coordinated behavior (like a team)
• no static posing

---

Think:
👉 "tiny workers fixing the body in real time"`;
  }

  private bodyScience(): string {
    return `══════════════════════════════════════════════════════════════
INTERNAL JOURNEY MICRO-SCENES
══════════════════════════════════════════════════════════════

Each next narration line must represent ONE biological step.

For INTERNAL scenes:
- Use semi-transparent rib cage
- Blue energy glow for scientific visualization
- Red lightning for pain/damage
- Red arrows for anatomical tracing
- Maintain solid teal background
- 9:16 framing
- NO TEXT OVERLAYS
- MUST include the mandatory anatomical placement sentence`;
  }
}

export const crewSystemSkill = new CrewSystemSkill();
