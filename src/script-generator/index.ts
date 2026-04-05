import { generateText, Output, LanguageModel, jsonSchema } from 'ai';
import * as z from 'zod';

import {
    getTemplate,
    ScriptTemplateIds,
    registry,
    defaultTemplate,
    DEFAULT_SKELETON_REFERENCES,
    DEFAULT_SKELETON_REFERENCE,
} from '@artflicks/script-generator-templates';

import type { ScriptGenerationContext, ScriptGenerationResult, ScriptTemplate, TemplateManifest } from '@artflicks/script-generator-templates';

export {
    getTemplate,
    ScriptTemplateIds,
    registry,
    defaultTemplate,
    DEFAULT_SKELETON_REFERENCES,
    DEFAULT_SKELETON_REFERENCE,
};

export type {
    ScriptGenerationContext,
    ScriptGenerationResult,
    ScriptTemplate,
    TemplateManifest,
};

export { BaseScriptTemplate } from '@artflicks/script-generator-templates';

export class ScriptGenerator {
    constructor(private model: LanguageModel) { }

    async generate(
        context: ScriptGenerationContext,
        templateName: string = 'faceless-video'
    ): Promise<ScriptGenerationResult> {
        const template = getTemplate(templateName);

        if (!template) {
            return {
                success: false,
                error: `Template '${templateName}' not found`,
            };
        }

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
                systemPrompt,
            };
        }
    }
}
