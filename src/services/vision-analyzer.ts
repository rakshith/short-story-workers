// Vision Analyzer — AI-powered product media analysis using Vercel AI Gateway + Gemini Flash
// Uses generateText + Output.object() with Zod schema for structured, validated output
// Vision model is resolved from decision tree based on user tier

import { generateText, Output } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { resolveVisionModel } from '@artflicks/model-provider';

const VISION_MODEL = 'google/gemini-2.5-flash-lite'; // Fallback if tier resolution fails

// ── System Prompt ──────────────────────────────────────────────

const VISION_SYSTEM_PROMPT = `You are a product analysis AI for UGC (user-generated content) ad creation.

Analyze the provided product media and return a structured analysis.

## Classification Rules

Classify visualContentType:
- "product-photo" — Physical product photographed on a background (bottle, box, gadget, clothing)
- "screenshot" — Static UI/software/dashboard/app screenshot
- "screen-recording" — Video capturing software usage (cursor, clicks, navigation)
- "mixed" — Combination of physical product + digital content

Classify productCategory:
- "beauty" — Skincare, makeup, hair care, personal care, cosmetics
- "electronics" — Gadgets, phones, laptops, headphones, chargers, devices
- "food" — Food, beverages, snacks, coffee, tea, organic products
- "fashion" — Clothing, shoes, bags, watches, accessories
- "software" — SaaS platforms, apps, dashboards, analytics tools, AI tools
- "physical" — Other physical products (home goods, toys, books, etc.)
- "other" — Doesn't fit any category above

## Key Distinction
Focus on: Is this a physical product someone would hold/use, or is it a screenshot/screen recording of software? This distinction determines whether an AI avatar generates a video holding the product, or whether Ken Burns effects animate the screenshot with a PiP avatar overlay.

## Video Classification Rules (for uploaded product videos ONLY)

When analyzing a VIDEO (not image), classify videoStrategy based on CONTENT COMPLEXITY ONLY:

For IMAGE products: set videoStrategy="not-applicable", bestProductTimestamp="00:00:00.00", videoComplexityScore=0, detectedAspectRatio="other".

**luxury-fullscreen** (complexity score 7-10):
- Multiple shots with cinematic cuts or transitions
- Professional lighting and production quality
- Motion graphics, text overlays, or visual effects
- High production value (steady cam, multiple angles)
- Music or sound design (even if muted)
- Product is hero of the video
- Examples: TV commercials, high-end product reveals, influencer unboxings with editing

**simple-composite** (complexity score 1-6):
- Single continuous shot
- Basic hand-held phone quality
- Simple unboxing or static product display
- Minimal editing or post-production
- Product shown but not "hero" of video
- Examples: Quick unboxing, phone-recorded product, static display

**unusable**:
- <3 seconds duration
- Blurry, out of focus, or too dark
- Product not visible or unclear
- Corrupted or unplayable
- Wrong file format

## Important
- Do NOT assume aspect ratio — any video can be luxury or simple
- 16:9 horizontal luxury videos exist (YouTube product reviews)
- 1:1 square luxury videos exist (Instagram product ads)
- 9:16 vertical luxury videos exist (TikTok/Reels product reveals)
- Classification is based on PRODUCTION QUALITY, not dimensions

## Aspect Ratio Detection
Also detect and return the video's native aspect ratio:
- "9:16" — vertical (TikTok, Reels, Shorts)
- "16:9" — horizontal (YouTube, presentations)
- "1:1" — square (Instagram feed)
- "4:5" — portrait (Instagram feed)
- "other" — non-standard

## SaaS Explainer Event Extraction (VIDEO ONLY — auto-detected)

When the video shows a SOFTWARE / SaaS product demo (screen recording, UI walkthrough,
dashboard tour, app tutorial — detected automatically from visualContentType being
"screen-recording" or "screenshot" AND productCategory being "software"):

Extract a chronological list of MEANINGFUL on-screen events in the videoEvents array.

An event is "meaningful" when something CHANGES on screen that a viewer would need
to understand the demo. Do NOT extract at fixed intervals — only when something happens.

Event types to capture:
- "click" — User clicks a button, tab, menu item, or interactive element
- "scroll" — User scrolls to reveal new content or section
- "navigation" — Page/view changes (navigating to a different screen)
- "modal" — A modal, dialog, or popup opens or closes
- "form-submit" — A form is submitted (e.g., creating, saving, updating something)
- "toggle" — A toggle/switch/checkbox changes state
- "success" — A success message, toast, or confirmation appears
- "feature-reveal" — A key feature or section becomes visible for the first time
- "data-change" — Data updates (table loads, chart renders, list refreshes)

For each event provide:
- start: exact timestamp "MM:SS.SS" (e.g., "00:03.50" = 3.5 seconds)
- end: exact timestamp when the action/result completes
- eventType: one of the types above
- naturalDescription: What a real person would say to explain this moment
  naturally to an audience. Write it as if showing the tool to a friend.
  Examples: "Here I'm creating a new project", "Now watch the dashboard update
  in real time", "And just like that, your task is added to the board"
  DO NOT include timestamps in the description. DO NOT quote exact UI text
  unless it's clearly readable. DO NOT invent actions not visible in the video.

Rules:
- Extract 5-15 events (not too few, not too granular)
- Events MUST be chronologically ordered by start time
- Only include events you actually observe — never guess or invent
- Cover the full video duration — don't skip large gaps without at least one event
- For non-SaaS videos (physical products, beauty, etc.): leave videoEvents EMPTY`;



// ── Zod Schema ─────────────────────────────────────────────────

