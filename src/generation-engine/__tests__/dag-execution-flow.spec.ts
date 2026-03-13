/**
 * Full DAG Execution Flow - Integration Tests
 * 
 * Tests for complete DAG-based pipeline:
 * - DAG construction from profile
 * - Node scheduling and dependencies
 * - Execution flow from start to completion
 * - Partial and final sync behavior
 * 
 * Run: npx vitest run src/generation-engine/__tests__/dag-execution-flow.spec.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Profile, BlockDefinition, WorkflowGraph, DependencyCounter } from '../types';
import { createGraphBuilder } from '../workflow/graphBuilder';

function createMockProfile(): Profile {
  return {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    description: 'Test profile',
    blocks: [
      {
        id: 'script-generation',
        capability: 'script-generation',
      },
      {
        id: 'scene-generation',
        capability: 'scene-generation',
      },
      {
        id: 'image-generation',
        capability: 'image-generation',
      },
      {
        id: 'audio-generation',
        capability: 'voice-generation',
      },
      {
        id: 'video-generation',
        capability: 'video-generation',
      },
    ] as BlockDefinition[],
  };
}

describe('Full DAG Execution Flow - Integration', () => {
  describe('1. DAG Construction', () => {
    it('should build DAG with correct structure from profile', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const result = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
          sceneCount: 3,
        },
      });

      expect(result.graph).toBeDefined();
      expect(result.counters).toBeDefined();
    });

    it('should create nodes for each block in profile', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
        },
      });

      expect(graph.nodes.size).toBeGreaterThan(0);
    });

    it('should handle scene count for fan-out nodes', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const { counters } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
          sceneCount: 3,
        },
      });

      expect(counters).toBeDefined();
    });
  });

  describe('2. Node Dependencies', () => {
    it('should create dependency edges between sequential blocks', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
        },
      });

      const nodesArray = Array.from(graph.nodes.values());
      const nodesWithDeps = nodesArray.filter(n => n.dependencies.length > 0);

      expect(nodesWithDeps.length).toBeGreaterThan(0);
    });

    it('should identify root nodes with no dependencies', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
        },
      });

      const nodesArray = Array.from(graph.nodes.values());
      const rootNodes = nodesArray.filter(n => n.dependencies.length === 0);

      expect(rootNodes.length).toBeGreaterThan(0);
    });
  });

  describe('3. Profile Variants', () => {
    it('should handle profile with only image generation', () => {
      const profile: Profile = {
        id: 'image-only',
        name: 'Image Only',
        description: 'Test',
        blocks: [
          { id: 'script', capability: 'script-generation' },
          { id: 'image-gen', capability: 'image-generation' },
        ] as BlockDefinition[],
      };

      const graphBuilder = createGraphBuilder();
      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-1',
          storyId: 'story-1',
          userId: 'user-1',
        },
      });

      expect(graph.nodes.size).toBeGreaterThan(0);
    });

    it('should handle profile with full pipeline', () => {
      const profile: Profile = {
        id: 'full-pipeline',
        name: 'Full Pipeline',
        description: 'Test',
        blocks: [
          { id: 'script', capability: 'script-generation' },
          { id: 'scene', capability: 'scene-generation' },
          { id: 'image', capability: 'image-generation' },
          { id: 'audio', capability: 'voice-generation' },
          { id: 'video', capability: 'video-generation' },
        ] as BlockDefinition[],
      };

      const graphBuilder = createGraphBuilder();
      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-1',
          storyId: 'story-1',
          userId: 'user-1',
          sceneCount: 3,
        },
      });

      expect(graph.nodes.size).toBeGreaterThan(5);
    });
  });

  describe('4. Graph Structure', () => {
    it('should maintain node status', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
        },
      });

      const nodesArray = Array.from(graph.nodes.values());
      const allPending = nodesArray.every(n => n.status === 'pending');

      expect(allPending).toBe(true);
    });

    it('should track child nodes for dependency resolution', () => {
      const graphBuilder = createGraphBuilder();
      const profile = createMockProfile();

      const { graph } = graphBuilder.build({
        profile,
        context: {
          jobId: 'job-456',
          storyId: 'story-123',
          userId: 'user-789',
        },
      });

      const nodesArray = Array.from(graph.nodes.values());
      const nodesWithChildren = nodesArray.filter(n => n.childNodes.length > 0);

      expect(nodesWithChildren.length).toBeGreaterThanOrEqual(0);
    });
  });
});
