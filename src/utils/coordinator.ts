/**
 * Durable Object coordinator helpers.
 *
 * Centralises the raw HTTP calls to the StoryCoordinator DO so that
 * callers don't have to hand-build Request objects or parse the JSON
 * response themselves.
 */

export interface CoordinatorUpdateResult {
    success: boolean;
    isComplete: boolean;
    isImagesCompleteForReview?: boolean;
    imagesCompleted: number;
    videosCompleted: number;
    audioCompleted: number;
    totalScenes: number;
    isCancelled?: boolean;
    /** True when both the generated image URL and the real audio duration are present for this scene */
    isSceneReadyForVideo?: boolean;
    /** The generated image URL stored on this scene in the DO */
    sceneImageUrl?: string | null;
    /** The real ElevenLabs audio duration stored on this scene (seconds) */
    sceneAudioDuration?: number;
}

export interface CoordinatorProgressResult {
    imagesCompleted: number;
    videosCompleted: number;
    audioCompleted: number;
    totalScenes: number;
    isComplete: boolean;
    completionSignaled: boolean;
    isCancelled: boolean;
    scenes: any[];
    videoConfig?: any;
}

export interface CoordinatorFinalizeResult {
    success: boolean;
    isComplete: boolean;
    storyId?: string;
    userId?: string;
    scenes: any[];
    imagesCompleted: number;
    videosCompleted: number;
    audioCompleted: number;
    timeline?: any;
}

export interface InitCoordinatorParams {
    storyId: string;
    userId: string;
    scenes: any[];
    totalScenes: number;
    videoConfig: any;
    sceneReviewRequired?: boolean;
    skipAudioCheck?: boolean;
}

export interface UpdateImageParams {
    sceneIndex: number;
    imageUrl?: string | null;
    imageError?: string;
}

export interface UpdateVideoParams {
    sceneIndex: number;
    videoUrl?: string | null;
    videoError?: string;
}

export interface UpdateAudioParams {
    sceneIndex: number;
    audioUrl?: string | null;
    audioDuration?: number;
    captions?: any[];
    audioError?: string;
}

export async function initCoordinator(
    coordinator: any,
    params: InitCoordinatorParams
): Promise<void> {
    await coordinator.fetch(new Request('http://do/init', {
        method: 'POST',
        body: JSON.stringify(params),
    }));
}

export async function updateCoordinatorImage(
    coordinator: any,
    params: UpdateImageParams
): Promise<CoordinatorUpdateResult> {
    const res = await coordinator.fetch(new Request('http://do/updateImage', {
        method: 'POST',
        body: JSON.stringify(params),
    }));
    return res.json() as Promise<CoordinatorUpdateResult>;
}

export async function updateCoordinatorVideo(
    coordinator: any,
    params: UpdateVideoParams
): Promise<CoordinatorUpdateResult> {
    const res = await coordinator.fetch(new Request('http://do/updateVideo', {
        method: 'POST',
        body: JSON.stringify(params),
    }));
    return res.json() as Promise<CoordinatorUpdateResult>;
}

export async function updateCoordinatorAudio(
    coordinator: any,
    params: UpdateAudioParams
): Promise<CoordinatorUpdateResult> {
    const res = await coordinator.fetch(new Request('http://do/updateAudio', {
        method: 'POST',
        body: JSON.stringify(params),
    }));
    return res.json() as Promise<CoordinatorUpdateResult>;
}

export async function getCoordinatorProgress(
    coordinator: any
): Promise<CoordinatorProgressResult> {
    const res = await coordinator.fetch(new Request('http://do/getProgress', { method: 'POST' }));
    return res.json() as Promise<CoordinatorProgressResult>;
}

export async function finalizeCoordinator(
    coordinator: any
): Promise<CoordinatorFinalizeResult> {
    const res = await coordinator.fetch(new Request('http://do/finalize', { method: 'POST' }));
    return res.json() as Promise<CoordinatorFinalizeResult>;
}

export async function cancelCoordinator(
    coordinator: any
): Promise<void> {
    await coordinator.fetch(new Request('http://do/cancel', { method: 'POST' }));
}
