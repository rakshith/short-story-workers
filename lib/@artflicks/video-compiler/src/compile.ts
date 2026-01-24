import { Story, VideoConfig, Timeline, StoryAdapter } from './types';
import { SceneAdapter } from './adapters';

const adapters: StoryAdapter[] = [new SceneAdapter()];

export function compile({ story, videoConfig }: { story: Story; videoConfig: VideoConfig }): Timeline {
  const adapter = adapters.find((a) => a.supports(story));

  if (!adapter) {
    throw new Error('No adapter found. Story must have a scenes array with at least one scene.');
  }

  return adapter.toTimeline(story, videoConfig);
}
