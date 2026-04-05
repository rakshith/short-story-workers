import {
    NARRATION_WPS,
    SCENE_COUNT_GUIDE,
    SCENE_DURATION_GUIDE,
    DURATION_TOLERANCE,
    VIDEO_SCENE_COUNT_GUIDE,
    VIDEO_SCENE_DURATION_GUIDE,
    VIDEO_DURATION_TOLERANCE,
    VIDEO_ALLOWED_SCENE_DURATIONS,
    VIDEO_NARRATION_WPS,
} from '../constants';

export interface ScenePlan {
    durationSeconds: number;
    minScenes: number;
    targetScenes: number;
    maxScenes: number;
    totalWordsMin: number;
    totalWordsTarget: number;
    totalWordsMax: number;
    perSceneWordsMin: number;
    perSceneWordsTarget: number;
    perSceneWordsMax: number;
    perSceneDurationMin: number;
    perSceneDurationTarget: number;
    perSceneDurationMax: number;
    tolerance: { min: number; max: number };
    allowedSceneDurations?: readonly number[];
    sceneGuidance: string;
    narrationGuidance: string;
}

export function getScenePlan(durationSeconds: number, mediaType: 'image' | 'video' = 'image'): ScenePlan {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error('durationSeconds must be a positive number.');
    }

    const isVideo = mediaType === 'video';
    const sceneCountGuide = isVideo ? VIDEO_SCENE_COUNT_GUIDE : SCENE_COUNT_GUIDE;
    const sceneDurationGuide = isVideo ? VIDEO_SCENE_DURATION_GUIDE : SCENE_DURATION_GUIDE;

    const sceneGuide = sceneCountGuide[durationSeconds] ?? {
        min: Math.max(3, Math.ceil(durationSeconds / (isVideo ? 10 : 4))),
        target: Math.round(durationSeconds / (isVideo ? 7 : 3)),
        max: Math.ceil(durationSeconds / (isVideo ? 5 : 2.5)),
    };

    const { min: minScenes, target: targetScenes, max: maxScenes } = sceneGuide;

    const totalWordsMin = isVideo
        ? minScenes * 12
        : Math.round(durationSeconds * NARRATION_WPS.min);
    const totalWordsTarget = Math.round(durationSeconds * NARRATION_WPS.target);
    const totalWordsMax = Math.round(durationSeconds * NARRATION_WPS.max);

    const absoluteMaxWordsPerScene = Math.round(sceneDurationGuide.max * NARRATION_WPS.max);
    const perSceneWordsTarget = Math.round(totalWordsTarget / targetScenes);
    const perSceneWordsMin = Math.max(5, Math.round(totalWordsMin / maxScenes));
    const perSceneWordsMax = Math.min(
        absoluteMaxWordsPerScene,
        Math.round(totalWordsMax / minScenes)
    );

    const perSceneDurationTarget = sceneDurationGuide.target;
    const perSceneDurationMin = sceneDurationGuide.min;
    const perSceneDurationMax = sceneDurationGuide.max;

    const toleranceGuide = isVideo ? VIDEO_DURATION_TOLERANCE : DURATION_TOLERANCE;
    const tolerance = toleranceGuide[durationSeconds] ?? {
        min: durationSeconds - 5,
        max: durationSeconds + 5,
    };

    const wrongScenes = Math.round(targetScenes * 0.55);
    const wrongWords = wrongScenes * perSceneWordsTarget;
    const wrongDuration = Math.round(wrongWords / NARRATION_WPS.target);

    const durationRule = isVideo
        ? `- Each scene duration must be exactly 5 or exactly 10 seconds (no other values).
- TOTAL DURATION: Sum of ALL scene durations MUST equal ${durationSeconds}s (acceptable range: ${tolerance.min}–${tolerance.max}s).
- NARRATION MUST FIT THE SCENE: 5s scene = ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words. 10s scene = ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words.`
        : `- Each scene: ${perSceneWordsMin}–${perSceneWordsMax} words (~${perSceneDurationMin}–${perSceneDurationMax}s)
- No scene may exceed ${perSceneWordsMax} words / ${perSceneDurationMax}s. Split if longer.`;

    const sceneGuidanceVideo = isVideo
        ? `
BEFORE YOU FINISH — TOTAL DURATION CHECK:
  Add up every scene: (number of 5s scenes × 5) + (number of 10s scenes × 10) = total seconds.
  Total MUST be ${tolerance.min}–${tolerance.max}s (user requested ${durationSeconds}s).
`
        : '';

    const sceneGuidance = `
MANDATORY SCENE COUNT:
You MUST create AT LEAST ${minScenes} scenes. Target: ${targetScenes} scenes.
${isVideo ? `Maximum ${maxScenes} scenes.` : ''}

THE MATH:
  ${targetScenes} scenes × ~${perSceneWordsTarget} words each = ~${totalWordsTarget} words total
  ${totalWordsTarget} words ÷ 2.5 words/sec = ~${durationSeconds} seconds
${sceneGuidanceVideo}

COMMON MISTAKE — generating too few scenes:
  ${wrongScenes} scenes × ~${perSceneWordsTarget} words = ~${wrongWords} words = only ~${wrongDuration}s
  You MUST write MORE scenes to fill ${durationSeconds} seconds.

SCENE RULES:
- MINIMUM ${minScenes} scenes, target ${targetScenes}, maximum ${maxScenes}
${durationRule}
- Every scene = a NEW visual.
`.trim();

    const videoWordLimit = isVideo
        ? `
- CRITICAL for video: 5s scene → at most ${VIDEO_NARRATION_WPS.maxWords5s} words. 10s scene → at most ${VIDEO_NARRATION_WPS.maxWords10s} words.`
        : '';
    const narrationGuidance = `
NARRATION (FLOWING CINEMATIC STORY):
- TOTAL WORDS REQUIRED: ${totalWordsMin}–${totalWordsMax} (target ~${totalWordsTarget} for ${durationSeconds}s)
- Per scene: ${perSceneWordsMin}–${perSceneWordsMax} words (target ~${perSceneWordsTarget})${videoWordLimit}
- The narration must read as ONE continuous flowing story.
- Scene breaks are for VISUAL changes — the narration never pauses between scenes.

NARRATION QUALITY:
- IMMERSIVE POV: Write as if the viewer IS there.
- MICRO-CLIFFHANGERS: End each scene on unresolved tension.
- SHOW DON'T TELL: Make viewer FEEL stakes.
- HOOK EVERY SCENE: Each narration pulls viewer into next.

SELF-CHECK BEFORE FINISHING:
1. Count your scenes. Is it ≥ ${minScenes}? If not, ADD more scenes.
2. Count total words across ALL narrations. Is it ~${totalWordsTarget}?${isVideo ? `\n3. For each scene: 5s → at most ${VIDEO_NARRATION_WPS.maxWords5s} words; 10s → at most ${VIDEO_NARRATION_WPS.maxWords10s} words.` : ''}
`.trim();

    return {
        durationSeconds,
        minScenes,
        targetScenes,
        maxScenes,
        totalWordsMin,
        totalWordsTarget,
        totalWordsMax,
        perSceneWordsMin,
        perSceneWordsTarget,
        perSceneWordsMax,
        perSceneDurationMin,
        perSceneDurationTarget,
        perSceneDurationMax,
        tolerance,
        allowedSceneDurations: isVideo ? VIDEO_ALLOWED_SCENE_DURATIONS : undefined,
        sceneGuidance,
        narrationGuidance,
    };
}
