import { ScriptTemplateIds } from '../script-generator';

const TEMPLATES_SKIP_IMAGE_STEP = new Set<string>([ScriptTemplateIds.FACELESS_VIDEO]);
const WORKFLOWS_SKIP_IMAGE_STEP = new Set<string>(['faceless-video']);

export function templateSkipsImageStep(
  templateId: string | undefined,
  videoType?: string
): boolean {
  if (templateId && TEMPLATES_SKIP_IMAGE_STEP.has(templateId)) return true;
  if (videoType && WORKFLOWS_SKIP_IMAGE_STEP.has(videoType)) return true;
  return false;
}
