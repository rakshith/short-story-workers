// Agent Registry — Instantiates and provides access to all agents
// Each workflow gets its own registry instance with shared env

import { Env } from '../types/env';
import { VisionAgent } from './vision-agent';
import { ClassificationAgent } from './classification-agent';
import { ScenePlanningAgent } from './scene-planning-agent';
import { AvatarAgent } from './avatar-agent';
import { CompositeImageAgent } from './composite-image-agent';
import { AIDirectorAgent } from './ai-director-agent';
import { ModelSelectionAgent } from './model-selection-agent';

export class AgentRegistry {
  readonly vision: VisionAgent;
  readonly classification: ClassificationAgent;
  readonly scenePlanning: ScenePlanningAgent;
  readonly avatar: AvatarAgent;
  readonly compositeImage: CompositeImageAgent;
  readonly aiDirector: AIDirectorAgent;
  readonly modelSelection: ModelSelectionAgent;

  constructor(env: Env) {
    this.vision = new VisionAgent(env);
    this.classification = new ClassificationAgent(env);
    this.scenePlanning = new ScenePlanningAgent(env);
    this.avatar = new AvatarAgent(env);
    this.compositeImage = new CompositeImageAgent(env);
    this.aiDirector = new AIDirectorAgent(env);
    this.modelSelection = new ModelSelectionAgent(env);
  }
}
