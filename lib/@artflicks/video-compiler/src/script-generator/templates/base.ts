import { z } from 'zod';
import { ScriptGenerationContext, ScriptTemplate, TemplateManifest } from '../types';

export abstract class BaseScriptTemplate implements ScriptTemplate {
    abstract manifest: TemplateManifest;

    abstract getSystemPrompt(context: ScriptGenerationContext): string;

    abstract getSchema(context?: ScriptGenerationContext): z.ZodType<any>;

    getConstraints(context: ScriptGenerationContext): any {
        return {};
    }
}
