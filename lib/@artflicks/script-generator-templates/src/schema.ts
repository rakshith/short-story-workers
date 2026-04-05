import { z } from "zod";
import { VIDEO_NARRATION_WPS } from "./constants";

export interface SchemaConstraints {
    minScenes: number;
    maxScenes?: number;
    totalWordsMin: number;
    totalWordsMax?: number;
    durationSeconds: number;
    mediaType?: 'image' | 'video';
}

const sceneDurationSchema = (mediaType?: 'image' | 'video') =>
    mediaType === 'video'
        ? z.union([z.literal(5), z.literal(10)]).describe('Scene duration in seconds. Must be exactly 5 or 10.')
        : z.number().describe('Estimated duration of this scene in seconds.');

const narrationDescribe = (base: string, mediaType?: 'image' | 'video') =>
    mediaType === 'video'
        ? `Word count must match scene duration: duration=5 → ${VIDEO_NARRATION_WPS.minWords5s}–${VIDEO_NARRATION_WPS.maxWords5s} words; duration=10 → ${VIDEO_NARRATION_WPS.minWords10s}–${VIDEO_NARRATION_WPS.maxWords10s} words. ${base}`
        : base;

const createYouTubeShortsSceneSchema = (mediaType?: 'image' | 'video') => {
    if (mediaType === 'video') {
        return z.object({
            sceneNumber: z.number().describe('Scene number in sequence'),
            duration: sceneDurationSchema(mediaType),
            narration: z.string().describe(narrationDescribe('Engaging voiceover narration for this scene.', mediaType)),
            imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English.'),
            cameraAngle: z.string().nullable().describe('Camera angle or shot type'),
            mood: z.string().nullable().describe('Emotional tone or atmosphere'),
            action: z.string().describe('Character action for video animation'),
            videoPrompt: z.string().describe('Detailed image-to-video animation prompt'),
        });
    }
    
    return z.object({
        sceneNumber: z.number().describe('Scene number in sequence'),
        duration: sceneDurationSchema(mediaType),
        narration: z.string().describe(narrationDescribe('Engaging voiceover narration for this scene.', mediaType)),
        imagePrompt: z.string().describe('SCROLL-STOPPING visual description in English.'),
        cameraAngle: z.string().nullable().describe('Camera angle or shot type'),
        mood: z.string().nullable().describe('Emotional tone or atmosphere'),
        action: z.string().describe('Character action for video animation'),
    });
};

const createCharacterStorySceneSchema = (mediaType?: 'image' | 'video') => {
    if (mediaType === 'video') {
        return z.object({
            sceneNumber: z.number().describe('Scene number in sequence'),
            duration: sceneDurationSchema(mediaType),
            narration: z.string().describe(narrationDescribe('Voiceover narration.', mediaType)),
            imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description.'),
            cameraAngle: z.string().describe('Camera angle for this scene'),
            mood: z.string().describe('Emotional tone of the scene'),
            action: z.string().describe('Character action for video animation'),
            videoPrompt: z.string().describe('Detailed image-to-video animation prompt'),
        });
    }
    
    return z.object({
        sceneNumber: z.number().describe('Scene number in sequence'),
        duration: sceneDurationSchema(mediaType),
        narration: z.string().describe(narrationDescribe('Voiceover narration.', mediaType)),
        imagePrompt: z.string().describe('CHARACTER-CENTRIC visual description.'),
        cameraAngle: z.string().describe('Camera angle for this scene'),
        mood: z.string().describe('Emotional tone of the scene'),
        action: z.string().describe('Character action for video animation'),
    });
};

const youtubeMetadataSchema = z.object({
    youtubeTitle: z.string().describe('SEO-optimized YouTube title, 60–70 characters.'),
    youtubeDescription: z.string().describe('YouTube description.'),
    hashtags: z.array(z.string()).min(6).max(8).describe('6–8 hashtags.'),
    thumbnailConcept: z.string().describe('One sentence describing the thumbnail.'),
    hookFormat: z.enum(['A', 'B', 'C', 'D']).describe('Hook format used in Scene 1.'),
});

export function createYouTubeShortsSchema(constraints: SchemaConstraints) {
    const { minScenes, maxScenes, totalWordsMin, totalWordsMax, durationSeconds, mediaType } = constraints;

    let scenesArray = z.array(createYouTubeShortsSceneSchema(mediaType))
        .min(minScenes, `Must have at least ${minScenes} scenes`);

    if (maxScenes) {
        scenesArray = scenesArray.max(maxScenes);
    }

    return z.object({
        title: z.string().describe('Short, punchy title (3-6 words).'),
        totalDuration: z.number().describe('Estimated total duration in seconds.'),
        scenes: scenesArray,
        metadata: youtubeMetadataSchema,
    });
}

export function createCharacterStorySchema(constraints: SchemaConstraints) {
    const { minScenes, maxScenes, totalWordsMin, totalWordsMax, durationSeconds, mediaType } = constraints;

    let scenesArray = z.array(createCharacterStorySceneSchema(mediaType))
        .min(minScenes, `Must have at least ${minScenes} scenes`);

    if (maxScenes) {
        scenesArray = scenesArray.max(maxScenes);
    }

    return z.object({
        title: z.string().describe('Compelling story title (4-8 words).'),
        totalDuration: z.number().describe('Estimated total duration in seconds.'),
        scenes: scenesArray,
        metadata: youtubeMetadataSchema,
    });
}

const createBodyScienceSceneSchema = () => z.object({
    sceneNumber: z.number().describe('Scene number in sequence'),
    narration: z.string().describe('STRICT: EXACTLY 10–12 words.'),
    imagePrompt: z.string().describe('Detailed text-to-image prompt.'),
    videoPrompt: z.string().describe('Detailed image-to-video animation prompt.'),
});

export function createBodyScienceShortsSchema(constraints: { minScenes: number; maxScenes?: number }) {
    return z.object({
        title: z.string().describe('Title starting with "What Happens To Your Body If…"'),
        scenes: z.array(createBodyScienceSceneSchema())
            .min(constraints.minScenes)
            .max(constraints.maxScenes ?? 20),
        fullNarration: z.string().describe('Complete separate narration block.'),
        metadata: youtubeMetadataSchema,
    });
}

export const YOUTUBE_SHORTS_SCHEMA = createYouTubeShortsSchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });
export const CHARACTER_STORY_SCHEMA = createCharacterStorySchema({ minScenes: 1, totalWordsMin: 1, durationSeconds: 0 });
export const BODY_SCIENCE_SHORTS_SCHEMA = createBodyScienceShortsSchema({ minScenes: 8 });
