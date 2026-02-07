// ═══════════════════════════════════════════════════════════════
// NARRATION-BASED CONSTANTS
//
// PACING PHILOSOPHY: Cinematic storytelling with rapid visual cuts.
// The narration flows as ONE continuous story — like a documentary
// voiceover — while visuals change every ~3 seconds.
//
// This is NOT a slideshow. The story grips the viewer while
// the visuals keep changing, creating a cinematic experience.
// ═══════════════════════════════════════════════════════════════

/**
 * Average words-per-second for TTS narration.
 * Typical TTS (ElevenLabs): 2.3–2.8 wps depending on voice/language.
 */
export const NARRATION_WPS = {
    min: 2.2,    // slow/dramatic pacing
    target: 2.5, // natural conversational pace
    max: 2.8,    // brisk/energetic pace
} as const;

/**
 * Scene count guidelines per total video duration.
 *
 * ~3s per scene target = rapid visual changes.
 * For reference: top-tier apps do 10–12 scenes for 30s.
 */
export const SCENE_COUNT_GUIDE: Record<number, { min: number; target: number; max: number }> = {
    15: { min: 4, target: 5, max: 6 },       // ~3s per scene
    30: { min: 8, target: 10, max: 12 },      // ~3s per scene  (industry standard)
    60: { min: 15, target: 18, max: 22 },     // ~3-3.5s per scene
    120: { min: 28, target: 35, max: 42 },    // ~3-3.5s per scene
    180: { min: 40, target: 48, max: 55 },    // ~3.5-4s per scene
};

/**
 * Per-scene duration guidelines (in seconds).
 *
 * Target: ~3s — one visual moment, one flowing sentence.
 * Max: 4s — HARD CAP. If narration exceeds this, split the scene.
 */
export const SCENE_DURATION_GUIDE = {
    min: 2,     // ultra-short punchy moment (hook/reveal/transition)
    target: 3,  // sweet spot — one sentence, one visual, then CUT
    max: 4,     // ABSOLUTE MAX — never hold a visual longer than this
} as const;

/**
 * Acceptable total duration tolerance (seconds).
 */
export const DURATION_TOLERANCE: Record<number, { min: number; max: number }> = {
    15: { min: 13, max: 17 },
    30: { min: 27, max: 33 },
    60: { min: 55, max: 65 },
    120: { min: 110, max: 130 },
    180: { min: 165, max: 195 },
};

// Legacy export kept for backward compatibility
export const SCENE_WORD_LIMITS = {
    SCENE_5S: {
        min: 10,
        target: 13,
        max: 15,
    },
    SCENE_10S: {
        min: 20,
        target: 26,
        max: 30,
    },
} as const;
