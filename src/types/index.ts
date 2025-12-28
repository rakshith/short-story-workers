// Types for the create-story worker

export interface CaptionToken {
  text: string;
  startTime: number;
  endTime: number;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  enabled?: boolean;
}

export interface Caption {
  text: string;
  startTime: number;
  endTime: number;
  timestampMs?: number | null;
  confidence?: number | null;
  tokens?: CaptionToken[];
}

export interface Scene {
  model?: string;
  sceneNumber: number;
  duration: number;
  details: string;
  narration: string;
  imagePrompt: string;
  cameraAngle: string;
  mood: string;
  // Image generation tracking
  generatedImageUrl?: string;
  isGenerating?: boolean;
  generationError?: string;
  // Video generation tracking (image-to-video)
  generatedVideoUrl?: string;
  isGeneratingVideo?: boolean;
  videoGenerationError?: string;
  // Voice-over and captions
  audioUrl?: string; // Generated voice-over audio URL
  audioDuration?: number; // Actual duration of generated audio
  captions?: Caption[]; // Timed captions for this scene
  isGeneratingAudio?: boolean;
  audioGenerationError?: string;
  playbackRate?: number; // Audio playback rate for time scaling
}

export interface StoryTimeline {
  id: string;
  title: string;
  totalDuration: number;
  scenes: Scene[];
}

export interface AIPresetItem {
  id: string;
  name: string;
  stylePrompt: string;
  seed?: number;
}

export interface CreateStoryRequest {
  script: string | StoryTimeline;
  videoConfig: {
    videoType?: string;
    mediaType?: 'image' | 'video';
    preset: AIPresetItem;
    model: string;
    music: string;
    musicVolume?: number;
    voice: string;
    aspectRatio: string;
    outputFormat?: string;
    enableCaptions?: boolean;
    watermark?: any;
    captionStylePreset?: any;
    transitionPreset?: string;
    language?: string;
    estimatedCredits?: number;
  };
  userId: string;
  seriesId: string;
  teamId: string;
  title: string;
}

export interface CreateStoryResponse {
  success: boolean;
  story?: any;
  stats?: {
    totalScenes: number;
    imagesGenerated: number;
    audioGenerated: number;
  };
  error?: string;
  details?: string;
}

export type AspectRatio = '16:9' | '1:1' | '9:16';

export const ProjectStatus = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];

