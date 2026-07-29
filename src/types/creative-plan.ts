// Creative Plan types — Output of AI Director Agent
// The AI Director replaces VisionAgent + ClassificationAgent + ScriptAgent
// with a single coherent creative decision

export type CreativeFreedom = 'conservative' | 'balanced' | 'bold' | 'experimental';

export type SceneType = 'intro' | 'demo' | 'outro' | 'feature' | 'proof';

export type VideoStrategy = 'luxury-fullscreen' | 'simple-composite' | 'unusable' | 'not-applicable';

export type DetectedAspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | 'other';

export type ProductAudioHandling = 'replace' | 'mix' | 'strip';

export interface VideoEvent {
  start: string;
  end: string;
  eventType: string;
  naturalDescription: string;
}

export interface CreativeScene {
  sceneNumber: number;
  sceneType: SceneType;
  duration: number;
  narration: string;
  shotDescription: string;
  cameraStyle: string;
  // SaaS explainer: trim range for the uploaded demo video segment this scene covers
  // Only set for demo scenes when videoEvents are present (auto-detected SaaS screen recordings)
  sourceStart: number | null;  // seconds into the source video
  sourceEnd: number | null;    // seconds into the source video
}

export interface VideoProductAnalysis {
  videoStrategy: VideoStrategy;
  bestProductTimestamp: string;
  videoComplexityScore: number;
  detectedAspectRatio: DetectedAspectRatio;
  // SaaS explainer: meaningful on-screen events extracted by Gemini vision
  // Present only when vision auto-detected a SaaS screen recording
  videoEvents?: VideoEvent[];
  videoDurationSeconds?: number;
}

export interface CreativePlan {
  title: string;
  inference: {
    productCategory: string;
    audience: string;
    adFormat: string;
    brandTone: string;
    visualStyle: string;
    productType: 'physical' | 'screenshot' | 'screen-recording' | 'mixed';
  };
  story: {
    scenes: CreativeScene[];
    totalDuration: number;
    pacing: 'slow' | 'medium' | 'fast';
    transitionStyle: string;
  };
  requirements: {
    needsComposite: boolean;
    needsAvatarVideo: boolean;
    needsVoiceover: boolean;
    needsMusic: boolean;
  };
  videoProductAnalysis: VideoProductAnalysis;
}

export interface ModelPlan {
  image: {
    model: string;
    reason: string;
  };
  avatar: {
    model: 'standard' | 'pro' | 'omnihuman';
    reason: string;
  };
  voice: {
    model: string;
    reason: string;
  };
  video: {
    model: string;      // FAL endpoint (e.g., 'fal-ai/wan/v2.7/image-to-video')
    resolution: string; // '720p' | '1080p'
    variant: string;    // 'mini' | 'fast' | 'standard' | 'default'
    modelKey: string;   // Key from decision tree (e.g., 'wan-2.7-720p')
    audioInput: 'driving_audio' | 'native';  // driving_audio = ElevenLabs TTS, native = model's own audio
    audioParam: 'audio_url' | 'audio_urls';  // Parameter name for audio input
    audioArray?: boolean;                     // If true, audioParam expects array format
    generateAudio?: boolean;                  // For Seedance: set false when using driving_audio
    reason: string;
  };
}

export function mapSliderToFreedom(value: number): CreativeFreedom {
  if (value <= 25) return 'conservative';
  if (value <= 50) return 'balanced';
  if (value <= 75) return 'bold';
  return 'experimental';
}
