// Creative Director Agent — Sub-agent of AIDirectorAgent
// Generates narration, prompts, camera style, and scene structure from vision analysis
// Uses a dedicated LLM (separate from the vision model)

import { BaseAgent } from './base-agent';
import { CreativePlan, CreativeFreedom } from '../types/creative-plan';
import { ProductAnalysis } from '../services/vision-analyzer';
import { generateText, Output } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';

// ── Schema ─────────────────────────────────────────────────

const CreativeSceneSchema = z.object({
  sceneNumber: z.number(),
  sceneType: z.enum(['intro', 'demo', 'outro', 'feature', 'proof']),
  duration: z.number(),
  narration: z.string(),
  shotDescription: z.string(),
  cameraStyle: z.string(),
});

const CreativePlanSchema = z.object({
  title: z.string().describe('Catchy 3-6 word title for this ad'),
  inference: z.object({
    productCategory: z.string(),
    audience: z.string(),
    adFormat: z.string(),
    brandTone: z.string(),
    visualStyle: z.string(),
    productType: z.enum(['physical', 'screenshot', 'screen-recording', 'mixed']),
  }),
  story: z.object({
    scenes: z.array(CreativeSceneSchema).min(2),
    totalDuration: z.number(),
    pacing: z.enum(['slow', 'medium', 'fast']),
    transitionStyle: z.string(),
  }),
  requirements: z.object({
    needsComposite: z.boolean(),
    needsAvatarVideo: z.boolean(),
    needsVoiceover: z.boolean(),
    needsMusic: z.boolean(),
  }),
  videoProductAnalysis: z.object({
    videoStrategy: z.enum(['luxury-fullscreen', 'simple-composite', 'unusable', 'not-applicable']),
    bestProductTimestamp: z.string(),
    videoComplexityScore: z.number().min(0).max(10),
    detectedAspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5', 'other']),
  }),
});

// ── Model ──────────────────────────────────────────────────

const CREATIVE_DIRECTOR_MODEL = 'openai/gpt-5.6-luna'; // openai/gpt-5.6-luna ($6.00/M), openai/gpt-5.6-sol ($30.00/M), openai/gpt-5.6-terra ($15.00/M)

// ── Types ──────────────────────────────────────────────────

export interface CreativeDirectorInput {
  analyses: ProductAnalysis[];
  creativeFreedom: CreativeFreedom;
  targetDuration: number;
  title?: string;
  aspectRatio: string;
}

export interface CreativeDirectorOutput {
  success: boolean;
  plan?: CreativePlan;
  error?: string;
}

// ── Agent ──────────────────────────────────────────────────

export class CreativeDirectorAgent extends BaseAgent<CreativeDirectorInput, CreativeDirectorOutput> {
  readonly name = 'CreativeDirectorAgent';

