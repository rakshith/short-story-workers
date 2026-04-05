import { ScriptGenerator, ScriptGenerationContext, ScriptGenerationResult } from '../index';

export abstract class BaseScriptAgent {
    abstract readonly templateId: string;

    constructor(protected generator: ScriptGenerator) {}

    getTools(): Record<string, any> | undefined {
        return undefined;
    }

    run(context: ScriptGenerationContext): Promise<ScriptGenerationResult> {
        const tools = this.getTools();
        const enrichedContext: ScriptGenerationContext = tools
            ? { ...context, tools, maxSteps: context.maxSteps ?? 3 }
            : context;
        return this.generator.generate(enrichedContext, this.templateId);
    }
}
