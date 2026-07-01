import { Skill, SkillContext } from './types';

export abstract class BaseSkill implements Skill {
  abstract id: string;
  abstract name: string;
  abstract version: string;
  abstract render(context: SkillContext): string;
}
