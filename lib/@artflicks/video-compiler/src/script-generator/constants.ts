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

export const DURATION_TOLERANCE: Record<number, { min: number; max: number }> = {
    15: { min: 14, max: 16 },  // ±1s
    30: { min: 28, max: 32 },  // ±2s
    60: { min: 57, max: 63 },  // ±3s
    120: { min: 117, max: 123 },  // ±3s
    180: { min: 177, max: 183 },  // ±3s
};
