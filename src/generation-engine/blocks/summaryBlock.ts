// Summary Block - generates story summaries for metadata & SEO

import { Block, BlockInput, BlockOutput } from '../types';

export interface SummaryBlockInput extends BlockInput {
    data: {
        story: { title?: string; scenes?: { narration?: string }[] };
    };
}

export interface SummaryBlockOutput extends BlockOutput {
    data?: {
        summary: string;
        tags: string[];
        estimatedDuration: number;
    };
}

export class SummaryBlock implements Block {
    readonly id = 'summary-gen';
    readonly capability = 'summary' as const;

    async execute(input: SummaryBlockInput): Promise<SummaryBlockOutput> {
        const { story } = input.data;

        try {
            if (!story || !story.scenes || story.scenes.length === 0) {
                return {
                    success: false,
                    error: 'Story with scenes is required for summary generation',
                };
            }

            // Simple extraction-based summary; can be replaced with LLM-based summarization
            const narrations = story.scenes
                .map(s => s.narration || '')
                .filter(Boolean);
            const summary = narrations.length > 0
                ? narrations[0].substring(0, 200)
                : (story.title || 'Untitled Story');

            const totalDuration = story.scenes.length * 5; // rough estimate

            return {
                success: true,
                data: {
                    summary,
                    tags: [],
                    estimatedDuration: totalDuration,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Summary generation failed',
            };
        }
    }
}
