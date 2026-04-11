export const NARRATION_WPS = {
    min: 2.2,
    target: 2.5,
    max: 2.8,
} as const;

export const SCENE_COUNT_GUIDE: Record<number, { min: number; target: number; max: number }> = {
    15: { min: 5, target: 6, max: 8 },
    30: { min: 10, target: 12, max: 14 },
    60: { min: 21, target: 24, max: 28 },
    120: { min: 41, target: 46, max: 52 },
    180: { min: 62, target: 68, max: 76 },
};

export const SCENE_DURATION_GUIDE = {
    min: 2,
    target: 3,
    max: 4,
} as const;

export const DURATION_TOLERANCE: Record<number, { min: number; max: number }> = {
    15: { min: 13, max: 17 },
    30: { min: 27, max: 33 },
    60: { min: 55, max: 65 },
    120: { min: 110, max: 130 },
    180: { min: 165, max: 195 },
};

export const VIDEO_ALLOWED_SCENE_DURATIONS = [5, 10] as const;

export const VIDEO_NARRATION_WPS = {
    wps5s: 2.0,
    wps10s: 2.4,
    minWords5s: 6,
    maxWords5s: 10,
    maxWords10s: 20,
    minWords10s: 15,
} as const;

export const TALKING_CHARACTER_3D_NARRATION_WPS = {
    wps4s: 2.0,
    wps6s: 2.0,
    wps8s: 2.0,
    minWords4s: 5,
    maxWords4s: 8,
    targetWords4s: 6,
    minWords6s: 8,
    maxWords6s: 12,
    targetWords6s: 10,
    minWords8s: 10,
    maxWords8s: 16,
    targetWords8s: 12,
} as const;

export const VIDEO_SCENE_DURATION_GUIDE = {
    min: 5,
    target: 5,
    max: 10,
} as const;

export const VIDEO_DURATION_TOLERANCE: Record<number, { min: number; max: number }> = {
    15: { min: 13, max: 17 },
    30: { min: 28, max: 33 },
    60: { min: 58, max: 65 },
    120: { min: 118, max: 125 },
    180: { min: 178, max: 185 },
};

export const VIDEO_SCENE_COUNT_GUIDE: Record<number, { min: number; target: number; max: number }> = {
    15: { min: 2, target: 2, max: 3 },
    30: { min: 3, target: 4, max: 6 },
    60: { min: 6, target: 9, max: 12 },
    120: { min: 12, target: 17, max: 20 },
    180: { min: 18, target: 26, max: 28 },
};

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
