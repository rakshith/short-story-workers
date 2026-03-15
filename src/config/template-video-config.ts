import { ScriptTemplateIds } from '../../lib/@artflicks/video-compiler/src/script-generator/templates';

const TEMPLATES_SKIP_IMAGE_STEP = new Set<string>([ScriptTemplateIds.YOUTUBE_SHORTS]);

export function templateSkipsImageStep(templateId: string | undefined): boolean {
  if (!templateId) return false;
  return TEMPLATES_SKIP_IMAGE_STEP.has(templateId);
}
