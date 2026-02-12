import {
    NARRATION_WPS,
    SCENE_COUNT_GUIDE,
    SCENE_DURATION_GUIDE,
    DURATION_TOLERANCE,
    VIDEO_SCENE_COUNT_GUIDE,
    VIDEO_SCENE_DURATION_GUIDE,
    VIDEO_ALLOWED_SCENE_DURATIONS,
    VIDEO_NARRATION_WPS,
} from '../constants';

// ═══════════════════════════════════════════════════════════════
// NARRATION-DRIVEN SCENE PLANNING
//
// The narration flows as ONE continuous cinematic story while
// visuals change every ~3 seconds. NOT a slideshow of facts.
//
// Think: documentary voiceover with rapid B-roll cuts.
// The voice never stops — the images keep changing underneath.
// ═══════════════════════════════════════════════════════════════

export interface ScenePlan {
    durationSeconds: number;

    // Scene count
    minScenes: number;
    targetScenes: number;
    maxScenes: number;

    // Total word count
    totalWordsMin: number;
    totalWordsTarget: number;
    totalWordsMax: number;

    // Per-scene word count
    perSceneWordsMin: number;
    perSceneWordsTarget: number;
    perSceneWordsMax: number;

    // Per-scene duration (seconds)
    perSceneDurationMin: number;
    perSceneDurationTarget: number;
    perSceneDurationMax: number;

    // Duration tolerance
    tolerance: { min: number; max: number };

    /** For video mode: only these durations are allowed (e.g. [5, 10]) */
    allowedSceneDurations?: readonly number[];

    // Pre-built prompt fragments
    sceneGuidance: string;
    narrationGuidance: string;
}

