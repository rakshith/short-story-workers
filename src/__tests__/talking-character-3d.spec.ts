/**
 * Test: talking-character-3d template using generateSceneAdapter
 * Run with: npx tsx src/__tests__/talking-character-3d.spec.ts
 *
 * Requires env vars:
 *   CLOUDFLARE_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_TOKEN, OPENAI_API_KEY
 */

import { generateSceneAdapter } from "../services/script-generation";
import type { Env } from "../types/env";

declare const process: {
  env: Record<string, string | undefined>;
  exit(code: number): never;
};

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing ${key}`);
  return val;
}

async function testTalkingCharacter3D() {
  const env: Env = {
    CLOUDFLARE_ACCOUNT_ID: getEnv("CLOUDFLARE_ACCOUNT_ID"),
    CF_AI_GATEWAY_ID: getEnv("CF_AI_GATEWAY_ID"),
    CF_AIG_TOKEN: getEnv("CF_AIG_TOKEN"),
    OPENAI_API_KEY: getEnv("OPENAI_API_KEY"),
  } as unknown as Env;

  const userPrompt = "How smoking destroys lungs step by step, with a talking character in 3D animation";
  console.log("Input:", userPrompt);
  console.log("\nCalling generateSceneAdapter with talking-character-3d template...\n");

  const result = await generateSceneAdapter(
    {
      prompt: userPrompt,
      duration: 15,
      language: "en",
      templateId: "talking-character-3d",
      mediaType: "video",
    },
    env,
  );

  if (!result.success) {
    throw new Error(`Generation failed: ${result.error}`);
  }
  if (!result.story) {
    throw new Error("No story returned");
  }

  const output = result.story as any;

  console.log("=== Response ===");
  console.log(`type: ${output.type}`);
  console.log(`title: ${output.title}`);
  console.log(`scenes count: ${output.scenes?.length}`);

  // Validate title (required field)
  if (!output.title) throw new Error("Response missing title");
  if (output.title.length < 3 || output.title.length > 40) throw new Error(`Title length invalid: ${output.title.length} (expected 3-20)`);

  if (!output.scenes || output.scenes.length === 0) {
    throw new Error("No scenes in output");
  }

  console.log("\n=== Scene Details ===");
  for (const scene of output.scenes) {
    console.log(`\n--- Scene: ${scene.id} ---`);
    console.log(`type: ${scene.type}`);
    console.log(`duration: ${scene.duration}s`);
    console.log(`dialogue: "${scene.dialogue}"`);
    console.log(`imagePrompt: "${scene.imagePrompt}"`);
    console.log(`videoPrompt: "${scene.videoPrompt}"`);
    console.log(`environment: "${scene.environment}"`);
    console.log(`character: ${scene.character?.name} [${scene.character?.traits?.join(", ")}]`);
    console.log(`camera: ${scene.camera?.type} - ${scene.camera?.movement}`);
    console.log(`mood: ${scene.mood}`);

    // Validate required fields
    if (!scene.id) throw new Error("Scene missing id");
    if (!scene.type) throw new Error(`Scene ${scene.id} missing type`);
    if (!scene.duration) throw new Error(`Scene ${scene.id} missing duration`);
    if (!scene.dialogue) throw new Error(`Scene ${scene.id} missing dialogue`);
    if (!scene.imagePrompt) throw new Error(`Scene ${scene.id} missing imagePrompt`);
    if (!scene.videoPrompt) throw new Error(`Scene ${scene.id} missing videoPrompt`);
    if (!scene.environment) throw new Error(`Scene ${scene.id} missing environment`);
    if (!scene.character?.name) throw new Error(`Scene ${scene.id} missing character.name`);
    if (!scene.character?.traits) throw new Error(`Scene ${scene.id} missing character.traits`);
    if (!scene.camera?.type) throw new Error(`Scene ${scene.id} missing camera.type`);
    if (!scene.camera?.movement) throw new Error(`Scene ${scene.id} missing camera.movement`);
  }

  if (result.usage) {
    console.log("\n=== Token Usage ===");
    console.log(`  totalTokens: ${result.usage.totalTokens}`);
    console.log(`  promptTokens: ${result.usage.promptTokens}`);
    console.log(`  outputTokens: ${result.usage.outputTokens}`);
  }

  console.log("\n✓ All validation checks passed!");
}

async function run() {
  await testTalkingCharacter3D();
  console.log("\n=== All tests passed ===");
}

run().catch((err) => {
  console.error("✘", err.message);
  process.exit(1);
});
