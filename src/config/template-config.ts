// Template-specific pipeline configuration
// Controls what gets generated (audio, video, images) and which models to use

export interface TemplatePipelineConfig {
  generateAudio: boolean;     // Whether to generate audio for this template
  imageModel?: string;        // Optional - uses system default if not provided
  videoModel?: string;        // Optional - uses system default if not provided
  usesGeneratedImage?: boolean; // Use image generated from imagePrompt for video (not characterReferenceImages)
  includeNarrationInVideoPrompt?: boolean; // Append narration to videoPrompt for models like Veo
}

// Default configs for each template
export const TEMPLATE_CONFIGS: Record<string, TemplatePipelineConfig> = {
  // Templates that use standard StoryTimeline format
  "faceless-video": {
    generateAudio: true, // Caption/Voiceover narration 
  },
  "character-story": {
    generateAudio: true,// Caption/Voiceover narration 
    usesGeneratedImage: true,
  },
  "skeleton-3d-shorts": {
    generateAudio: true,// Caption/Voiceover narration 
    usesGeneratedImage: true,
  },
  "body-science-shorts": {
    generateAudio: true, // Caption/Voiceover narration 
    usesGeneratedImage: true,
  },
  "script-to-shorts": {
    generateAudio: true, // Caption/Voiceover narration 
  },
  
  // Templates that use scene-adapter format (raw output)
  "talking-character-3d": {
    generateAudio: false, // No narration for this template - just raw video output and embedded dialogue thats it
    videoModel: "google/veo-3.1-fast", // Template default (fallback only - client request takes priority)
    usesGeneratedImage: true,
    includeNarrationInVideoPrompt: true,
  },
};

// Get config for a template (returns undefined if not found - uses system defaults)
export function getTemplateConfig(templateId?: string): TemplatePipelineConfig | undefined {
  if (!templateId) return undefined;
  return TEMPLATE_CONFIGS[templateId];
}

// Check if template uses scene-adapter format (needs conversion)
export const SCENE_ADAPTER_TEMPLATES = [
  "talking-character-3d",
];

export function isSceneAdapterTemplate(templateId?: string): boolean {
  if (!templateId) return false;
  return SCENE_ADAPTER_TEMPLATES.includes(templateId);
}