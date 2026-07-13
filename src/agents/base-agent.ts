// Base Agent — Abstract class for all video generation agents
// Provides common logging, error handling, and environment access

import { Env } from '../types/env';

export abstract class BaseAgent<TInput, TOutput> {
  abstract readonly name: string;

  constructor(protected env: Env) {}

  abstract execute(input: TInput): Promise<TOutput>;

  protected log(message: string, data?: any) {
    console.log(`[${this.name}] ${message}`, data || '');
  }

  protected error(message: string, err?: any) {
    console.error(`[${this.name}] ${message}`, err || '');
  }

  protected warn(message: string, data?: any) {
    console.warn(`[${this.name}] ${message}`, data || '');
  }
}
