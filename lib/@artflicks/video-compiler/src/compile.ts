import { Story, VideoConfig, Timeline, StoryAdapter } from './types';
import { TalkingAvatarAdapter, SceneAdapter } from './adapters';

// TalkingAvatarAdapter first — it's more specific (single scene + enableAvatarAudio)
const adapters: StoryAdapter[] = [new TalkingAvatarAdapter(), new SceneAdapter()];

export function compile({ story, videoConfig }: { story: Story; videoConfig: VideoConfig }): Timeline {
  const adapter = adapters.find((a) => a.supports(story, videoConfig));

  if (!adapter) {
    throw new Error('No adapter found. Story must have a scenes array with at least one scene.');
  }

  return adapter.toTimeline(story, videoConfig);
}
