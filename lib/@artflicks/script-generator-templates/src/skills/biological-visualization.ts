import { BaseSkill } from './base';
import { SkillContext } from './types';

export const ORGAN_GLOW_COLORS = {
  liver_depleting:    'amber / warm orange draining',
  liver_producing:    'bright amber pulsing',
  brain_fog:          'dim grey-blue, low glow',
  brain_ketones:      'blazing golden-yellow, intense glow',
  brain_glucose:      'warm white active glow',
  heart_stress:       'pulsing crimson red, rapid flash',
  heart_calm:         'steady warm pink',
  fat_lipolysis:      'warm golden particles releasing outward',
  stomach_empty:      'dark hollow void, deep blue-black',
  stomach_active:     'churning green-yellow',
  kidneys_filtering:  'cool blue-white steady glow',
  adrenals_surging:   'intense orange-red flare burst',
  muscles_breaking:   'fading red shifting to grey',
  autophagy_active:   'soft violet-purple cellular shimmer',
  immune_active:      'bright white scattered glow',
} as const;

export class BiologicalVisualizationSkill extends BaseSkill {
  id = 'biological-visualization';
  name = 'Biological Visualization';
  version = '1.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.bioVariant as string) || 'default';

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
STEP 3.5 — BIOLOGICAL VISUALIZATION (MANDATORY)
══════════════════════════════════════════════════════════════

If input is Food/Health:

→ Decide visualization type:

1. INTERNAL MODE (default for digestion, gut, biology topics)
   → Show inside human body

2. EXTERNAL MODE (when focus is explanation, lifestyle, or objects interacting)
   → Show real-world environment (gym, kitchen, room, etc.)

RULE:
→ DO NOT force internal body scenes unless the benefit requires biological visualization

→ If objects (dumbbell, treadmill, yoga mat) are present:
   ALWAYS prefer EXTERNAL MODE

Map environment:

- digestion → intestine / stomach (villi, mucus, enzymes)
- immunity → microbiome / bloodstream
- brain → neurons / synapses
- heart → arteries / blood flow
- energy → cells / mitochondria

Environment MUST include:

* cells, villi, membranes
* floating particles, enzymes
* moist organic textures
* depth (foreground + mid + background)`;
  }

  private bodyScience(): string {
    return `══════════════════════════════════════════════════════════════
ANATOMICAL ACCURACY LOCK
══════════════════════════════════════════════════════════════

All internal organ visualizations MUST follow medically accurate human anatomy.

STRICT ORGAN POSITIONING:
- Heart: Skeleton's LEFT chest cavity, slightly tilted, behind sternum
- Lungs: Two symmetrical lobes filling rib cage, heart overlapping left lung
- Trachea: Centered, descending into bronchi
- Esophagus: Posterior to trachea
- Liver: Skeleton's RIGHT upper abdomen, below diaphragm
- Stomach: Skeleton's LEFT upper abdomen, under left rib cage
- Pancreas: Horizontal, posterior to stomach
- Small intestine: Center lower abdomen, tightly coiled
- Large intestine: Frames small intestine perimeter
- Kidneys: Posterior left and right, near lower ribs
- Brain: Fully contained within skull cavity
- Spinal cord: Vertical inside vertebral column

ORIENTATION REQUIREMENTS:
- Always specify: "skeleton's left" or "skeleton's right"
- Never mirror organs incorrectly
- Never float organs
- Never center the heart
- Never place liver on left side

ANCHORING RULE:
- Organs must appear embedded inside torso cavity
- Semi-transparent rib cage required during X-ray scenes
- Sternum visible in anterior view
- Spine visible in internal shots
- Clavicles anatomically aligned
- Diaphragm boundary respected

MANDATORY INTERNAL SCENE LINE:
For every internal organ scene, add this sentence inside the imagePrompt:
"Medically accurate anatomical placement, correct left-right orientation from skeleton's perspective, not mirrored, not floating, anatomically anchored to ribs and spine."`;
  }
}

export const biologicalVisualizationSkill = new BiologicalVisualizationSkill();
