import { ScriptTemplateIds } from '../script-generator/templates';

const TEMPLATES_SKIP_IMAGE_STEP = new Set<string>([ScriptTemplateIds.FACELESS_VIDEO]);

export function templateSkipsImageStep(templateId: string | undefined): boolean {
  if (!templateId) return false;
  return TEMPLATES_SKIP_IMAGE_STEP.has(templateId);
}
