import { Story, VideoConfig, Timeline, StoryAdapter } from './types';
import { TalkingAvatarAdapter, AiUgcAdsAdapter, SceneAdapter } from './adapters';

// Adapter priority: most specific first
// 1. TalkingAvatarAdapter — single scene + enableAvatarAudio
// 2. AiUgcAdsAdapter — ai-ugc-ads workflow (product display strategies)
// 3. SceneAdapter — fallback for all other stories
const adapters: StoryAdapter[] = [
  new TalkingAvatarAdapter(),
  new AiUgcAdsAdapter(),
  new SceneAdapter(),
];

export function compile({ story, videoConfig }: { story: Story; videoConfig: VideoConfig }): Timeline {
  const adapter = adapters.find((a) => a.supports(story, videoConfig));

  if (!adapter) {
    throw new Error('No adapter found. Story must have a scenes array with at least one scene.');
  }

  return adapter.toTimeline(story, videoConfig);
}
