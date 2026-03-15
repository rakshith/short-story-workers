/**
 * Quick smoke test for generateScript via CF AI Gateway.
 * Run with: npx tsx src/__tests__/script-generation.spec.ts
 *
 * Requires .dev.vars (or env vars):
 *   CF_AIG_TOKEN, CF_AI_GATEWAY_URL, OPENAI_API_KEY (unused but required by Env type)
 */

import { generateScript } from '../services/script-generation';
import type { Env } from '../types/env';

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

function buildEnv(): Env {
  const token = process.env.CF_AIG_TOKEN;
  const gatewayUrl = process.env.CF_AI_GATEWAY_URL;

  if (!token) throw new Error('Missing CF_AIG_TOKEN');
  if (!gatewayUrl) throw new Error('Missing CF_AI_GATEWAY_URL');

  return {
    CF_AIG_TOKEN: token,
    CF_AI_GATEWAY_URL: gatewayUrl,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
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
