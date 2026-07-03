/**
 * Duration Configuration
 * 
 * Provider-agnostic duration snapping for video models.
 * Different models support different duration values (e.g., Kling: 5 or 10 seconds, Veo: 4/6/8 seconds).
 */

/**
 * Allowed duration values per video model (seconds). If set, requested duration is snapped to nearest.
 */
export const MODEL_DURATION_OPTIONS: Record<string, number[]> = {
  'veo': [4, 6, 8],
  'kling': [5, 10],
  'wan': [5, 10],
  'seedance': [4, 5, 6, 7, 8, 9, 10, 11, 12],
  'sora': [5, 10],
  'ai-avatar': [5, 10],
  'default': [5, 10]
};

/**
 * Returns the nearest allowed duration for the model, or the requested duration if no constraint.
 * 
 * @param requestedDuration - The duration requested by the user
 * @param modelName - The model name (can be canonical, Replicate, or FAL format)
 * @returns The nearest allowed duration for the model
 */
export function getNearestDuration(requestedDuration: number, modelName: string): number {
  const lower = modelName.toLowerCase();
  const allowed = Object.entries(MODEL_DURATION_OPTIONS).find(([pattern]) => lower.includes(pattern))?.[1];
  if (!allowed || allowed.length === 0) return requestedDuration;
  return allowed.reduce((prev, curr) =>
    Math.abs(curr - requestedDuration) < Math.abs(prev - requestedDuration) ? curr : prev
  );
}
