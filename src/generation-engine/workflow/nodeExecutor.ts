// Node Executor - executes individual nodes

import { WorkflowNode, BlockInput, ExecutionContext } from '../types';
import { createBlock } from '../blocks';

export interface NodeExecutorOptions {
  context: ExecutionContext;
  onNodeComplete?: (nodeId: string, output: any) => void;
  onNodeError?: (nodeId: string, error: string) => void;
}

export class NodeExecutor {
  private context: ExecutionContext;
  private onNodeComplete?: (nodeId: string, output: any) => void;
  private onNodeError?: (nodeId: string, error: string) => void;

  constructor(options: NodeExecutorOptions) {
    this.context = options.context;
    this.onNodeComplete = options.onNodeComplete;
    this.onNodeError = options.onNodeError;
  }

  async executeNode(node: WorkflowNode): Promise<{ success: boolean; output?: any; error?: string }> {
    const block = createBlock(node.capability);

    if (!block) {
      const error = `No block found for capability: ${node.capability}`;
      this.onNodeError?.(node.nodeId, error);
      return { success: false, error };
    }

    try {
      const input: BlockInput = {
        context: this.context,
        data: node.input,
      };

      const output = await block.execute(input);

      if (output.success) {
        this.onNodeComplete?.(node.nodeId, output.data);
        return { success: true, output: output.data };
      } else {
        this.onNodeError?.(node.nodeId, output.error || 'Block execution failed');
        return { success: false, error: output.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.onNodeError?.(node.nodeId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  updateContext(updates: Partial<ExecutionContext>): void {
    this.context = { ...this.context, ...updates };
  }

  getContext(): ExecutionContext {
    return this.context;
  }
}

export function createNodeExecutor(options: NodeExecutorOptions): NodeExecutor {
  return new NodeExecutor(options);
}
