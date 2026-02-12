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
        const schema = template.getSchema(context);

        const temperature = context.mediaType === 'video' ? 0.4 : 0.7;
        try {
            const { output, usage } = await generateText({
                model: this.model,
                system: systemPrompt,
                prompt: context.prompt,
                temperature,
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
            const err = error instanceof Error ? error : new Error(String(error));
            const message = err.message;

            // Log detailed schema validation info when response didn't match schema
            if (message.includes('did not match schema') || message.includes('No object generated')) {
                console.error('[ScriptGenerator] Schema validation failed:', message);
                if (err.cause) {
                    console.error('[ScriptGenerator] Cause:', err.cause);
                    const cause = err.cause as Error & { issues?: unknown[]; format?: () => unknown };
                    if (cause.issues) {
                        console.error('[ScriptGenerator] Zod issues:', JSON.stringify(cause.issues, null, 2));
                    }
                    if (typeof cause.format === 'function') {
                        try {
                            console.error('[ScriptGenerator] Zod format:', JSON.stringify(cause.format(), null, 2));
                        } catch (_) {}
                    }
                }
                // Log any extra details the SDK may attach
                const raw = error as Record<string, unknown>;
                if (raw.validationErrors) {
                    console.error('[ScriptGenerator] validationErrors:', JSON.stringify(raw.validationErrors, null, 2));
                }
                if (raw.response !== undefined) {
                    console.error('[ScriptGenerator] response:', typeof raw.response === 'string' ? raw.response.slice(0, 500) : raw.response);
                }
            } else {
                console.error('[ScriptGenerator] Error:', error);
            }

            return {
                success: false,
                error: message,
                systemPrompt, // useful for debugging
            };
        }
    }
}
