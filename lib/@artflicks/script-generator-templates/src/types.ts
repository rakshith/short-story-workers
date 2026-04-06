import { z } from 'zod';

export interface AnchorScene {
    visualHint: string;
    narration: string;
    cameraAngle?: string;
    mood?: string;
}

export interface ScriptGenerationContext {
    duration: number;
    prompt: string;
    language?: string;
    model?: string;
    topic?: string;
    mediaType?: 'image' | 'video';
    characterReferenceImages?: string[];
    tools?: Record<string, any>;
    maxSteps?: number;
    speed?: number;
    anchors?: AnchorScene[];
    minSceneDuration?: number;
    maxSceneDuration?: number;
}

export interface ScriptGenerationResult {
    success: boolean;
    script?: any;
    systemPrompt?: string;
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
    thumbnailUrl?: string;
    price?: number;
}

export interface ScriptTemplate {
    manifest: TemplateManifest;
    getSystemPrompt(context: ScriptGenerationContext): string;
    getSchema(context?: ScriptGenerationContext): z.ZodType<any>;
    getConstraints?(context: ScriptGenerationContext): any;
}

export interface ScriptGeneratorOptions {
    apiKey?: string;
    model?: any;
}
