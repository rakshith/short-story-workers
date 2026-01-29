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

export type TransitionPreset = 'crossfade' | 'zoom-pan' | 'zoom-out-pan' | 'bounce-pan' | 'blur-motion' | 'bounce-flash' | 'floating';

// Watermark Configuration Type
export interface WatermarkConfig {
  text?: string;
  variant?: 'gradient' | 'glass' | 'neon' | 'minimal';
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  opacity?: number;
  fontSize?: string;
  show?: boolean;
}

export type CaptionStylePreset =
  | 'beast'
  | 'tiktok'
  | 'bold-modern'
  | 'minimal'
  | 'serif-elegant'
  | 'retro-pop'
  | 'handwritten'
  | 'newspaper'
  | 'techno'
  | 'comic-book'
  | 'mono-terminal'
  | 'luxury'
  | 'stroke-outline'
  | 'stroke-gold'
  | 'stroke-pink'
  | 'stroke-green'
  | 'stroke-purple'
  | 'white-stroke';

export interface StoryCompositionProps {
  scenes: Scene[];
  backgroundMusic?: string;
  backgroundMusicVolume?: number;
  userTier?: 'free' | 'premium' | 'pro';
  showWatermark?: boolean;
  transitionPreset?: TransitionPreset; // Plug-and-play transition preset
  captionStylePreset?: CaptionStylePreset; // Caption style preset
  watermark?: WatermarkConfig; // Watermark configuration object
}

export type MediaType = 'image' | 'video';

export type UserTier = 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface VideoConfig {
  id?: string;
  mediaType?: MediaType;
  aspectRatio: string;
  model: string;
  preset: AIPresetItem;
  music: string;
  musicVolume?: number; // Added missing field
  script: string;
  voice: string;
  userId?: string;
  seriesId?: string;
  teamId?: string | null; // Team context for collaboration
  enableCaptions?: boolean; // Added missing field
  watermark?: WatermarkConfig; // Watermark configuration
  videoType: string;
  outputFormat: string;
  captionStylePreset?: CaptionStylePreset;
  transitionPreset?: TransitionPreset;
  language?: string;
  title?: string;
  prompt?: string;
  duration?: number;
  estimatedCredits?: number;
  durationInFrames?: number;
  userTier?: UserTier; // User tier for resource restrictions
  audioModel: string;
  resolution: string;
  templateId?: string;
  characterReferenceImages?: string[];
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
  videoConfig: VideoConfig;
  userId: string;
  seriesId: string;
  teamId: string;
  title: string;
  userTier?: UserTier; // User tier for resource restrictions
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
  CANCELLED: 'cancelled',
} as const;

export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];

