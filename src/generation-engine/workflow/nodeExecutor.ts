// Node Executor - executes individual nodes with retry and timeout support

import { WorkflowNode, BlockInput, ExecutionContext, Block, BlockOutput } from '../types';
import { createBlock } from '../blocks';

export interface NodeExecutorOptions {
  context: ExecutionContext;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  onNodeComplete?: (nodeId: string, output: unknown) => void;
  onNodeError?: (nodeId: string, error: string) => void;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

class NodeExecutor {
  private context: ExecutionContext;
  private maxRetries: number;
  private retryDelayMs: number;
  private timeoutMs: number;
  private onNodeComplete?: (nodeId: string, output: unknown) => void;
  private onNodeError?: (nodeId: string, error: string) => void;

  constructor(options: NodeExecutorOptions) {
    this.context = options.context;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onNodeComplete = options.onNodeComplete;
    this.onNodeError = options.onNodeError;
  }

  async executeNode(node: WorkflowNode): Promise<{ success: boolean; output?: unknown; error?: string }> {
    const block = createBlock(node.capability);

    if (!block) {
      const error = `No block found for capability: ${node.capability}`;
      this.onNodeError?.(node.nodeId, error);
      return { success: false, error };
    }

    let lastError = '';
    const maxAttempts = this.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const input: BlockInput = {
          context: this.context,
          data: node.input,
        };

        // Execute with timeout
        const output = await this.executeWithTimeout(block, input, node.nodeId);

        if (output.success) {
          node.retryCount = attempt - 1;
          this.onNodeComplete?.(node.nodeId, output.data);
          return { success: true, output: output.data };
        } else {
          lastError = output.error || 'Block execution failed';

          // Don't retry if the block explicitly returned success=false (business logic failure)
          if (attempt < maxAttempts) {
            console.warn(`[NodeExecutor] Node ${node.nodeId} failed (attempt ${attempt}/${maxAttempts}): ${lastError}. Retrying...`);
            await this.sleep(this.retryDelayMs * Math.pow(2, attempt - 1)); // exponential backoff
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        if (lastError === 'NODE_TIMEOUT') {
          node.status = 'timeout';
          lastError = `Node ${node.nodeId} timed out after ${this.timeoutMs}ms`;
          console.error(`[NodeExecutor] ${lastError}`);
          this.onNodeError?.(node.nodeId, lastError);
          return { success: false, error: lastError };
        }

        if (attempt < maxAttempts) {
          console.warn(`[NodeExecutor] Node ${node.nodeId} threw (attempt ${attempt}/${maxAttempts}): ${lastError}. Retrying...`);
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries exhausted
    node.retryCount = maxAttempts - 1;
    node.status = 'failed';
    this.onNodeError?.(node.nodeId, lastError);
    return { success: false, error: lastError };
  }

  /**
   * Execute a block with a timeout. If the block takes longer than timeoutMs,
   * the promise rejects with NODE_TIMEOUT.
   */
  private executeWithTimeout(block: Block, input: BlockInput, nodeId: string): Promise<BlockOutput> {
    return Promise.race([
      block.execute(input),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('NODE_TIMEOUT')), this.timeoutMs);
      }),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateContext(updates: Partial<ExecutionContext>): void {
    this.context = { ...this.context, ...updates };
  }

  getContext(): ExecutionContext {
    return this.context;
  }
}

function createNodeExecutor(options: NodeExecutorOptions): NodeExecutor {
  return new NodeExecutor(options);
}
