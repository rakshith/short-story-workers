/**
 * Global narration style configuration
 * Controls both script generation (words/second) and audio generation (ElevenLabs settings)
 */

export const DEFAULT_NARRATION_STYLE = 'neutral';

/**
 * Word count configuration per scene duration
 * Uses flexible ranges to allow LLM to fill duration naturally
 * - min: absolute minimum (too short = dead air)
 * - target: ideal word count for smooth pacing
 * - max: upper limit (too long = rushed delivery)
 */
export const SCENE_WORD_LIMITS = {
    SCENE_5S: {
        min: 10,    // ~2.0 wps - min for flow
        target: 13, // ~2.6 wps - snappy pace
        max: 15,    // ~3.0 wps - brisk
    },
    SCENE_10S: {
        min: 20,    // ~2.0 wps - min for flow
        target: 26, // ~2.6 wps - ideal storytelling
        max: 30,    // ~3.0 wps - detailed
    },
} as const;

/**
 * Duration tolerance ranges for video lengths
 * Tighter ranges for better TTS accuracy
 */
export const DURATION_TOLERANCE: Record<number, { min: number; max: number }> = {
    15: { min: 14, max: 16 },  // ±1s
    30: { min: 28, max: 32 },  // ±2s
    60: { min: 57, max: 63 },  // ±3s
    120: { min: 117, max: 123 },  // ±3s
    180: { min: 177, max: 183 },  // ±3s
};

export interface NarrationStyleConfig {
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
        audioSettings: {
            stability: 0.55,
            similarityBoost: 0.85,
            style: 0.5,
            useSpeakerBoost: false,
        },
        description: 'Dramatic/emotional/cinematic delivery with varied pacing',
    },
    emotional: {
        audioSettings: {
            stability: 0.45,
            similarityBoost: 0.80,
            style: 0.7,
            useSpeakerBoost: false,
        },
        description: 'Highly emotional/cinematic voice with expressive delivery',
    },
    musical: {
        audioSettings: {
            stability: 0.60,
            similarityBoost: 0.85,
            style: 0.4,
            useSpeakerBoost: false,
        },
        description: 'Music-led pacing with rhythmic, measured delivery',
    },
    horror: {
        audioSettings: {
            stability: 0.65,
            similarityBoost: 0.90,
            style: 0.6,
            useSpeakerBoost: false,
        },
        description: 'Horror/suspense narration with deliberate, tense pacing',
    },
    neutral: {
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

/**
 * Get word count limits based on scene duration
 * @param sceneDuration - Duration of the scene in seconds (5 or 10)
 * @returns Word limit configuration { min, target, max }
 */
export function getWordLimitsForDuration(sceneDuration: 5 | 10) {
    return sceneDuration === 5 ? SCENE_WORD_LIMITS.SCENE_5S : SCENE_WORD_LIMITS.SCENE_10S;
}
