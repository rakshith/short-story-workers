// Mock Queue - in-memory queue for testing

export interface MockQueueMessage {
  jobId: string;
  storyId: string;
  [key: string]: any;
}

class MockQueue {
  private messages: MockQueueMessage[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  async send(message: any): Promise<void> {
    this.messages.push(message);
    console.log(`[MockQueue:${this.name}] Sent message:`, {
      jobId: message.jobId,
      type: message.type,
      sceneIndex: message.sceneIndex,
    });
  }

  async batchSend(messages: any[]): Promise<void> {
    for (const msg of messages) {
      await this.send(msg);
    }
  }

  getMessages(): MockQueueMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
    console.log(`[MockQueue:${this.name}] Cleared`);
  }

  get count(): number {
    return this.messages.length;
  }
}

class MockQueueManager {
  private queues: Map<string, MockQueue> = new Map();

  getQueue(name: string): MockQueue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new MockQueue(name);
      this.queues.set(name, queue);
    }
    return queue;
  }

  clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
    console.log('[MockQueueManager] All queues cleared');
  }

  get totalMessages(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.count;
    }
    return total;
  }
}

const mockQueueManager = new MockQueueManager();

export function getMockStoryQueue(): MockQueue {
  return mockQueueManager.getQueue('story-processing');
}

export function getMockWebhookQueue(): MockQueue {
  return mockQueueManager.getQueue('webhook-processing');
}

export function clearAllMockQueues(): void {
  mockQueueManager.clearAll();
}

export function getTotalMockMessages(): number {
  return mockQueueManager.totalMessages;
}
