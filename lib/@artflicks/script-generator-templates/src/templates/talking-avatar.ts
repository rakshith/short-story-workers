import { z } from 'zod';
import { BaseScriptTemplate } from './base';
import { ScriptGenerationContext, TemplateManifest } from '../types';
import { ScriptTemplateIds } from './index';

export class TalkingAvatarTemplate extends BaseScriptTemplate {
  manifest: TemplateManifest = {
    id: ScriptTemplateIds.TALKING_AVATAR,
    name: 'Talking Avatar',
    version: '1.0.0',
    description: 'Generates a title from speech text. Speech text is preserved exactly as-is.',
    tags: ['talking-avatar', 'title-generation'],
  };

  getSchema(context?: ScriptGenerationContext): z.ZodType<any> {
    const hasMotion = !!context?.motionInstructions?.trim();
    return z.object({
      title: z.string().describe('Short, engaging title (5-8 words) for the speech'),
      ...(hasMotion && {
        enhancedMotionInstructions: z.string().nullable().describe('Detailed motion direction for the avatar, expanding the user\'s brief instructions into professional motion choreography'),
      }),
    });
  }

  getSystemPrompt(context: ScriptGenerationContext): string {
    const { prompt, motionInstructions } = context;
    const hasMotion = !!motionInstructions?.trim();

    if (!hasMotion) {
      return `You are a title generator for talking avatar videos.

Given the following speech text, generate a short, engaging title (5-8 words).

RULES:
- Title must be concise and catchy
- Do NOT modify, rewrite, or summarize the speech text
- Do NOT generate scenes, narration, or image prompts
- Return ONLY the title field

SPEECH TEXT:
${prompt}

Return a JSON object with just the "title" field.`;
    }

    return `You are a title generator and motion director for talking avatar videos.

Given the following speech text and the user's motion instructions, generate:
1. A short, engaging title (5-8 words)
2. Enhanced motion instructions that expand the user's brief directions into detailed, natural motion choreography for the avatar

RULES FOR TITLE:
- Title must be concise and catchy

RULES FOR MOTION INSTRUCTIONS:
- Expand the user's brief instructions into detailed, natural motion direction
- Describe specific gestures, head movements, facial expressions, and body language
- Match the tone and energy of the speech
- Keep instructions natural and fluid — avoid robotic or stiff movements
- Focus on upper body: head, shoulders, arms, hands, and facial expressions
- Use professional motion direction language (e.g., "gentle nodding on affirmative statements", "open palm gesture when explaining")

USER'S MOTION INSTRUCTIONS:
${motionInstructions}

SPEECH TEXT:
${prompt}

Return a JSON object with "title" and "enhancedMotionInstructions" fields.`;
  }
}
