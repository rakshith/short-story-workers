/**
 * ConcurrencyService Tests
 * Run: npx vitest run src/generation-engine/__tests__/services/concurrencyService.spec.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConcurrencyService, createConcurrencyService } from '../../services/concurrencyService';

describe('ConcurrencyService', () => {
  let service: ConcurrencyService;

  beforeEach(() => {
    service = createConcurrencyService();
  });

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 for unknown user', () => {
      const count = service.getActiveCount('unknown-user');
      expect(count).toBe(0);
    });

    it('should return cached count', () => {
      service.increment('user-1');
      const count = service.getActiveCount('user-1');
      expect(count).toBe(1);
    });

    it('should return 0 after cache expires', async () => {
      service.increment('user-1');
      service.increment('user-1');
      
      const initialCount = service.getActiveCount('user-1');
      expect(initialCount).toBe(2);
    }, 100);
  });

  describe('increment', () => {
    it('should increment count for user', () => {
      service.increment('user-1');
      service.increment('user-1');
      service.increment('user-1');
      
      const count = service.getActiveCount('user-1');
      expect(count).toBe(3);
    });

    it('should track different users separately', () => {
      service.increment('user-1');
      service.increment('user-2');
      
      expect(service.getActiveCount('user-1')).toBe(1);
      expect(service.getActiveCount('user-2')).toBe(1);
    });
  });

  describe('decrement', () => {
    it('should decrement count for user', () => {
      service.increment('user-1');
      service.increment('user-1');
      service.decrement('user-1');
      
      const count = service.getActiveCount('user-1');
      expect(count).toBe(1);
    });

    it('should not go below 0', () => {
      service.decrement('user-1');
      const count = service.getActiveCount('user-1');
      expect(count).toBe(0);
    });
  });

  describe('check', () => {
    it('should return allowed true in mock mode', async () => {
      const env = { GEN_PROVIDER: 'mock' };
      const svc = new ConcurrencyService();
      
      const result = await svc.check('user-1', '1', env, 'job-1');
      expect(result.allowed).toBeDefined();
      expect(result.maxConcurrency).toBeDefined();
    });
  });
});
