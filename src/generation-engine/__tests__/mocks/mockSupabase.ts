// MockSupabase - In-memory Supabase client for testing prediction tracking
// Simulates Supabase queries for prediction_attempts table

import { PredictionAttempt } from '../../../services/prediction-tracking';

export interface MockQueryResult<T> {
  data: T | null;
  error: { message: string; code: string } | null;
}

export interface MockSupabaseOptions {
  simulateFailures?: boolean;
}

class MockSupabaseClient {
  private predictions: Map<string, PredictionAttempt> = new Map();
  private simulateFailures: boolean;

  constructor(options: MockSupabaseOptions = {}) {
    this.simulateFailures = options.simulateFailures || false;
  }

  from(table: string) {
    if (table !== 'prediction_attempts') {
      throw new Error(`Mock only supports 'prediction_attempts' table, got '${table}'`);
    }

    return new MockQueryBuilder(this.predictions, this.simulateFailures);
  }

  clear(): void {
    this.predictions.clear();
  }

  getPrediction(predictionId: string): PredictionAttempt | undefined {
    return this.predictions.get(predictionId);
  }

  getAllPredictions(): PredictionAttempt[] {
    return Array.from(this.predictions.values());
  }

  setSimulateFailures(simulate: boolean): void {
    this.simulateFailures = simulate;
  }

  size(): number {
    return this.predictions.size;
  }
}

class MockQueryBuilder {
  private predictions: Map<string, PredictionAttempt>;
  private simulateFailures: boolean;
  private filters: Map<string, any> = new Map();
  private orderColumn: string = 'created_at';
  private orderAscending: boolean = false;
  private limitCount?: number;

  constructor(predictions: Map<string, PredictionAttempt>, simulateFailures: boolean) {
    this.predictions = predictions;
    this.simulateFailures = simulateFailures;
  }

  select(_columns: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.set(column, value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.set(`__lt__${column}`, value);
    return this;
  }

  order(column: string, { ascending }: { ascending: boolean }) {
    this.orderColumn = column;
    this.orderAscending = ascending;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single(): MockQueryResult<PredictionAttempt> {
    const result = this.executeQuery();
    if (result.data && Array.isArray(result.data)) {
      if (result.data.length === 0) {
        return { data: null, error: { message: 'Not found', code: 'PGRST116' } };
      }
      return { data: result.data[0] as PredictionAttempt, error: null };
    }
    return { data: result.data as PredictionAttempt, error: result.error };
  }

  insert(data: Partial<PredictionAttempt>): MockQueryResult<PredictionAttempt> {
    if (this.simulateFailures) {
      return { data: null, error: { message: 'Simulated error', code: '50000' } };
    }

    const attempt = data as PredictionAttempt;

    if (this.predictions.has(attempt.prediction_id)) {
      return { data: null, error: { message: 'duplicate key', code: '23505' } };
    }

    for (const pred of this.predictions.values()) {
      if (pred.idempotency_key === attempt.idempotency_key) {
        return { data: null, error: { message: 'duplicate key', code: '23505' } };
      }
    }

    const prediction: PredictionAttempt = {
      ...attempt,
      id: attempt.id || `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: attempt.created_at || new Date().toISOString(),
      updated_at: attempt.updated_at || new Date().toISOString()
    };

    this.predictions.set(attempt.prediction_id, prediction);
    return { data: prediction, error: null };
  }

  update(data: Partial<PredictionAttempt>) {
    return {
      eq: (column: string, value: any) => {
        if (this.simulateFailures) {
          return { data: [], error: { message: 'Simulated error', code: '50000' } };
        }

        const updated: PredictionAttempt[] = [];
        
        for (const [key, pred] of this.predictions.entries()) {
          if (column === 'prediction_id' && pred.prediction_id === value) {
            if (this.matchesFilters(pred)) {
              const updatedPred = { ...pred, ...data, updated_at: new Date().toISOString() };
              this.predictions.set(key, updatedPred);
              updated.push(updatedPred);
            }
          }
          
          if (column === 'status' && pred.status === value) {
            if (this.matchesFiltersExcept(pred, ['status'])) {
              const updatedPred = { ...pred, ...data, updated_at: new Date().toISOString() };
              this.predictions.set(key, updatedPred);
              updated.push(updatedPred);
            }
          }
        }

        return { data: updated, error: null };
      }
    };
  }

  private matchesFilters(pred: PredictionAttempt): boolean {
    for (const [key, value] of this.filters.entries()) {
      if (key.startsWith('__lt__')) {
        const field = key.replace('__lt__', '');
        const predValue = (pred as any)[field];
        if (typeof predValue === 'string') {
          if (new Date(predValue) >= new Date(value)) return false;
        } else {
          if (predValue >= value) return false;
        }
      } else {
        if ((pred as any)[key] !== value) return false;
      }
    }
    return true;
  }

  private matchesFiltersExcept(pred: PredictionAttempt, except: string[]): boolean {
    for (const [key, value] of this.filters.entries()) {
      if (except.includes(key)) continue;
      if ((pred as any)[key] !== value) return false;
    }
    return true;
  }

  private executeQuery(): MockQueryResult<PredictionAttempt | PredictionAttempt[]> {
    if (this.simulateFailures) {
      return { data: null, error: { message: 'Simulated error', code: 'PGRST116' } };
    }

    let matches = Array.from(this.predictions.values()).filter(p => this.matchesFilters(p));

    if (matches.length === 0) {
      return { data: null, error: { message: 'Not found', code: 'PGRST116' } };
    }

    // Sort
    matches.sort((a, b) => {
      const aVal = new Date((a as any)[this.orderColumn] || 0).getTime();
      const bVal = new Date((b as any)[this.orderColumn] || 0).getTime();
      return this.orderAscending ? aVal - bVal : bVal - aVal;
    });

    // Limit
    if (this.limitCount && this.limitCount < matches.length) {
      matches = matches.slice(0, this.limitCount);
    }

    return { data: matches, error: null };
  }
}

export function createMockSupabaseClient(options?: MockSupabaseOptions): MockSupabaseClient {
  return new MockSupabaseClient(options);
}

export type { MockSupabaseClient };