export function getScenePlan(durationSeconds: number, mediaType: 'image' | 'video' = 'image'): ScenePlan {
    // ---------- VALIDATION ----------
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error('durationSeconds must be a positive number.');
    }

    const allowed = [15, 30, 60, 120, 180];
    if (!allowed.includes(durationSeconds)) {
        throw new Error(
            `Unsupported duration. Allowed values: ${allowed.join(', ')}`
        );
    }

    // ---------- SELECT GUIDES BASED ON MEDIA TYPE ----------
    const isVideo = mediaType === 'video';
    const sceneCountGuide = isVideo ? VIDEO_SCENE_COUNT_GUIDE : SCENE_COUNT_GUIDE;
    const sceneDurationGuide = isVideo ? VIDEO_SCENE_DURATION_GUIDE : SCENE_DURATION_GUIDE;

    // ---------- SCENE COUNT ----------
    const sceneGuide = sceneCountGuide[durationSeconds] ?? {
        min: Math.max(3, Math.floor(durationSeconds / (isVideo ? 10 : 4))),
        target: Math.round(durationSeconds / (isVideo ? 7 : 3)),
        max: Math.ceil(durationSeconds / (isVideo ? 5 : 2.5)),
    };

    const { min: minScenes, target: targetScenes, max: maxScenes } = sceneGuide;

    // ---------- TOTAL WORD COUNT ----------
    // Video: require ~12 words per scene average so we don't accept bare minimum (9+9). Cap max at achievable (all 10s).
    const totalWordsMin = isVideo
        ? minScenes * 12
        : Math.round(durationSeconds * NARRATION_WPS.min);
    const totalWordsTarget = Math.round(durationSeconds * NARRATION_WPS.target);
    const totalWordsMax = Math.round(durationSeconds * NARRATION_WPS.max);

    // ---------- PER-SCENE WORD COUNT ----------
    // Hard cap: max words per scene = max duration × max WPS
    const absoluteMaxWordsPerScene = Math.round(sceneDurationGuide.max * NARRATION_WPS.max);  // image: 4×2.8=~11, video: 10×2.8=~28
    const perSceneWordsTarget = Math.round(totalWordsTarget / targetScenes);
    const perSceneWordsMin = Math.max(5, Math.round(totalWordsMin / maxScenes));
    const perSceneWordsMax = Math.min(
        absoluteMaxWordsPerScene,
        Math.round(totalWordsMax / minScenes)
    );

    // ---------- PER-SCENE DURATION ----------
    const perSceneDurationTarget = sceneDurationGuide.target;   // image: 3s, video: 7s
    const perSceneDurationMin = sceneDurationGuide.min;         // image: 2s, video: 5s
    const perSceneDurationMax = sceneDurationGuide.max;         // image: 4s, video: 10s

    // ---------- DURATION TOLERANCE ----------
    const tolerance = DURATION_TOLERANCE[durationSeconds] ?? {
        min: durationSeconds - 5,
        max: durationSeconds + 5,
    };

    // ---------- PROMPT FRAGMENTS ----------

    // Concrete math example for the LLM to see
    const wrongScenes = Math.round(targetScenes * 0.55);  // typical under-generation
    const wrongWords = wrongScenes * perSceneWordsTarget;
    const wrongDuration = Math.round(wrongWords / NARRATION_WPS.target);

    const durationRule = isVideo
        ? `- Each scene duration must be exactly 5 or exactly 10 seconds (no other values). Sum of scene durations ≈ ${durationSeconds}s.
- NARRATION MUST FIT THE SCENE (voice-over and captions must never exceed scene duration): 5s scene = ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words at ${VIDEO_NARRATION_WPS.wps5s} wps (never exceed ${VIDEO_NARRATION_WPS.maxWords5s} or audio exceeds 5s). 10s scene = ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words at ${VIDEO_NARRATION_WPS.wps10s} wps (never exceed ${VIDEO_NARRATION_WPS.maxWords10s} or audio exceeds 10s).`
        : `- Each scene: ${perSceneWordsMin}–${perSceneWordsMax} words (~${perSceneDurationMin}–${perSceneDurationMax}s)
- No scene may exceed ${perSceneWordsMax} words / ${perSceneDurationMax}s. Split if longer.
- Mix short ${perSceneDurationMin}s punch scenes with ${perSceneDurationTarget}–${perSceneDurationMax}s story scenes.`;

    const sceneGuidance = `
⚠️⚠️⚠️ MANDATORY SCENE COUNT ⚠️⚠️⚠️
You MUST create AT LEAST ${minScenes} scenes. Target: ${targetScenes} scenes.

THE MATH (do this check before you finish):
  ${targetScenes} scenes × ~${perSceneWordsTarget} words each = ~${totalWordsTarget} words total
  ${totalWordsTarget} words ÷ 2.5 words/sec = ~${durationSeconds} seconds ✓

COMMON MISTAKE — generating too few scenes:
  ${wrongScenes} scenes × ~${perSceneWordsTarget} words = ~${wrongWords} words = only ~${wrongDuration}s ❌ (HALF the target!)
  You MUST write MORE scenes to fill ${durationSeconds} seconds.

SCENE RULES:
- MINIMUM ${minScenes} scenes, target ${targetScenes}, maximum ${maxScenes}
${durationRule}
- Every scene = a NEW visual. ${targetScenes} scenes = ${targetScenes} unique images.
`.trim();

    const videoWordLimit = isVideo
        ? `
- CRITICAL for video (audio/captions must never exceed scene duration): 5s scene → at most ${VIDEO_NARRATION_WPS.maxWords5s} words (${VIDEO_NARRATION_WPS.wps5s} wps). 10s scene → at most ${VIDEO_NARRATION_WPS.maxWords10s} words (${VIDEO_NARRATION_WPS.wps10s} wps).`
        : '';
    const narrationGuidance = `
NARRATION (FLOWING CINEMATIC STORY — NOT A SLIDESHOW):
- TOTAL WORDS REQUIRED: ${totalWordsMin}–${totalWordsMax} (target ~${totalWordsTarget} for ${durationSeconds}s)
- Per scene: ${perSceneWordsMin}–${perSceneWordsMax} words (target ~${perSceneWordsTarget})${videoWordLimit}
- The narration must read as ONE continuous flowing story when all scenes are read aloud together.
- Scene breaks are for VISUAL changes — the narration never "pauses" or "resets" between scenes.
- Each scene's last words should naturally flow into the next scene's first words.
- Think: documentary voiceover with rapid B-roll cuts underneath.

SELF-CHECK BEFORE FINISHING:
1. Count your scenes. Is it ≥ ${minScenes}? If not, ADD more scenes.
2. Count total words across ALL narrations. Is it ~${totalWordsTarget}? If not, ADD more scenes.
3. Total words ÷ 2.5 ≈ ${durationSeconds}s? If way under, you need MORE scenes.${isVideo ? `\n4. For each scene: 5s → at most ${VIDEO_NARRATION_WPS.maxWords5s} words; 10s → at most ${VIDEO_NARRATION_WPS.maxWords10s} words (never exceed or audio exceeds scene).` : ''}
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
