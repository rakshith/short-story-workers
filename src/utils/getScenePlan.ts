import { SCENE_WORD_LIMITS, DURATION_TOLERANCE } from '../config/narration-styles';

export type SceneDuration = 5 | 10;

export interface SceneItem {
  index: number;
  duration: SceneDuration;
  maxWords: number;     // narration word cap
  guidance: string;     // narration style
  isIntro?: boolean;
  isOutro?: boolean;
}

export interface ScenePlan {
  durationSeconds: number;
  num5sScenes: number;
  num10sScenes: number;
  totalScenes: number;
  sceneDuration: string;
  sceneGuidance: string;
  narrationGuidance: string;
  sceneTimeline: SceneItem[];
  // Word count limits (flexible ranges)
  min5: number;
  tgt5: number;
  max5: number;
  min10: number;
  tgt10: number;
  max10: number;
  // Duration tolerance
  tolerance: { min: number; max: number };
}

interface Options {
  intro?: boolean;              // default: false
  outro?: boolean;              // default: false
  randomizeOrder?: boolean;     // default: false
}

export function getScenePlan(
  durationSeconds: number,
  options: Options = {}
): ScenePlan {

  const {
    intro = false,
    outro = false,
    randomizeOrder = false,
  } = options;

  // Get flexible word limits for each scene type
  const limits5 = SCENE_WORD_LIMITS.SCENE_5S;
  const limits10 = SCENE_WORD_LIMITS.SCENE_10S;

  // ---------- VALIDATION ----------
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("durationSeconds must be a positive number.");
  }

  const allowed = [15, 30, 60, 120, 180];
  if (!allowed.includes(durationSeconds)) {
    throw new Error(
      `Unsupported duration. Allowed values: ${allowed.join(", ")}`
    );
  }

  let num5sScenes = 0;
  let num10sScenes = 0;

  // ---------- DYNAMIC SCENE CALCULATION ----------
  // For short videos (≤30s): use only 5s scenes for snappy pacing
  // For longer videos: mix 5s and 10s scenes
  if (durationSeconds <= 30) {
    // All 5s scenes for short videos
    num5sScenes = durationSeconds / 5;
  } else {
    // For longer videos, use a strategic mix:
    // - Aim for roughly 1/3 of SCENES being 10s (not 1/3 of time)
    // - This creates better pacing with punchy 5s and richer 10s scenes

    // Calculate total if all were 5s scenes
    const allFives = durationSeconds / 5;

    // Convert roughly 1/3 of those to 10s (each 10s replaces two 5s)
    num10sScenes = Math.floor(allFives / 3);

    // Remaining time goes to 5s scenes
    const remaining = durationSeconds - (num10sScenes * 10);
    num5sScenes = remaining / 5;
  }

  let totalScenes = num5sScenes + num10sScenes;

  // ---------- OPTIONAL INTRO/OUTRO ----------
  // They count as scenes but remain fixed at 5 seconds
  if (intro) {
    num5sScenes++;
    totalScenes++;
  }

  if (outro) {
    num5sScenes++;
    totalScenes++;
  }

  // ---------- SCENE DURATION TEXT ----------
  let sceneDuration: string;
  if (num5sScenes && num10sScenes)
    sceneDuration = `exactly 5 seconds OR exactly 10 seconds (use ${num5sScenes}× 5s + ${num10sScenes}× 10s)`;
  else if (num5sScenes)
    sceneDuration = `exactly 5 seconds`;
  else
    sceneDuration = `exactly 10 seconds`;

  // ---------- STRICT RULE TEXT ----------
  const baseStrict = `
STRICT REQUIREMENT:
Create EXACTLY ${totalScenes} scenes totaling EXACTLY ${durationSeconds} seconds.
`.trim();

  const sceneGuidance =
    durationSeconds <= 30
      ? `${baseStrict}
Each scene must be EXACTLY 5 seconds.
Do NOT create more or fewer scenes or exceed ${durationSeconds}s.`
      : `${baseStrict}
Use EXACTLY ${num5sScenes} scenes of 5 seconds 
and EXACTLY ${num10sScenes} scenes of 10 seconds.
Do NOT exceed ${durationSeconds} seconds total.`.trim();

  // ---------- WORD COUNT LIMITS (flexible ranges) ----------
  const min5 = limits5.min;     // 10 words min
  const tgt5 = limits5.target;  // 13 words target
  const max5 = limits5.max;     // 15 words max
  const min10 = limits10.min;   // 20 words min
  const tgt10 = limits10.target; // 26 words target
  const max10 = limits10.max;   // 30 words max

  // ---------- DURATION TOLERANCE ----------
  const tolerance = DURATION_TOLERANCE[durationSeconds] || { min: durationSeconds - 2, max: durationSeconds + 4 };

  // ---------- NARRATION RULES ----------
  const narrationGuidance =
    num5sScenes > 0 && num10sScenes > 0
      ? `
For 5s scenes: MINIMUM ${min5} words, TARGET ${tgt5} words (2-3 sentences).
For 10s scenes: MINIMUM ${min10} words, TARGET ${tgt10} words (4-5 sentences).
Narration MUST fill 90-100% of the scene duration.`.trim()
      : num10sScenes > 0
        ? `
Use MINIMUM ${min10} words, TARGET ${tgt10} words per scene (4-5 sentences).
Narration MUST fill 90-100% of the 10-second scene duration.`.trim()
        : `
Use MINIMUM ${min5} words, TARGET ${tgt5} words per scene (2-3 sentences).
Narration MUST fill 90-100% of the 5-second scene duration.`.trim();

  // ---------- WORD COUNT RULES ----------
  const getWordCap = (duration: SceneDuration) =>
    duration === 5 ? tgt5 : tgt10;

  const getStyle = (duration: SceneDuration) =>
    duration === 5
      ? "Short, focused narration describing one key visual moment."
      : "Slightly richer narration with context or emotion.";

  // ---------- BUILD STRUCTURED TIMELINE ----------
  let timeline: SceneItem[] = [];

  // INTRO (FIRST)
  if (intro) {
    timeline.push({
      index: 1,
      duration: 5,
      maxWords: getWordCap(5),
      guidance: "Hook the viewer. One short sentence.",
      isIntro: true
    });
  }

  // CORE 5s
  for (let i = 0; i < (intro ? num5sScenes - 1 : num5sScenes); i++) {
    timeline.push({
      index: timeline.length + 1,
      duration: 5,
      maxWords: getWordCap(5),
      guidance: getStyle(5)
    });
  }

  // CORE 10s
  for (let i = 0; i < num10sScenes; i++) {
    timeline.push({
      index: timeline.length + 1,
      duration: 10,
      maxWords: getWordCap(10),
      guidance: getStyle(10)
    });
  }

  // OUTRO (LAST)
  if (outro) {
    timeline.push({
      index: timeline.length + 1,
      duration: 5,
      maxWords: getWordCap(5),
      guidance: "Clear closing thought or CTA.",
      isOutro: true
    });
  }

  // ---------- OPTIONAL RANDOM ORDER ----------
  if (randomizeOrder) {
    const core = timeline.filter(s => !s.isIntro && !s.isOutro);
    for (let i = core.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [core[i], core[j]] = [core[j], core[i]];
    }

    timeline = [
      ...timeline.filter(s => s.isIntro),
      ...core.map((s, idx) => ({ ...s, index: idx + 2 })),
      ...timeline.filter(s => s.isOutro).map((s, i) => ({
        ...s,
        index: core.length + 2 + i
      }))
    ];
  }

  return {
    durationSeconds,
    num5sScenes,
    num10sScenes,
    totalScenes,
    sceneDuration,
    sceneGuidance,
    narrationGuidance,
    sceneTimeline: timeline,
    // Word count limits (flexible ranges)
    min5,
    tgt5,
    max5,
    min10,
    tgt10,
    max10,
    tolerance,
  };
}
