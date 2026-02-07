// Type definitions for @artflicks/video-compiler

export interface TimelineItem {
  start: number;
  end: number;
  payload: any;
}

export interface Timeline {
  duration: number;
  tracks: {
    visual: TimelineItem[];
    audio: TimelineItem[];
    text: TimelineItem[];
    effects?: TimelineItem[];
  };
}

export interface Story {
  id?: string;
  title?: string;
  scenes: Array<{
    sceneNumber: number;
    duration: number;
    narration?: string;
    audioUrl?: string;
    audioDuration?: number;
    imagePrompt?: string;
    generatedImageUrl?: string;
    generatedVideoUrl?: string;
    captions?: Array<{
      text: string;
      tokens?: Array<{
        text: string;
        startTime: number;
        endTime: number;
      }>;
      startTime?: number;
      endTime?: number;
    }>;
  }>;
  totalDuration: number;
}

export interface VideoConfig {
  preset?: {
    id: string;
  };
  music?: string;
  musicVolume?: number;
  enableCaptions?: boolean;
  captionStylePreset?: string;
  watermark?: {
    show: boolean;
    text: string;
    variant: string;
  };
}

export interface StoryAdapter {
  supports(story: any): boolean;
  toTimeline(story: Story, videoConfig: VideoConfig): Timeline;
}
