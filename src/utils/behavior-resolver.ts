// Behavior Resolver — Resolves scene behaviors using system rules (mandatory) + user rules (opt-in)
// System rules always override user rules when both target the same behavior key.
// Resolution order: defaults → user rules (if opted in) → system rules (always final)

import behaviorRulesData from '../config/behavior-rules.json';

interface BehaviorRule {
  id: string;
  description: string;
  condition: string;
  behavior: Record<string, unknown>;
  optInFlag?: string;
}

interface BehaviorRulesConfig {
  defaults: Record<string, unknown>;
  systemRules: BehaviorRule[];
  userRules: BehaviorRule[];
}

const config = behaviorRulesData as unknown as BehaviorRulesConfig;

export interface ResolvedBehaviors {
  playEmbeddedAudio: boolean;
  useDrivingAudio: boolean;
  [key: string]: unknown;
}

export function evaluateBehaviorCondition(condition: string, scene: any): boolean {
  const hasGeneratedVideo = Boolean(scene?.generatedVideoUrl);
  const avatarBehavior = scene?.composer?.classification?.avatarBehavior;

  switch (condition) {
    case 'is-avatar-video':
      return hasGeneratedVideo && avatarBehavior === 'avatar-holds-product';
    case 'is-product-animation':
      return hasGeneratedVideo && avatarBehavior === 'no-avatar';
    case 'is-user-content':
      return !hasGeneratedVideo && (Boolean(scene?.generatedImageUrl) || Boolean(scene?.sourceMediaUrl));
    default:
      return false;
  }
}

export function resolveBehaviors(scene: any, videoConfig: any): ResolvedBehaviors {
  const resolved: Record<string, unknown> = { ...config.defaults };

  for (const rule of config.userRules) {
    if (rule.optInFlag && videoConfig?.[rule.optInFlag] === true) {
      if (evaluateBehaviorCondition(rule.condition, scene)) {
        Object.assign(resolved, rule.behavior);
      }
    }
  }

  for (const rule of config.systemRules) {
    if (evaluateBehaviorCondition(rule.condition, scene)) {
      Object.assign(resolved, rule.behavior);
    }
  }

  return resolved as ResolvedBehaviors;
}