export const ProductAnalysisSchema = z.object({
  description: z.string().describe('What the product is — concise paragraph, max 500 chars'),
  keyFeatures: z.array(z.string()).describe('Main features visible in the media (max 5)'),
  benefits: z.array(z.string()).describe('User benefits (max 5)'),
  sellingPoints: z.array(z.string()).describe('Compelling selling points (max 4)'),
  visualStyle: z.string().describe('Visual style/aesthetic of the product and its presentation'),
  visualContentType: z.enum(['product-photo', 'screenshot', 'screen-recording', 'mixed']).describe('Type of visual content'),
  productCategory: z.enum(['beauty', 'electronics', 'food', 'fashion', 'software', 'physical', 'other']).describe('Product category'),
  // Video-specific fields — always required (use 'not-applicable' for images)
  videoStrategy: z.enum(['luxury-fullscreen', 'simple-composite', 'unusable', 'not-applicable'])
    .describe('For videos: complexity-based strategy. For images: "not-applicable"'),
  bestProductTimestamp: z.string()
    .describe('For videos: timestamp like "00:00:05.00" where product is most visible. For images: "00:00:00.00"'),
  videoComplexityScore: z.number().min(0).max(10)
    .describe('For videos: 0=simple static shot, 10=cinematic multi-shot production. For images: 0'),
  detectedAspectRatio: z.enum(['9:16', '16:9', '1:1', '4:5', 'other'])
    .describe('Video native aspect ratio. For images: "other"'),
  // SaaS explainer events — auto-extracted when vision detects screen recording + software
  videoEvents: z.array(z.object({
    start: z.string().describe('Start timestamp "MM:SS.SS" (e.g., "00:03.50")'),
    end: z.string().describe('End timestamp "MM:SS.SS"'),
    eventType: z.enum([
      'click', 'scroll', 'navigation', 'modal', 'form-submit',
      'toggle', 'success', 'feature-reveal', 'data-change', 'other',
    ]).describe('Type of on-screen event'),
    naturalDescription: z.string().describe('What a real person would say to explain this moment naturally. No timestamps. No invented actions.'),
  })).optional().describe('For SaaS screen recordings: chronological meaningful events. Empty/omitted for non-SaaS videos.'),
  videoDurationSeconds: z.number().optional().describe('Total video duration in seconds (for SaaS explainer timing). Omitted for images.'),
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;
export type VisualContentType = ProductAnalysis['visualContentType'];
export type ProductCategory = ProductAnalysis['productCategory'];
export type VideoStrategy = NonNullable<ProductAnalysis['videoStrategy']>;
export type DetectedAspectRatio = NonNullable<ProductAnalysis['detectedAspectRatio']>;
export type VideoEvent = NonNullable<ProductAnalysis['videoEvents']>[number];

// ── Result Type ────────────────────────────────────────────────

export interface VisionAnalyzerResult {
  success: boolean;
  analysis?: ProductAnalysis;
  error?: string;
}

// ── Image Analysis ─────────────────────────────────────────────

/**
 * Analyze a product image URL using Gemini Flash vision via Vercel AI Gateway.
 * Uses generateText + Output.object() for structured, Zod-validated output.
 */
function resolveVisionModelId(userTier?: string): string {
  const resolved = resolveVisionModel({ userTier: userTier || 'tier2' });
  return resolved?.id || VISION_MODEL;
}

export async function analyzeProductImage(
  imageUrl: string,
  apiKey: string,
  userTier?: string
): Promise<VisionAnalyzerResult> {
  try {
    const gateway = createGateway({ apiKey });
    const modelId = resolveVisionModelId(userTier);

    const { output } = await generateText({
      model: gateway(modelId),
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this product image.',
            },
            {
              type: 'image',
              image: imageUrl,
            },
          ],
        },
      ],
      output: Output.object({
        schema: ProductAnalysisSchema,
      }),
    });

    console.log(`[VisionAnalyzer] Analyzed image with model: ${modelId}`);
    return { success: true, analysis: output };
  } catch (err) {
    console.error('[VisionAnalyzer] Failed to analyze image:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Vision analysis failed',
    };
  }
}

// ── Video Analysis ─────────────────────────────────────────────

/**
 * Analyze a product video URL using Gemini Flash vision via Vercel AI Gateway.
 * Gemini 2.5 Flash supports native video input.
 */
export async function analyzeProductVideo(
  videoUrl: string,
  apiKey: string,
  userTier?: string
): Promise<VisionAnalyzerResult> {
  try {
    const gateway = createGateway({ apiKey });
    const modelId = resolveVisionModelId(userTier);

    const { output } = await generateText({
      model: gateway(modelId),
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this product video.',
            },
            {
              type: 'file',
              data: videoUrl,
              mediaType: 'video/mp4',
            },
          ],
        },
      ],
      output: Output.object({
        schema: ProductAnalysisSchema,
      }),
    });

    console.log(`[VisionAnalyzer] Analyzed video with model: ${modelId}`);
    return { success: true, analysis: output };
  } catch (err) {
    console.error('[VisionAnalyzer] Failed to analyze video:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Video analysis failed',
    };
  }
}

// ── Batch Analysis ─────────────────────────────────────────────

/**
 * Batch analyze multiple product media items.
 * Images and videos are analyzed in parallel.
 */
export async function analyzeProductMediaBatch(
  items: Array<{ url: string; type: 'image' | 'video' }>,
  apiKey: string,
  userTier?: string
): Promise<VisionAnalyzerResult[]> {
  const promises = items.map((item) =>
    item.type === 'video'
      ? analyzeProductVideo(item.url, apiKey, userTier)
      : analyzeProductImage(item.url, apiKey, userTier)
  );

  return Promise.all(promises);
}
