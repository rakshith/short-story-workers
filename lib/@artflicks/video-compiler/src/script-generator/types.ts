import { z } from 'zod';

export interface ScriptGenerationContext {
    duration: number;
    prompt: string;
    language?: string; // e.g. 'en', 'es', 'fr'
    model?: string; // Model name for logging/tracking
    topic?: string;
    // New fields for character consistency
    characterReference?: string; // Description or URL context (though prompts usually need text description)
    visualPreset?: string; // e.g. "cinematic", "anime", "analog-film"
}

export interface ScriptGenerationResult {
    success: boolean;
    script?: any; // The raw object matching the schema
    systemPrompt?: string; // For debugging
    error?: string;
    usage?: {
        promptTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
}

export interface TemplateManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    tags?: string[];
    author?: string;
    // Future marketplace fields
    thumbnailUrl?: string;
    price?: number;
}

export interface ScriptTemplate {
    manifest: TemplateManifest;


    /**
     * Generates the system prompt for this template
     */
    getSystemPrompt(context: ScriptGenerationContext): string;

    /**
     * Returns the Zod schema for the output validation
     */
    getSchema(): z.ZodType<any>;

    /**
     * Optional: Calculates scene plan or constraints
     */
    getConstraints?(context: ScriptGenerationContext): any;
}

export interface ScriptGeneratorOptions {
    apiKey?: string; // If using internal fetch
    model?: any; // versatile for AI SDK model
}
