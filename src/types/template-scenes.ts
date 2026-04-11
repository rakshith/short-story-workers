// Template-specific scene types for ArtFlicks script generation
// Extensible architecture for multiple templates

export interface CameraConfig {
  type: string;
  movement: string;
}

// Base scene - common attributes across all templates
export interface BaseScene {
  id: string | number;
  duration: number;
  imagePrompt: string;
  videoPrompt?: string;
  camera: CameraConfig;
  mood: string;
}

// Talking Character 3D template scene
export interface TalkingCharacterScene extends BaseScene {
  type: "entry" | "main" | "transformation" | "damage" | "reaction" | "warning";
  dialogue: string;
  character: {
    name: string;
    traits: string[];
  };
  environment: string;
}

// Faceless Video template scene
export interface FacelessVideoScene extends BaseScene {
  sceneNumber: number;
  narration: string;
  action: string;
  details?: string;
}

// Character Story template scene
export interface CharacterStoryScene extends BaseScene {
  sceneNumber: number;
  narration: string;
  action: string;
  details?: string;
  character?: {
    name: string;
    description: string;
  };
}

// Skeleton 3D Shorts template scene
export interface Skeleton3DShortsScene extends BaseScene {
  sceneNumber: number;
  narration: string;
  action: string;
  details?: string;
}

// Body Science Shorts template scene
export interface BodyScienceShortsScene extends BaseScene {
  sceneNumber: number;
  narration: string;
  action: string;
  details?: string;
}

// Scene adapter output types
export type SceneAdapterScene = 
  | TalkingCharacterScene 
  | FacelessVideoScene 
  | CharacterStoryScene 
  | Skeleton3DShortsScene 
  | BodyScienceShortsScene
  | BaseScene;

export interface SceneAdapterOutput<T extends SceneAdapterScene = SceneAdapterScene> {
  type: "single_scene" | "multi_scene";
  scenes: T[];
  // Optional title for some templates
  title?: string;
  // Optional total duration
  totalDuration?: number;
}

// Template IDs
export type TemplateId = 
  | "faceless-video" 
  | "character-story" 
  | "skeleton-3d-shorts" 
  | "body-science-shorts" 
  | "talking-character-3d"
  | "script-to-shorts";

// Template to scene type mapping
export type SceneTypeForTemplate<T extends TemplateId> = 
  T extends "talking-character-3d" ? TalkingCharacterScene :
  T extends "faceless-video" ? FacelessVideoScene :
  T extends "character-story" ? CharacterStoryScene :
  T extends "skeleton-3d-shorts" ? Skeleton3DShortsScene :
  T extends "body-science-shorts" ? BodyScienceShortsScene :
  BaseScene;