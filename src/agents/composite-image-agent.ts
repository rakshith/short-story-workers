// Composite Image Agent — Generates "avatar holding product" image using nano-banana-pro
// Uses multi-image reference: takes avatar face + product image → generates composite
// The composite is then used as input for Kling Avatar v2

import { BaseAgent } from './base-agent';
import { Env } from '../types/env';
import { ModelProviderFactory, PROVIDER_NAMES, translateModelId } from '@artflicks/model-provider';
import { generateUUID } from '../utils/storage';

export interface CompositeImageAgentInput {
  avatarImageUrl: string;
  productImageUrl: string;
  productDescription: string;
  userId: string;
  model?: string;
  aspectRatio?: string;
  // Creative plan fields for richer prompt
  shotDescription?: string;   // AI Director's shot vision for this scene
  visualStyle?: string;       // Vision analysis aesthetic
  brandTone?: string;         // e.g. "premium", "energetic"
}

export interface CompositeImageAgentOutput {
  success: boolean;
  compositeImageUrl?: string;
  error?: string;
}

const DEFAULT_MODEL = 'nano-banana-pro';

export class CompositeImageAgent extends BaseAgent<CompositeImageAgentInput, CompositeImageAgentOutput> {
  readonly name = 'CompositeImageAgent';

  async execute(input: CompositeImageAgentInput): Promise<CompositeImageAgentOutput> {
    const canonicalModel = input.model || DEFAULT_MODEL;
    const aspectRatio = input.aspectRatio || '9:16';
    
    // Translate canonical model name to FAL endpoint for image-to-image
    const falModelId = translateModelId(canonicalModel, PROVIDER_NAMES.FALAI, 'image-to-image');
    
    this.log(`Generating composite image for user ${input.userId} using model: ${falModelId} (${aspectRatio})`);

    const falApiKey = this.env.FAL_API_KEY;
    if (!falApiKey) {
      return { success: false, error: 'FAL_API_KEY not configured' };
    }

    try {
      const provider = ModelProviderFactory.createProvider(PROVIDER_NAMES.FALAI, { apiKey: falApiKey });

      if (!provider.generateImage) {
        return { success: false, error: 'Provider does not support synchronous image generation' };
      }

      // Build prompt for composite image using creative plan fields
      const prompt = this.buildCompositePrompt(input);

      this.log(`Calling ${falModelId} with multi-image reference (aspect_ratio: ${aspectRatio})...`);

      // Use nano-banana-pro with multi-image reference
      // Pass both avatar and product images as references
      const result = await provider.generateImage(falModelId, {
        prompt,
        imageUrl: input.avatarImageUrl,
      }, {
        input: {
          image_urls: [
            input.avatarImageUrl,    // Reference 1: avatar face
            input.productImageUrl,   // Reference 2: product (white bg ignored by model)
          ],
          aspect_ratio: aspectRatio,
          num_outputs: 1,
          output_format: 'jpg',
          output_quality: 90,
        },
      });

      if (!result.imageUrls || result.imageUrls.length === 0) {
        return { success: false, error: 'No image generated' };
      }

      const generatedImageUrl = result.imageUrls[0];
      this.log(`Composite image generated: ${generatedImageUrl.slice(0, 80)}...`);

      // Download and upload to R2
      const compositeUrl = await this.uploadToR2(generatedImageUrl, input.userId);

      this.log(`Composite image uploaded to R2: ${compositeUrl}`);

      return {
        success: true,
        compositeImageUrl: compositeUrl,
      };
    } catch (err) {
      this.error('Composite image generation failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Build prompt for generating "avatar holding product" composite image.
   * Uses AI Director's shotDescription, visualStyle, and brandTone when available
   * for scene-specific composition instead of a generic description.
   */
  private buildCompositePrompt(input: CompositeImageAgentInput): string {
    const parts: string[] = [];

    parts.push('Edit the first image. Preserve the person\'s identity exactly. Never change the avatar identity, facial features, hairstyle, skin tone, age, or overall appearance.');
    parts.push('Use the first image as the exact identity reference.');
    parts.push('Place the product from the second image naturally in the person\'s hand.');
    parts.push('Keep the product shape, label, colors, and proportions accurate.');

    if (input.visualStyle) {
      parts.push(`visual style: ${input.visualStyle}`);
    }

    if (input.brandTone) {
      parts.push(`tone: ${input.brandTone}`);
    }

    parts.push('Clean, luxurious, refined.');
    parts.push('No text, no logos, no typography, no watermarks.');

    return parts.join('. ');
  }

  /**
   * Download generated image and upload to R2.
   */
  private async uploadToR2(imageUrl: string, userId: string): Promise<string> {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch generated image: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.arrayBuffer();
    const fileName = `${generateUUID()}.jpg`;
    const key = `ai-ugc-ads-composites/${userId}/${fileName}`;

    await this.env.IMAGES_BUCKET.put(key, imageBlob, {
      httpMetadata: {
        contentType: 'image/jpeg',
      },
    });

    return `https://image.artflicks.app/${key}`;
  }
}
