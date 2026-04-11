// Scene adapter mapper - converts template-specific scenes to timeline format

import { 
  SceneAdapterOutput, 
  TalkingCharacterScene,
  BaseScene 
} from "../types/template-scenes";
import { StoryTimeline, Scene } from "../types";

export function mapToTimeline(
  adapterOutput: SceneAdapterOutput,
  templateId: string
): StoryTimeline {
  switch (templateId) {
    case "talking-character-3d":
      return mapTalkingCharacterScene(adapterOutput as SceneAdapterOutput<TalkingCharacterScene>);
    case "faceless-video":
    case "character-story":
    case "skeleton-3d-shorts":
    case "body-science-shorts":
      return mapStandardScene(adapterOutput);
    default:
      return mapStandardScene(adapterOutput);
  }
}

function mapTalkingCharacterScene(
  output: SceneAdapterOutput<TalkingCharacterScene>
): StoryTimeline {
  const scenes: Scene[] = output.scenes.map((scene, index) => ({
    sceneNumber: index + 1,
    duration: scene.duration,
    narration: scene.dialogue, // Map dialogue to narration for timeline
    details: scene.environment, // Map environment to details
    imagePrompt: scene.imagePrompt,
    videoPrompt: scene.videoPrompt || "",
    cameraAngle: scene.camera.type,
    mood: scene.mood,
    action: "",
  }));

  return {
    id: "",
    title: output.title || "",
    totalDuration: output.scenes.reduce((sum, s) => sum + s.duration, 0),
    characterAnchor: null,
    scenes,
  };
}

function mapStandardScene(
  output: SceneAdapterOutput<BaseScene>
): StoryTimeline {
  const scenes: Scene[] = output.scenes.map((scene, index) => {
    // Handle both id (string) and sceneNumber (number)
    const sceneNum = typeof scene.id === 'number' ? scene.id : index + 1;
    
    // Handle camera as either object or string
    let cameraAngle = "";
    if (typeof scene.camera === 'object' && scene.camera !== null) {
      cameraAngle = scene.camera.type || "";
    } else if (typeof scene.camera === 'string') {
      cameraAngle = scene.camera;
    }

    return {
      sceneNumber: sceneNum,
      duration: scene.duration,
      narration: (scene as any).narration || (scene as any).dialogue || "",
      details: (scene as any).details || (scene as any).environment || "",
      imagePrompt: scene.imagePrompt,
      videoPrompt: scene.videoPrompt || "",
      cameraAngle,
      mood: scene.mood,
      action: (scene as any).action || "",
    };
  });

  return {
    id: "",
    title: output.title || "",
    totalDuration: output.totalDuration || output.scenes.reduce((sum, s) => sum + s.duration, 0),
    characterAnchor: null,
    scenes,
  };
}

export function getSceneCount(output: SceneAdapterOutput): number {
  return output.scenes.length;
}

export function getTotalDuration(output: SceneAdapterOutput): number {
  return output.totalDuration || output.scenes.reduce((sum, s) => sum + s.duration, 0);
}