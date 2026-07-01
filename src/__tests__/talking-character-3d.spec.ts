/**
 * Test: talking-character-3d template via generateScript
 * Run with: npx tsx src/__tests__/talking-character-3d.spec.ts
 *
 * Requires env vars:
 *   CLOUDFLARE_ACCOUNT_ID, CF_AI_GATEWAY_ID, CF_AIG_TOKEN, OPENAI_API_KEY
 */

import { generateScript } from "../services/script-generation";
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
// Meet the gut clean-up crew — foods that remove toxins from your intestines naturally
// Create a video about the benefits of 4 fruits: banana, apple, mango, orange. Each fruit talks about itself.
// 3D animated gym equipment (dumbbell, treadmill, yoga mat) talking about how they help you get fit.
// 
  const userPrompt = "Turmeric destroying inflammation in joints";
  console.log("Input:", userPrompt);
  console.log("\nCalling generateScript with talking-character-3d template...\n");

  const result = await generateScript(
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

  const story = result.story;

  console.log("=== Response ===");
  console.log(`title: ${story.title}`);
  console.log(`totalDuration: ${story.totalDuration}s`);
  console.log(`scenes count: ${story.scenes.length}`);
  if (story.characterAnchor) {
    console.log(`characterAnchor: "${story.characterAnchor}"`);
  } else {
    console.log("characterAnchor: null");
  }

  // Validate title (required field)
  if (!story.title) throw new Error("Story missing title");

  if (!story.scenes || story.scenes.length === 0) {
    throw new Error("No scenes in story");
  }

  console.log("\n=== Scene Details ===");
  for (const scene of story.scenes) {
    console.log(`\n--- Scene ${scene.sceneNumber} ---`);
    console.log(`duration: ${scene.duration}s`);
    console.log(`narration: "${scene.narration}"`);
    console.log(`details: "${scene.details}"`);
    console.log(`imagePrompt: "${scene.imagePrompt}"`);
    console.log(`videoPrompt: "${scene.videoPrompt}"`);
    console.log(`cameraAngle: ${scene.cameraAngle}`);

    // Validate required fields
    if (!scene.sceneNumber) throw new Error("Scene missing sceneNumber");
    if (!scene.duration) throw new Error(`Scene ${scene.sceneNumber} missing duration`);
    if (!scene.narration) throw new Error(`Scene ${scene.sceneNumber} missing narration`);
    if (!scene.details) throw new Error(`Scene ${scene.sceneNumber} missing details`);
    if (!scene.imagePrompt) throw new Error(`Scene ${scene.sceneNumber} missing imagePrompt`);
  }

  if (result.usage) {
    console.log("\n=== Token Usage ===");
    console.log(`  totalTokens: ${result.usage.totalTokens}`);
    console.log(`  promptTokens: ${result.usage.promptTokens}`);
    console.log(`  outputTokens: ${result.usage.outputTokens}`);
  }

  if (result.templateConfig) {
    console.log("\n=== Template Config ===");
    console.log(`  generateAudio: ${result.templateConfig.generateAudio}`);
    console.log(`  usesGeneratedImage: ${result.templateConfig.usesGeneratedImage}`);
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
