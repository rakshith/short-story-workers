// Prediction Tracking Service - Prevents duplicate Replicate predictions and tracks costs
// This service ensures you never pay twice for the same scene generation

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

export interface PredictionAttempt {
  id?: string;
  job_id: string;
  story_id: string;
  scene_index: number;
  prediction_type: 'image' | 'video' | 'audio';
  prediction_id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  idempotency_key: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  error_message?: string | null;
  output_url?: string | null;
}

export interface ExistingPredictionResult {
  exists: boolean;
  predictionId?: string;
  status?: 'pending' | 'succeeded' | 'failed';
  shouldCreateNew: boolean;
}

export class PredictionTrackingService {
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor(supabaseUrl: string, supabaseKey: string, logger?: Logger) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger = logger || new Logger('PredictionTracking');
  }

  /**
   * Check if a prediction already exists for this scene
   * Returns existing prediction info to prevent duplicates
   */
  async checkExistingPrediction(
    storyId: string,
    sceneIndex: number,
    predictionType: 'image' | 'video' | 'audio'
  ): Promise<ExistingPredictionResult> {
    try {
      const { data, error } = await this.supabase
        .from('prediction_attempts')
        .select('prediction_id, status, created_at')
        .eq('story_id', storyId)
        .eq('scene_index', sceneIndex)
        .eq('prediction_type', predictionType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - safe to create new prediction
          return { exists: false, shouldCreateNew: true };
        }
        this.logger.error('[PredictionTracking] Error checking existing prediction', error);
        // On error, be conservative and allow new prediction
        return { exists: false, shouldCreateNew: true };
      }

      if (!data) {
        return { exists: false, shouldCreateNew: true };
      }

      // Check if existing prediction is still pending (within reasonable time)
      const createdAt = new Date(data.created_at);
      const now = new Date();
      const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      // If pending for less than 10 minutes, don't create duplicate
      if (data.status === 'pending' && ageMinutes < 10) {
        this.logger.info('[PredictionTracking] Found recent pending prediction, skipping duplicate', {
          storyId,
          sceneIndex,
          predictionType,
          predictionId: data.prediction_id,
          ageMinutes: Math.round(ageMinutes),
        });
        return {
          exists: true,
          predictionId: data.prediction_id,
          status: data.status,
          shouldCreateNew: false,
        };
      }

      const shouldCreateNew = data.status === 'failed' || 
                             (data.status === 'pending' && ageMinutes >= 10);

      return {
        exists: true,
        predictionId: data.prediction_id,
        status: data.status,
        shouldCreateNew,
      };
    } catch (error) {
      this.logger.error('[PredictionTracking] Unexpected error in checkExistingPrediction', error);
      return { exists: false, shouldCreateNew: true };
    }
  }

  /**
   * Record a new prediction attempt
   * Must be called BEFORE calling Replicate to ensure idempotency
   */
  async recordPredictionAttempt(attempt: Omit<PredictionAttempt, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('prediction_attempts')
        .insert({
          job_id: attempt.job_id,
          story_id: attempt.story_id,
          scene_index: attempt.scene_index,
          prediction_type: attempt.prediction_type,
          prediction_id: attempt.prediction_id,
          status: attempt.status,
          idempotency_key: attempt.idempotency_key,
          error_message: attempt.error_message,
          output_url: attempt.output_url,
          completed_at: attempt.completed_at,
        });

      if (error) {
        // Check for unique constraint violation (race condition)
        if (error.code === '23505') {
          this.logger.warn('[PredictionTracking] Prediction already recorded (race condition)', {
            storyId: attempt.story_id,
            sceneIndex: attempt.scene_index,
            predictionType: attempt.prediction_type,
          });
          return false;
        }
        
        this.logger.error('[PredictionTracking] Failed to record prediction attempt', error);
        return false;
      }

      this.logger.info('[PredictionTracking] Recorded new prediction attempt', {
        storyId: attempt.story_id,
        sceneIndex: attempt.scene_index,
        predictionType: attempt.prediction_type,
        predictionId: attempt.prediction_id,
      });

      return true;
    } catch (error) {
      this.logger.error('[PredictionTracking] Unexpected error recording prediction', error);
      return false;
    }
  }

  /**
   * Update prediction status when webhook is received
   */
  async updatePredictionStatus(
    predictionId: string,
    status: 'succeeded' | 'failed' | 'cancelled',
    outputUrl?: string,
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('prediction_attempts')
        .update({
          status,
          output_url: outputUrl,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('prediction_id', predictionId);

      if (error) {
        this.logger.error('[PredictionTracking] Failed to update prediction status', error);
        return false;
      }

      this.logger.info('[PredictionTracking] Updated prediction status', {
        predictionId,
        status,
      });

      return true;
    } catch (error) {
      this.logger.error('[PredictionTracking] Unexpected error updating prediction', error);
      return false;
    }
  }

  /**
   * Mark old pending predictions as failed (cleanup for stuck predictions)
   * Should be called periodically or on startup
   */
  async cleanupStuckPredictions(maxAgeMinutes: number = 30): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
      
      const { data, error } = await this.supabase
        .from('prediction_attempts')
        .update({
          status: 'failed',
          error_message: 'Prediction timed out (cleanup)',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'pending')
        .lt('created_at', cutoffTime)
        .select();

      if (error) {
        this.logger.error('[PredictionTracking] Failed to cleanup stuck predictions', error);
        return 0;
      }

      const count = data?.length || 0;
      if (count > 0) {
        this.logger.info('[PredictionTracking] Cleaned up stuck predictions', { count, maxAgeMinutes });
      }

      return count;
    } catch (error) {
      this.logger.error('[PredictionTracking] Unexpected error in cleanup', error);
      return 0;
    }
  }

  /**
   * Get cost statistics for a job
   */
  async getJobCostStats(jobId: string): Promise<{
    totalPredictions: number;
    succeeded: number;
    failed: number;
    pending: number;
    estimatedCost: number; // Based on prediction type
  }> {
    try {
      const { data, error } = await this.supabase
        .from('prediction_attempts')
        .select('prediction_type, status')
        .eq('job_id', jobId);

      if (error || !data) {
        return { totalPredictions: 0, succeeded: 0, failed: 0, pending: 0, estimatedCost: 0 };
      }

      const stats = {
        totalPredictions: data.length,
        succeeded: data.filter(d => d.status === 'succeeded').length,
        failed: data.filter(d => d.status === 'failed').length,
        pending: data.filter(d => d.status === 'pending').length,
        estimatedCost: 0,
      };

      // Rough cost estimates (adjust based on your actual pricing)
      const costPerType: Record<string, number> = {
        image: 0.01,
        video: 0.05,
        audio: 0.001,
      };

      stats.estimatedCost = data.reduce((sum, d) => {
        return sum + (costPerType[d.prediction_type] || 0);
      }, 0);

      return stats;
    } catch (error) {
      this.logger.error('[PredictionTracking] Error getting cost stats', error);
      return { totalPredictions: 0, succeeded: 0, failed: 0, pending: 0, estimatedCost: 0 };
    }
  }

  /**
   * Generate unique idempotency key for a prediction
   * Format: {storyId}-{sceneIndex}-{type}-{timestamp}-{random}
   */
  generateIdempotencyKey(
    storyId: string,
    sceneIndex: number,
    predictionType: 'image' | 'video' | 'audio'
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${storyId.slice(-8)}-${sceneIndex}-${predictionType}-${timestamp}-${random}`;
  }
}

export interface PendingPredictionSnapshotItem {
  prediction_id: string;
  prediction_type: 'image' | 'video' | 'audio';
  scene_index: number;
  status: string;
}

export async function getJobPredictionsSnapshot(
  supabase: SupabaseClient,
  jobId: string
): Promise<PendingPredictionSnapshotItem[]> {
  const { data, error } = await supabase
    .from('prediction_attempts')
    .select('prediction_id, prediction_type, scene_index, status')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as PendingPredictionSnapshotItem[];
}

// Singleton instance cache
const serviceCache: Map<string, PredictionTrackingService> = new Map();

export function getPredictionTrackingService(
  supabaseUrl: string,
  supabaseKey: string,
  logger?: Logger
): PredictionTrackingService {
  const key = `${supabaseUrl}-${supabaseKey.slice(-8)}`;
  
  if (!serviceCache.has(key)) {
    serviceCache.set(key, new PredictionTrackingService(supabaseUrl, supabaseKey, logger));
  }
  
  return serviceCache.get(key)!;
}