  async execute(input: CreativeDirectorInput): Promise<CreativeDirectorOutput> {
    this.log(`Generating creative plan, freedom: ${input.creativeFreedom}, duration: ${input.targetDuration}s`);

    const apiKey = this.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'AI_GATEWAY_API_KEY not set' };
    }

    const gateway = createGateway({ apiKey });

    // Build product context from vision analyses
    const productContext = input.analyses.map((a, i) => {
      return `Product ${i + 1}:
- Description: ${a.description}
- Category: ${a.productCategory}
- Visual Type: ${a.visualContentType}
- Key Features: ${a.keyFeatures.join(', ')}
- Benefits: ${a.benefits.join(', ')}
- Selling Points: ${a.sellingPoints.join(', ')}
- Visual Style: ${a.visualStyle}`;
    }).join('\n\n');

    const systemPrompt = this.buildSystemPrompt(input.creativeFreedom, input.targetDuration);

    try {
      const { output } = await generateText({
        model: gateway(CREATIVE_DIRECTOR_MODEL),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze these products and create a complete ad plan.

${productContext}

User provided title: ${input.title || 'Not provided'}
Aspect ratio: ${input.aspectRatio}
Creative freedom: ${input.creativeFreedom}
Target duration: ${input.targetDuration} seconds

Generate the complete creative plan now.`,
          },
        ],
        output: Output.object({
          schema: CreativePlanSchema,
        }),
      });

      this.log(`Creative plan generated: ${output.story.scenes.length} scenes, ${output.story.totalDuration}s`);
      return { success: true, plan: output as CreativePlan };
    } catch (err) {
      this.error('Failed to generate creative plan:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Creative plan generation failed' };
    }
  }

  private buildSystemPrompt(freedom: CreativeFreedom, targetDuration: number): string {
    const freedomGuidance = this.getFreedomGuidance(freedom);

    return `You are an elite AI Creative Director for UGC (user-generated content) advertisement videos.

Your job is to:
1. Analyze the uploaded product media
2. Infer product category, target audience, and brand tone
3. Decide the best ad format (UGC testimonial, product demo, explainer, etc.)
4. Create a complete story plan with scenes, narration, and shot descriptions

═════════════════════════════════════════════════════════════
    CREATIVE FREEDOM: ${freedom.toUpperCase()}
═════════════════════════════════════════════════════════════

${freedomGuidance}

═════════════════════════════════════════════════════════════
    PRODUCT TYPE DETECTION
═════════════════════════════════════════════════════════════

Based on the visual content type from analysis:
- "product-photo" → productType: "physical" (needs composite image of avatar holding product)
- "screenshot" → productType: "screenshot" (avatar intro/outro + full-screen screenshots)
- "screen-recording" → productType: "screen-recording" (avatar intro/outro + full-screen demo)
- "mixed" → productType: "mixed" (combine approaches)

═════════════════════════════════════════════════════════════
    VIDEO PRODUCT HANDLING
═════════════════════════════════════════════════════════════

videoProductAnalysis is ALWAYS required. Fill it based on product type:

For IMAGE products (product-photo, screenshot):
- videoStrategy: "not-applicable"
- bestProductTimestamp: "00:00:00.00"
- videoComplexityScore: 0
- detectedAspectRatio: "other"

When product is a VIDEO (not image), analyze its CONTENT COMPLEXITY:

luxury-fullscreen (complexity score 7-10):
- Multiple shots with cinematic cuts
- Professional lighting and production
- Motion graphics or text overlays
- High production value
- ANY aspect ratio (9:16, 16:9, 1:1, 4:5)
→ Use FULL VIDEO as product showcase (no frame extraction)
→ Match the video's native aspect ratio

simple-composite (complexity score 1-6):
- Single static shot
- Basic unboxing or hand-held phone quality
- Minimal editing
- ANY aspect ratio
→ Extract best frame at bestProductTimestamp for composite

unusable:
- <3 seconds duration
- Blurry or unfocused
- Product not visible
- Corrupted or unreadable
→ Return error to user

IMPORTANT: Do NOT assume luxury videos are only 9:16 vertical.
16:9 horizontal luxury videos exist (YouTube reviews).
1:1 square luxury videos exist (Instagram ads).
All aspect ratios are valid for luxury content.

═════════════════════════════════════════════════════════════
    SCENE TYPES
═════════════════════════════════════════════════════════════

1. INTRO (Hook) — First 3-5 seconds
   - Stop the scroll immediately
   - Create curiosity or surprise

2. DEMO (Show Product) — 5-10 seconds
   - Show the product in action
   - For SaaS: full-screen screen recording with voiceover
   - For physical: animated product showcase (no avatar, product only)

3. FEATURE (Highlight) — 3-5 seconds
   - Deep dive into ONE key feature
   - Explain the benefit, not just the feature

4. PROOF (Social Proof) — 3-5 seconds
   - Results, testimonials, statistics
   - Build credibility and trust

5. OUTRO (CTA) — Last 3-5 seconds
   - Clear call to action
   - Create urgency

═════════════════════════════════════════════════════════════
    SHOT DESCRIPTIONS
═════════════════════════════════════════════════════════════

For each scene, write a detailed shotDescription that will be used as:
1. Motion instructions for the avatar video model (Kling Avatar v2 or OmniHuman)
2. Image generation prompt (if generating new visuals)
3. Product animation prompt (for demo scenes without avatar)

For intro and outro scenes, do NOT describe the avatar identity, face, age, hairstyle, or skin tone in shotDescription.
Identity is handled by the composite image prompt. ShotDescription should only describe motion, framing, pose, camera movement, lighting, and vibe.

CRITICAL: NEVER include text, words, logos, badges, overlays, or typography in shotDescriptions.
AI image and video models cannot render text — any text in the prompt will produce garbled, unreadable results.
Describe only visual elements: lighting, composition, camera angle, subject pose, environment, colors, textures.
Text overlays and UI elements will be added in post-production by the video compiler.

Good shot descriptions:
- "Close-up of perfume bottle on marble surface, golden hour lighting, soft bokeh"
- "Avatar holding product, rotating slowly to show all angles, warm natural lighting"
- "Selfie angle, applying product to wrist, lifestyle bathroom setting"
- "Walking through city street, confident posture, natural daylight"

BAD shot descriptions (NEVER write these):
- "Avatar holding product with '50% OFF' text overlay" ← text will be garbled
- "Dashboard showing analytics with company logo" ← logos cannot be rendered
- "Product on white background with price tag" ← text will be garbled

Camera styles to include:
- "static, direct to camera"
- "handheld smartphone, slight movement"
- "slow zoom in"
- "selfie angle, natural movement"
- "lifestyle walking shot, handheld"

═════════════════════════════════════════════════════════════
    NARRATION RULES
═════════════════════════════════════════════════════════════

- Total word budget: ~${Math.round(targetDuration * 2.5)} words for ${targetDuration}s
- Per scene: ~2.5 words per second of duration
- Lead with BENEFITS, not features
- Sound like a real person, not a salesperson
- Hook must grab attention in first 3 seconds
- CTA must be clear and actionable

═════════════════════════════════════════════════════════════
    REQUIREMENTS
═════════════════════════════════════════════════════════════

Set requirements based on product type:
- needsComposite: true if productType is "physical" (avatar holding product)
- needsAvatarVideo: true if any scene has avatar (intro/outro always do)
- needsVoiceover: true (always generate voiceover from narration)
- needsMusic: false (user provides music separately)

TITLE:
- Generate a catchy 3-6 word title for this ad
- Make it scroll-stopping and intriguing
- Examples: "This Perfume Stops Scrolling", "The Skincare Secret Nobody Shares"

OUTPUT: JSON with the complete creative plan.`;
  }

  private getFreedomGuidance(freedom: CreativeFreedom): string {
    switch (freedom) {
      case 'conservative':
        return `CONSERVATIVE MODE:
- Follow proven UGC ad patterns
- 3 scenes: intro → product → outro
- Standard hooks and transitions
- Static or minimal camera movement
- Safe, professional tone
- Duration: ~${Math.round(15)} seconds`;

      case 'balanced':
        return `BALANCED MODE:
- Mix standard structure with fresh ideas
- 4-5 scenes: intro → feature → demo → outro
- Proven hook patterns with some variety
- Handheld smartphone camera style
- Conversational, authentic tone
- Duration: ~${Math.round(30)} seconds`;

      case 'bold':
        return `BOLD MODE:
- Dynamic hooks and transitions
- 5-6 scenes with varied pacing
- Unusual camera angles and movements
- Energetic, attention-grabbing tone
- Quick cuts and whip-pans
- Duration: ~${Math.round(45)} seconds`;

      case 'experimental':
        return `EXPERIMENTAL MODE:
- Unusual storytelling and visual concepts
- 3-7 scenes, non-linear structure allowed
- Creative transitions and effects
- Surprise hooks and unexpected angles
- Push boundaries while staying on-brand
- Duration: ~${Math.round(60)} seconds`;
    }
  }
}
