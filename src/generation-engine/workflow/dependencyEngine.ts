// Dependency Engine - tracks dependency counters and determines which nodes are ready

import { DependencyCounter, WorkflowGraph, WorkflowNode } from '../types';

export interface DependencyEngineState {
  counters: DependencyCounter;
  completedNodes: Set<string>;
  failedNodes: Set<string>;
}

export class DependencyEngine {
  private state: DependencyEngineState;

  constructor(counters: DependencyCounter) {
    this.state = {
      counters: { ...counters },
      completedNodes: new Set(),
      failedNodes: new Set(),
    };
  }

  getReadyNodes(graph: WorkflowGraph): string[] {
    const ready: string[] = [];

    for (const [nodeId, counter] of Object.entries(this.state.counters)) {
      if (counter === 0 && !this.state.completedNodes.has(nodeId) && !this.state.failedNodes.has(nodeId)) {
        const node = graph.nodes.get(nodeId);
        if (node && node.status === 'pending') {
          ready.push(nodeId);
        }
      }
    }

    return ready;
  }

  markNodeStarted(nodeId: string): void {
    const node = this.state.counters[nodeId];
    if (node !== undefined) {
      this.state.counters[nodeId] = -1;
    }
  }

  markNodeCompleted(nodeId: string, graph: WorkflowGraph): void {
    this.state.completedNodes.add(nodeId);
    this.state.counters[nodeId] = -1;

    const node = graph.nodes.get(nodeId);
    if (node) {
      for (const childId of node.childNodes) {
        if (this.state.counters[childId] !== undefined && this.state.counters[childId] > 0) {
          this.state.counters[childId]--;
        }
      }
    }
  }

  markNodeFailed(nodeId: string): void {
    this.state.failedNodes.add(nodeId);
    this.state.counters[nodeId] = -1;
  }

  isNodeReady(nodeId: string): boolean {
    return this.state.counters[nodeId] === 0 && 
           !this.state.completedNodes.has(nodeId) && 
           !this.state.failedNodes.has(nodeId);
  }

  isComplete(): boolean {
    return Object.values(this.state.counters).every(c => c === -1);
  }

  getState(): DependencyEngineState {
    return {
      ...this.state,
      completedNodes: new Set(this.state.completedNodes),
      failedNodes: new Set(this.state.failedNodes),
    };
  }

  reset(): void {
    this.state.completedNodes.clear();
    this.state.failedNodes.clear();
  }
}

export function createDependencyEngine(counters: DependencyCounter): DependencyEngine {
  return new DependencyEngine(counters);
}
