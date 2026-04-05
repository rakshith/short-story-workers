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
    [Character: Targaryen queen in flowing silver-white hair, black dragon scale armor, violet eyes, red and black cape]
    [Mood: epic, dark, mythic]

    [Aerial drone shot, vast medieval kingdom at dawn, red sky] Before the kingdoms, there were dragons.

    [slow push-in on iron throne, torchlight flickering] One family controlled them all. House Targaryen.

    [tracking shot, three massive dragons flying over burning city] Their dragons didn't just win wars. They ended them.

    [low angle tilt-up, Targaryen queen standing on dragon's back, wind whipping cape] For two hundred years, no house dared challenge them.

    [dutch angle, shadowy lords gathered around map table, candles flickering] Then the dragons died. And the wolves smelled blood.

    [crane shot pulling back, armies of five houses clashing on battlefield] Every great house wanted the throne. Only one could survive.

    [close-up rack focus, queen's violet eyes watching city burn below] She didn't want the throne. She wanted them all to burn.

    [slow motion push-in, dragon emerging through smoke and fire, wings spreading] War of thrones was never about power. It was about fear.

    [pull-out, lone iron throne in empty ash-covered hall, silence] In the end, the throne survived. Everyone who sat on it didn't.`;

  console.log("Input:", userScript);
  console.log("\nCalling LLM...\n");

  const result = await generateScriptFromText(
    {
      scriptText: userScript,
      duration: 15,
      language: "en",
      mediaType: "image",
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
