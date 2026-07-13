// Vision Analyzer — AI-powered product media analysis using Vercel AI Gateway + Gemini Flash
// Uses generateText + Output.object() with Zod schema for structured, validated output

import { generateText, Output } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { z } from 'zod';

const VISION_MODEL = 'google/gemini-2.5-flash-lite';// google/gemini-3.1-flash-lite

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
- "other" — non-standard`;

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
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;
export type VisualContentType = ProductAnalysis['visualContentType'];
export type ProductCategory = ProductAnalysis['productCategory'];
export type VideoStrategy = NonNullable<ProductAnalysis['videoStrategy']>;
export type DetectedAspectRatio = NonNullable<ProductAnalysis['detectedAspectRatio']>;

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
export async function analyzeProductImage(
  imageUrl: string,
  apiKey: string
): Promise<VisionAnalyzerResult> {
  try {
    const gateway = createGateway({ apiKey });

    const { output } = await generateText({
      model: gateway(VISION_MODEL),
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
  apiKey: string
): Promise<VisionAnalyzerResult> {
  try {
    const gateway = createGateway({ apiKey });

    const { output } = await generateText({
      model: gateway(VISION_MODEL),
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
  apiKey: string
): Promise<VisionAnalyzerResult[]> {
  const promises = items.map((item) =>
    item.type === 'video'
      ? analyzeProductVideo(item.url, apiKey)
      : analyzeProductImage(item.url, apiKey)
  );

  return Promise.all(promises);
}
