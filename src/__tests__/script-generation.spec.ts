/**
 * Quick smoke test for generateScript via CF AI Gateway.
 * Run with: npx tsx src/__tests__/script-generation.spec.ts
 *
 * Requires .dev.vars (or env vars):
 *   CLOUDFLARE_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_TOKEN, OPENAI_API_KEY
 */

import { generateScript } from '../services/script-generation';
import type { Env } from '../types/env';

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

function buildEnv(): Env {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const gatewayId = process.env.CF_AI_GATEWAY_ID;
  const aigToken = process.env.CF_AIG_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!accountId) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
  if (!gatewayId) throw new Error('Missing CF_AI_GATEWAY_ID');
  if (!aigToken) throw new Error('Missing CF_AIG_TOKEN');
  if (!openaiKey) throw new Error('Missing OPENAI_API_KEY');

  return {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CF_AI_GATEWAY_ID: gatewayId,
    CF_AIG_TOKEN: aigToken,
    OPENAI_API_KEY: openaiKey,
  } as unknown as Env;
}

async function testGenerateScript() {
  const env = buildEnv();

  const result = await generateScript(
    {
      prompt: 'A short story about a robot learning to paint',
      duration: 30,
      language: 'en',
      mediaType: 'image',
    },
    env
  );

  if (!result.success) throw new Error(`Generation failed: ${result.error}`);
  if (!result.story) throw new Error('No story returned');
  if (!result.story.title) throw new Error('Story missing title');
  if (!result.story.scenes?.length) throw new Error('Story has no scenes');

  console.log('✓ generateScript returned a valid StoryTimeline');
  console.log(`  title: ${result.story.title}`);
  console.log(`  scenes: ${result.story.scenes.length}`);
  console.log(`  totalDuration: ${result.story.totalDuration}s`);
  if (result.usage) {
    console.log(`  tokens: ${result.usage.totalTokens} (prompt: ${result.usage.promptTokens}, output: ${result.usage.outputTokens})`);
  }
}

async function run() {
  await testGenerateScript();
  console.log('\nAll tests passed.');
}

run().catch((err) => {
  console.error('✘', err.message);
  process.exit(1);
});
