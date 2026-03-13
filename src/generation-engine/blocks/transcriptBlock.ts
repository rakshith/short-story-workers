// Transcript Block - generates transcripts/captions from audio

import { Block, BlockInput, BlockOutput } from '../types';

export interface TranscriptBlockInput extends BlockInput {
    data: {
        audioUrl: string;
        sceneIndex: number;
        language?: string;
    };
}

export interface TranscriptBlockOutput extends BlockOutput {
    data?: {
        transcript: string;
        captions: { text: string; startTime: number; endTime: number }[];
        sceneIndex: number;
    };
}

export class TranscriptBlock implements Block {
    readonly id = 'transcript-gen';
    readonly capability = 'transcription' as const;

    async execute(input: TranscriptBlockInput): Promise<TranscriptBlockOutput> {
        const { audioUrl, sceneIndex, language } = input.data;

        try {
            if (!audioUrl) {
                return {
                    success: false,
                    error: 'Audio URL is required for transcription',
                };
            }

            // Stub: actual implementation would call Whisper or another STT provider.
            console.log(`[TranscriptBlock] Transcribing audio for scene ${sceneIndex}, lang=${language || 'auto'}`);

            return {
                success: true,
                data: {
                    transcript: '',
                    captions: [],
                    sceneIndex,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Transcription failed',
            };
        }
    }
}
