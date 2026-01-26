import { generateText, Output, LanguageModel } from 'ai';
import { ScriptGenerationContext, ScriptGenerationResult } from './types';
import { getTemplate, ScriptTemplateIds } from './templates';

export * from './types';
export * from './schema';
export * from './templates';

export class ScriptGenerator {
    constructor(private model: LanguageModel) { }

    async generate(
        context: ScriptGenerationContext,
        templateName: string = ScriptTemplateIds.YOUTUBE_SHORTS
    ): Promise<ScriptGenerationResult> {
        const template = getTemplate(templateName);

        // Validate template
        if (!template) {
            return {
                success: false,
                error: `Template '${templateName}' not found`,
            };
        }

        const systemPrompt = template.getSystemPrompt(context);
        const schema = template.getSchema();

        try {
            const { output, usage } = await generateText({
                model: this.model,
                system: systemPrompt,
                prompt: context.prompt,
                temperature: 0.7,
                output: Output.object({
                    schema,
                }),
            });

            return {
                success: true,
                script: output,
                systemPrompt,
                usage: usage
                    ? {
                        promptTokens:
                            (usage as any).promptTokens ??
                            (usage as any).inputTokens ??
                            0,
                        outputTokens:
                            (usage as any).completionTokens ??
                            (usage as any).outputTokens ??
                            0,
                        totalTokens: usage.totalTokens ?? 0,
                    }
                    : undefined,
            };
        } catch (error) {
            console.error('[ScriptGenerator] Error:', error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                systemPrompt, // useful for debugging
            };
        }
    }
}
