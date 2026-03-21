import { Scene } from '../types';

const IMAGE_GEN_BASE_MS = 20000;
const AUDIO_GEN_BASE_MS = 15000;
const COMPILATION_BASE_MS = 15000;
const VIDEO_STAGGER_MS = 60000;

const VIDEO_MODEL_BASE_MS: Record<string, number> = {
    'kling': 45000,
    'veo': 60000,
    'wan': 50000,
    'sora': 70000,
    'default': 55000,
};

export function estimateGenerationMs(
    scenes: Scene[],
    videoModel: string
): number {
    if (scenes.length === 0) {
        return COMPILATION_BASE_MS;
    }

    const sceneDurations = scenes.map(s => s.duration ?? 5);
    const maxSceneDuration = Math.max(...sceneDurations);

    const modelKey = Object.keys(VIDEO_MODEL_BASE_MS)
        .find(k => videoModel.toLowerCase().includes(k)) ?? 'default';
    const modelBase = VIDEO_MODEL_BASE_MS[modelKey];

    const videoTime = modelBase + (maxSceneDuration * 1000);
    const staggerTime = VIDEO_STAGGER_MS;

    const parallelPhase = Math.max(IMAGE_GEN_BASE_MS, AUDIO_GEN_BASE_MS);
    const total = Math.max(parallelPhase, videoTime + staggerTime) + COMPILATION_BASE_MS;

    return Math.ceil(total / 1000);
}

export function estimateGenerationSeconds(
    scenes: Scene[],
    videoModel: string
): number {
    return estimateGenerationMs(scenes, videoModel);
}
