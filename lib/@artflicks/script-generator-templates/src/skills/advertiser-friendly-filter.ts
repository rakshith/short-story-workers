import { BaseSkill } from './base';
import { SkillContext } from './types';

export const ADVERTISER_FRIENDLY_FILTER = `ADVERTISER-FRIENDLY CONTENT RULES (YouTube Partner Program)
No graphic depictions of violence, gore, or injury — historical violence may be referenced but never described in visceral detail
No sexually suggestive content or innuendo of any kind
No content that is politically divisive, partisan, or that targets real living political figures negatively
No profanity or euphemistic substitutes for profanity in narration
No promotion of dangerous activities, substances, or self-harm
No content that demeans groups based on race, religion, gender, or nationality
Historical chaos and conflict is allowed — frame consequences cinematically, never sensationally
When in doubt: ask "would a mainstream brand be comfortable running an ad before this?" If no — rewrite the scene`;

export class AdvertiserFriendlyFilterSkill extends BaseSkill {
  id = 'advertiser-friendly-filter';
  name = 'Advertiser Friendly Filter';
  version = '1.0.0';

  render(_context: SkillContext): string {
    return ADVERTISER_FRIENDLY_FILTER;
  }
}

export const advertiserFriendlyFilterSkill = new AdvertiserFriendlyFilterSkill();
