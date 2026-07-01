import { BaseSkill } from './base';
import { SkillContext } from './types';

export class YoutubeMetadataSkill extends BaseSkill {
  id = 'youtube-metadata';
  name = 'YouTube Metadata';
  version = '1.0.0';

  render(context: SkillContext): string {
    const variant = (context.flags?.youtubeVariant as string) || 'default';

    switch (variant) {
      case 'skeleton-3d':
        return this.skeleton3D();
      default:
        return this.default();
    }
  }

  private default(): string {
    return '';
  }

  private skeleton3D(): string {
    return `═══ TITLE ═══
6–12 words. Descriptive, story-specific. Use EXACT terms from user premise — never rephrase or synonymize.`;
  }
}

export const youtubeMetadataSkill = new YoutubeMetadataSkill();
