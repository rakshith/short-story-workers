/**
 * Global narration style configuration
 * Controls both script generation (words/second) and audio generation (ElevenLabs settings)
 */

export const DEFAULT_NARRATION_STYLE = 'neutral';

const WORDS_PER_SECOND_RATE = 2.0

export interface NarrationStyleConfig {
    /** Words per second for script generation timing */
    wordsPerSecond: number;
    /** ElevenLabs voice settings */
    audioSettings: {
        stability: number;        // 0-1: Lower = more expressive, higher = more stable
        similarityBoost: number;  // 0-1: Voice consistency
        style: number;            // 0-1: Style exaggeration (0 = neutral, 1 = highly expressive)
        useSpeakerBoost: boolean; // Speaker boost for clarity
    };
    /** Description of this style */
    description: string;
}

export const NARRATION_STYLES = {
    dramatic: {
        wordsPerSecond: WORDS_PER_SECOND_RATE,
        audioSettings: {
            stability: 0.55,
            similarityBoost: 0.85,
            style: 0.5,
            useSpeakerBoost: false,
        },
        description: 'Dramatic/emotional/cinematic delivery with varied pacing',
    },
    emotional: {
        wordsPerSecond: WORDS_PER_SECOND_RATE,
        audioSettings: {
            stability: 0.45,
            similarityBoost: 0.80,
            style: 0.7,
            useSpeakerBoost: false,
        },
        description: 'Highly emotional/cinematic voice with expressive delivery',
    },
    musical: {
        wordsPerSecond: WORDS_PER_SECOND_RATE,
        audioSettings: {
            stability: 0.60,
            similarityBoost: 0.85,
            style: 0.4,
            useSpeakerBoost: false,
        },
        description: 'Music-led pacing with rhythmic, measured delivery',
    },
    horror: {
        wordsPerSecond: WORDS_PER_SECOND_RATE,
        audioSettings: {
            stability: 0.65,
            similarityBoost: 0.90,
            style: 0.6,
            useSpeakerBoost: false,
        },
        description: 'Horror/suspense narration with deliberate, tense pacing',
    },
    neutral: {
        wordsPerSecond: WORDS_PER_SECOND_RATE,
        audioSettings: {
            stability: 0.70,
            similarityBoost: 0.85,
            style: 0.5,
            useSpeakerBoost: true,
        },
        description: 'Standard conversational speech with neutral delivery',
    },
} as const satisfies Record<string, NarrationStyleConfig>;

export type NarrationStyle = keyof typeof NARRATION_STYLES;

/**
 * Get configuration for a narration style
 */
export function getNarrationStyleConfig(style: NarrationStyle): NarrationStyleConfig {
    return NARRATION_STYLES[style];
}
