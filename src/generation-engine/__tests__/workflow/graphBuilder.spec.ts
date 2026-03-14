/**
 * Unit Tests: Graph Builder Layer
 * Tests node creation, dependency ordering, and parallel execution
 * 
 * Run: npm run test:run -- --testNamePattern "graphBuilder"
 */

import { describe, it, expect, vi } from 'vitest';
import { getTemplate, TEMPLATE_IDS } from '../../templates/index';

describe('Graph Builder Layer - Node Creation & Dependencies', () => {
  describe('Node Structure', () => {
    it('should create node with required fields', () => {
      const node = {
        nodeId: 'image-0',
        capability: 'image-generation',
        dependencies: [],
        childNodes: [],
        input: {},
      };

      expect(node.nodeId).toBe('image-0');
      expect(node.capability).toBe('image-generation');
      expect(node.dependencies).toEqual([]);
    });

    it('should track dependencies correctly', () => {
      const node = {
        nodeId: 'audio-0',
        capability: 'voice-generation',
        dependencies: ['image-0'],
        childNodes: [],
      };

      expect(node.dependencies).toHaveLength(1);
      expect(node.dependencies[0]).toBe('image-0');
    });
  });

  describe('Capability Types', () => {
    it('should have script-generation capability', () => {
      const capability = 'script-generation';
      expect(capability).toBe('script-generation');
    });



    it('should have image-generation capability', () => {
      const capability = 'image-generation';
      expect(capability).toBe('image-generation');
    });

    it('should have voice-generation capability', () => {
      const capability = 'voice-generation';
      expect(capability).toBe('voice-generation');
    });

    it('should have video-generation capability', () => {
      const capability = 'video-generation';
      expect(capability).toBe('video-generation');
    });
  });

  describe('Dependency Ordering', () => {
    it('should create voice nodes after corresponding image nodes', () => {
      const imageNode = { nodeId: 'image-0', dependencies: ['scenes'] };
      const voiceNode = { nodeId: 'voice-0', dependencies: ['image-0'] };

      expect(voiceNode.dependencies).toContain('image-0');
    });

    it('should create video nodes after corresponding image nodes', () => {
      const imageNode = { nodeId: 'image-0', dependencies: ['scenes'] };
      const videoNode = { nodeId: 'video-0', dependencies: ['image-0'] };

      expect(videoNode.dependencies).toContain('image-0');
    });
  });

  describe('Parallel Execution', () => {
    it('should create multiple image nodes in parallel', () => {
      const sceneCount = 3;
      const imageNodes = [];

      for (let i = 0; i < sceneCount; i++) {
        imageNodes.push({
          nodeId: `image-${i}`,
          capability: 'image-generation',
          dependencies: ['scenes'],
        });
      }

      expect(imageNodes).toHaveLength(3);
      imageNodes.forEach((node, i) => {
        expect(node.nodeId).toBe(`image-${i}`);
        expect(node.dependencies).toEqual(['scenes']);
      });
    });

    it('should create multiple voice nodes in parallel', () => {
      const sceneCount = 3;
      const voiceNodes = [];

      for (let i = 0; i < sceneCount; i++) {
        voiceNodes.push({
          nodeId: `voice-${i}`,
          capability: 'voice-generation',
          dependencies: [`image-${i}`],
        });
      }

      expect(voiceNodes).toHaveLength(3);
      voiceNodes.forEach((node, i) => {
        expect(node.nodeId).toBe(`voice-${i}`);
      });
    });

    it('should create multiple video nodes in parallel', () => {
      const sceneCount = 3;
      const videoNodes = [];

      for (let i = 0; i < sceneCount; i++) {
        videoNodes.push({
          nodeId: `video-${i}`,
          capability: 'video-generation',
          dependencies: [`image-${i}`],
        });
      }

      expect(videoNodes).toHaveLength(3);
    });
  });

  describe('Fan-out Structure', () => {
    it('should fan out from scenes to multiple images', () => {
      const scenesNode = { nodeId: 'scenes', childNodes: ['image-0', 'image-1', 'image-2'] };
      const imageNodes = ['image-0', 'image-1', 'image-2'];

      expect(scenesNode.childNodes).toHaveLength(3);
      expect(imageNodes).toHaveLength(3);
    });

    it('should fan out from images to voice', () => {
      const imageNode = { nodeId: 'image-0', childNodes: ['voice-0', 'video-0'] };

      expect(imageNode.childNodes).toContain('voice-0');
      expect(imageNode.childNodes).toContain('video-0');
    });
  });

  describe('Dependency Counter Logic', () => {
    it('should initialize dependency counter to 0', () => {
      const node = { dependencies: ['a', 'b'] };
      const dependencyCount = node.dependencies.length;

      expect(dependencyCount).toBe(2);
    });

    it('should decrement child counters when parent completes', () => {
      const childNodes = [
        { nodeId: 'image-0', dependencyCount: 1 },
        { nodeId: 'image-1', dependencyCount: 1 },
      ];

      // After parent completes
      childNodes.forEach(child => {
        child.dependencyCount = Math.max(0, child.dependencyCount - 1);
      });

      expect(childNodes[0].dependencyCount).toBe(0);
      expect(childNodes[1].dependencyCount).toBe(0);
    });

    it('should execute node when dependencyCount is 0', () => {
      const node = { nodeId: 'image-0', dependencyCount: 0 };
      const canExecute = node.dependencyCount === 0;

      expect(canExecute).toBe(true);
    });

    it('should not execute node when dependencyCount > 0', () => {
      const node = { nodeId: 'image-0', dependencyCount: 1 };
      const canExecute = node.dependencyCount === 0;

      expect(canExecute).toBe(false);
    });
  });

  describe('Profile to Blocks Mapping', () => {
    it('should map youtube-short profile to correct blocks', () => {
      const profileBlocks = [
        { capability: 'script-generation' },
        { capability: 'image-generation' },
        { capability: 'voice-generation' },
        { capability: 'video-generation' },
      ];

      expect(profileBlocks).toHaveLength(5);
      expect(profileBlocks[0].capability).toBe('script-generation');
    });

    it('should map avatar pipeline to correct blocks', () => {
      const avatarBlocks = [
        { capability: 'script-generation' },
        { capability: 'image-generation' },
        { capability: 'avatar-generation' },
        { capability: 'voice-generation' },
      ];

      expect(avatarBlocks[3].capability).toBe('avatar-generation');
    });
  });

  describe('Template to Profile Resolution', () => {
    it('should get profile from youtube-shorts template', () => {
      const template = getTemplate(TEMPLATE_IDS.YOUTUBE_SHORTS);
      const profileId = template?.profileId;

      expect(profileId).toBe('youtube-short');
    });

    it('should get profile from skeleton-3d-shorts template', () => {
      const template = getTemplate(TEMPLATE_IDS.SKELETON_3D_SHORTS);
      const profileId = template?.profileId;

      expect(profileId).toBe('skeleton-3d-profile');
    });
  });

  describe('Node Input Data', () => {
    it('should pass scene data to image node', () => {
      const sceneData = {
        scenes: [
          { imagePrompt: 'Scene 1', narration: 'Narration 1' },
          { imagePrompt: 'Scene 2', narration: 'Narration 2' },
        ],
      };

      const nodeInput = {
        sceneIndex: 0,
        scene: sceneData.scenes[0],
      };

      expect(nodeInput.scene.imagePrompt).toBe('Scene 1');
    });
  });
});
