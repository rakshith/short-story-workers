/**
 * Test: script-to-shorts template via CF AI Gateway.
 * Run with: npx tsx src/__tests__/script-to-shorts.spec.ts
 *
 * Requires env vars:
 *   CLOUDFLARE_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_TOKEN, OPENAI_API_KEY
 *
 * Run with all vars:
 *   CLOUDFLARE_ACCOUNT_ID=... CF_AI_GATEWAY_ID=... CF_AIG_TOKEN=... OPENAI_API_KEY=... npx tsx src/__tests__/script-to-shorts.spec.ts
 */

import { generateScriptFromText } from "../services/script-generation";
import type { Env } from "../types/env";

declare const process: {
  env: Record<string, string | undefined>;
  exit(code: number): never;
};

function buildEnv(): Env {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const gatewayId = process.env.CF_AI_GATEWAY_ID;
  const aigToken = process.env.CF_AIG_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!accountId) throw new Error("Missing CLOUDFLARE_ACCOUNT_ID");
  if (!gatewayId) throw new Error("Missing CF_AI_GATEWAY_ID");
  if (!aigToken) throw new Error("Missing CF_AIG_TOKEN");
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

  return {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CF_AI_GATEWAY_ID: gatewayId,
    CF_AIG_TOKEN: aigToken,
    OPENAI_API_KEY: openaiKey,
  } as unknown as Env;
}

async function testScriptToShorts() {
  const env = buildEnv();

  const userScript = `
  [Character: curious narrator exploring a vibrant world of wildlife]\n[Mood: educational, wondrous]\n\n[Wide shot of dense jungle] In vibrant forests, tigers reign supreme.\n[Close-up on an elephant's eye] Elephants, wise with every gentle step.\n[Medium shot of a soaring eagle] Eagles rise, mastering the skies.\n[Low angle of a tree with a sloth] Sloths embrace tranquility.\n[High angle of a bustling ant colony] Ants, the epitome of teamwork.\n[Aerial view of a whale in the ocean] Whales, vast as the endless sea.\n[Tracking shot of a cheetah running] Cheetahs, unmatched speed unleashed.\n[Slow push-in on a peacock's feathers] Peacocks, nature’s dazzling display.\n[Pull-out to reveal Arctic with polar bears] Polar bears, rulers of the ice.\n[Birds-eye view of a savanna with diverse wildlife] Earth’s tapestry, diversity in motion
  `;
  console.log("Input:", userScript);
  console.log("\nCalling LLM...\n");

  const result = await generateScriptFromText(
    {
      scriptText: userScript,
      language: "en",
      duration: 0,
      minSceneDuration: 4, // this is working fine
      maxSceneDuration: 6, // this is working fine
    },
    env,
  );

  if (!result.success) {
    throw new Error(`Generation failed: ${result.error}`);
  }
  if (!result.story) {
    throw new Error("No story returned");
  }

  console.log("✓ generateScriptFromText returned success");
  console.log(`  title: ${result.story.title}`);
  console.log(`  totalDuration: ${result.story.totalDuration}s`);
  console.log(`  scenes: ${result.story.scenes.length}`);
  if (result.story.characterAnchor) {
    console.log(`  characterAnchor: "${result.story.characterAnchor}"`);
  } else {
    console.log("  characterAnchor: null (no character in story)");
  }

  if (!result.story.title) {
    throw new Error("Story missing title");
  }
  if (!result.story.scenes?.length) {
    throw new Error("Story has no scenes");
  }

  console.log("\n--- Scene Details ---");
  for (const scene of result.story.scenes) {
    if (!scene.sceneNumber) throw new Error("Scene missing sceneNumber");
    if (!scene.duration)
      throw new Error(`Scene ${scene.sceneNumber} missing duration`);
    if (!scene.narration)
      throw new Error(`Scene ${scene.sceneNumber} missing narration`);
    if (!scene.details)
      throw new Error(`Scene ${scene.sceneNumber} missing details`);
    if (!scene.imagePrompt)
      throw new Error(`Scene ${scene.sceneNumber} missing imagePrompt`);
    if (!scene.videoPrompt)
      throw new Error(`Scene ${scene.sceneNumber} missing videoPrompt`);

    console.log(`\nScene ${scene.sceneNumber} (${scene.duration}s):`);
    console.log(`  narration: "${scene.narration}"`);
    console.log(`  details: "${scene.details}"`);
    console.log(`  imagePrompt: "${scene.imagePrompt}"`);
    console.log(`  videoPrompt: "${scene.videoPrompt}"`);
  }

  // characterAnchor validation - defined once at story level
  if (result.story.characterAnchor) {
    console.log(
      `\n✓ characterAnchor present at story level: "${result.story.characterAnchor}"`,
    );
  } else {
    console.log("\n✓ No character in story - characterAnchor is null");
  }

  if (result.usage) {
    console.log("\n--- Token Usage ---");
    console.log(`  totalTokens: ${result.usage.totalTokens}`);
    console.log(`  promptTokens: ${result.usage.promptTokens}`);
    console.log(`  outputTokens: ${result.usage.outputTokens}`);
  }

  console.log("\n✓ All validation checks passed!");
}

async function run() {
  await testScriptToShorts();
  console.log("\n=== All tests passed ===");
}

run().catch((err) => {
  console.error("✘", err.message);
  process.exit(1);
});
