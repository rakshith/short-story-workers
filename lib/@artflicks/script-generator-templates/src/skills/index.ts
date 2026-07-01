import { Skill, SkillContext, SkillOverrides } from './types';

export { BaseSkill } from './base';
export type { Skill, SkillContext, SkillOverrides } from './types';
export { LLMIntentAnalyzer } from './intent-analyzer';
export type { IntentAnalyzer } from './intent-analyzer';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    if (this.skills.has(skill.id)) {
      console.warn(`[SkillRegistry] Skill '${skill.id}' already registered. Overwriting.`);
    }
    this.skills.set(skill.id, skill);
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  compose(
    skillIds: string[],
    context: SkillContext,
    overrides?: SkillOverrides
  ): string {
    return skillIds
      .map((id) => {
        const skill = this.get(id);
        if (!skill) {
          console.warn(`[SkillRegistry] Skill '${id}' not found, skipping.`);
          return '';
        }
        const skillOverrides = overrides?.[id];
        if (skillOverrides) {
          const patched = patchSkill(skill, skillOverrides);
          return patched.render(context);
        }
        return skill.render(context);
      })
      .filter(Boolean)
      .join('\n\n');
  }
}

function patchSkill(skill: Skill, overrides: Record<string, unknown>): Skill {
  const originalRender = skill.render.bind(skill);
  return {
    ...skill,
    render: (context: SkillContext) => {
      const patchedContext = {
        ...context,
        flags: {
          ...context.flags,
          ...overrides,
        },
      };
      return originalRender(patchedContext);
    },
  };
}

export const skillRegistry = new SkillRegistry();

import { narrationRulesSkill } from './narration-rules';
import { cinematicStorytellingSkill } from './cinematic-storytelling';
import { imagePromptQualitySkill } from './image-prompt-quality';
import { videoPromptQualitySkill } from './video-prompt-quality';
import { cameraFramingSkill } from './camera-framing';
import { characterDnaSkill } from './character-dna';
import { languageHandlingSkill } from './language-handling';
import { retentionHooksSkill } from './retention-hooks';
import { youtubeMetadataSkill } from './youtube-metadata';
import { qualityValidationSkill } from './quality-validation';
import { advertiserFriendlyFilterSkill } from './advertiser-friendly-filter';
import { crewSystemSkill } from './crew-system';
import { styleEngineSkill } from './style-engine';
import { biologicalVisualizationSkill } from './biological-visualization';
import { StyleVocabularySkill } from './style-vocabulary';

export function registerAllSkills(): void {
  skillRegistry.register(narrationRulesSkill);
  skillRegistry.register(cinematicStorytellingSkill);
  skillRegistry.register(imagePromptQualitySkill);
  skillRegistry.register(videoPromptQualitySkill);
  skillRegistry.register(cameraFramingSkill);
  skillRegistry.register(characterDnaSkill);
  skillRegistry.register(languageHandlingSkill);
  skillRegistry.register(retentionHooksSkill);
  skillRegistry.register(youtubeMetadataSkill);
  skillRegistry.register(qualityValidationSkill);
  skillRegistry.register(advertiserFriendlyFilterSkill);
  skillRegistry.register(crewSystemSkill);
  skillRegistry.register(styleEngineSkill);
  skillRegistry.register(biologicalVisualizationSkill);
  skillRegistry.register(new StyleVocabularySkill());
}
