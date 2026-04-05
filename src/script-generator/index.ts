import { generateText, Output, LanguageModel, jsonSchema } from 'ai';
import * as z from 'zod';
import { ScriptGenerationContext, ScriptGenerationResult } from './types';
import { getTemplate, ScriptTemplateIds } from './templates';

export * from './types';
export * from './schema';
export * from './templates';

export class ScriptGenerator {
    constructor(private model: LanguageModel) { }

    async generate(
        context: ScriptGenerationContext,
        templateName: string = ScriptTemplateIds.FACELESS_VIDEO
    ): Promise<ScriptGenerationResult> {
        const template = getTemplate(templateName);

        // Validate template
        if (!template) {
            return {
                success: false,
                error: `Template '${templateName}' not found`,
            };
        }

        // Ensure duration is always present
        if (!context.duration || context.duration <= 0) {
            return {
                success: false,
                error: 'context.duration is required and must be a positive number',
            };
        }

        const systemPrompt = template.getSystemPrompt(context);
        const schema: any = template.getSchema(context);

        const jsonSchemaObj = z.toJSONSchema(schema);
        const openAiSchema = jsonSchema(jsonSchemaObj);

        const systemWithJson = `You must respond with a single valid JSON object only. Do not include markdown or any text outside the JSON.\n\n${systemPrompt}`;

        // const temperature = context.mediaType === 'video' ? 0.4 : 0.7;
        const hasTools = context.tools && Object.keys(context.tools).length > 0;
        try {
            const { output, usage } = await (generateText as any)({
                model: this.model,
                system: systemWithJson,
                prompt: context.prompt,
                output: Output.object({ schema: openAiSchema }),
                ...(hasTools && {
                    tools: context.tools,
                    maxSteps: context.maxSteps ?? 3,
                }),
            }) as Awaited<ReturnType<typeof generateText>>;

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
