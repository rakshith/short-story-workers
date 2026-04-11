import { estimateVideoGeneration } from '@artflicks/credit-tracker';

const result = estimateVideoGeneration({
  duration: 15,
  modelTier: 'pro',
  mediaType: 'ai-videos',
  enableImmersiveAudio: true
});

console.log('Credits:', result.totalCredits);
console.log('Scenes:', result.numberOfScenes);
console.log('Breakdown:', JSON.stringify(result.breakdown, null, 2));