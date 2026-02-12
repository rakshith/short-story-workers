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
 * min = FLOOR that guarantees the target duration even at ~2.7s avg/scene.
 *   Formula: min = ceil(toleranceMin / 2.7)
 * target = ideal scene count at ~3s/scene.
 * max = upper bound before scenes feel too choppy.
 *
 * The LLM tends to generate near `min`, so `min` must be high enough
 * on its own to fill the duration. This was learned from production:
 * 15 min scenes for 60s only produced 41s of actual video.
 */
export const SCENE_COUNT_GUIDE: Record<number, { min: number; target: number; max: number }> = {
    15: { min: 5, target: 6, max: 8 },        // 5×2.7=13.5s  (tol: 13–17) ✓
    30: { min: 10, target: 12, max: 14 },      // 10×2.7=27s   (tol: 27–33) ✓
    60: { min: 21, target: 24, max: 28 },      // 21×2.7=56.7s (tol: 55–65) ✓
    120: { min: 41, target: 46, max: 52 },     // 41×2.7=110.7s(tol: 110–130) ✓
    180: { min: 62, target: 68, max: 76 },     // 62×2.7=167.4s(tol: 165–195) ✓
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

// ═══════════════════════════════════════════════════════════════
// VIDEO-CLIP MODE CONSTANTS
//
// When mediaType === 'video', each scene becomes an AI-generated
// video clip (5–10s) instead of a still image (~3s). Fewer scenes,
// longer holds, lower cost, and the motion carries the visuals.
// ═══════════════════════════════════════════════════════════════

/**
 * Allowed per-scene durations for VIDEO mode (seconds).
 * Standard for video generation: only 5s or 10s clips.
 */
export const VIDEO_ALLOWED_SCENE_DURATIONS = [5, 10] as const;

/**
 * Words-per-second and min/max words for VIDEO mode per scene duration.
 * Used in system prompts so LLM-generated narration fits within clip length.
 * Spec: voice-over and captions must never exceed scene duration (enforced at generation only).
 * - 5s: 2.0 wps → at most 10 words (never exceed or audio/captions exceed 5s).
 * - 10s: 2.8 wps → at most 28 words (never exceed or audio/captions exceed 10s).
 */
export const VIDEO_NARRATION_WPS = {
    wps5s: 2.0,
    wps10s: 2.8,
    minWords5s: 6,   // 5s scene minimum for substance (not bare 1–2 words)
    maxWords5s: 10,  // 10 words max at 2.0 wps = 5s — never exceed or TTS exceeds scene
    maxWords10s: 28, // 28 words max at 2.8 wps = 10s — never exceed or TTS exceeds scene
    minWords10s: 15, // 10s scene: 15–28 words at 2.8 wps — enough substance, never exceed 28 or audio exceeds 10s
} as const;

/**
 * Per-scene duration guidelines for VIDEO mode (seconds).
 *
 * Only 5s or 10s are allowed (standard for video generation).
 */
export const VIDEO_SCENE_DURATION_GUIDE = {
    min: 5,     // short punchy video clip
    target: 5,  // use 5 or 10 only
    max: 10,    // absolute max per clip
} as const;

/**
 * Scene count guidelines for VIDEO mode per total video duration.
 *
 * Fewer scenes than image mode because each clip already has motion.
 * min = ceil(toleranceMin / maxDuration)
 * target = round(duration / targetDuration)
 * max = ceil(toleranceMax / minDuration)
 */
export const VIDEO_SCENE_COUNT_GUIDE: Record<number, { min: number; target: number; max: number }> = {
    15: { min: 2, target: 2, max: 3 },         // 2×7=14s  (tol: 13–17) ✓
    30: { min: 3, target: 4, max: 6 },          // 4×7=28s  (tol: 27–33) ✓
    60: { min: 6, target: 9, max: 12 },         // 9×7=63s  (tol: 55–65) ✓
    120: { min: 11, target: 17, max: 22 },      // 17×7=119s(tol: 110–130) ✓
    180: { min: 17, target: 26, max: 32 },      // 26×7=182s(tol: 165–195) ✓
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
