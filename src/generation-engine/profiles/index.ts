// Profile exports and registry

import { Profile } from '../types/index';
import { cinematicStoryProfile } from './cinematicStory';
import { youtubeShortProfile } from './youtubeShort';
import { skeleton3dProfile } from './skeleton3dProfile';
import { avatarPipelineProfile } from './avatarPipeline';

class ProfileRegistry {
  private profiles: Map<string, Profile> = new Map();

  register(profile: Profile): void {
    if (this.profiles.has(profile.id)) {
      console.warn(`[ProfileRegistry] Profile ${profile.id} already registered, overwriting`);
    }
    this.profiles.set(profile.id, profile);
  }

  get(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  getAll(): Profile[] {
    return Array.from(this.profiles.values());
  }

  list(): string[] {
    return Array.from(this.profiles.keys());
  }
}

export const profileRegistry = new ProfileRegistry();

profileRegistry.register(cinematicStoryProfile);
profileRegistry.register(youtubeShortProfile);
profileRegistry.register(skeleton3dProfile);
profileRegistry.register(avatarPipelineProfile);

export { profileRegistry as default };
export type { Profile } from '../types/index';
