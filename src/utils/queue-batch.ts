import { Queue } from '@cloudflare/workers-types';

const MAX_BATCH_SIZE = 100;

export async function sendQueueBatch<T>(queue: Queue<T>, messages: T[]): Promise<void> {
  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const chunk = messages.slice(i, i + MAX_BATCH_SIZE).map(body => ({ body }));
    await queue.sendBatch(chunk);
  }
}
