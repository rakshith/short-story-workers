// Product Classifier — Determines content type and avatar behavior from vision analysis
// Maps vision analysis output to scene strategy (physical product → AI avatar, SaaS → Ken Burns + PiP)

import { ProductAnalysis, VisualContentType, ProductCategory } from './vision-analyzer';

// ── Types ──────────────────────────────────────────────────────

export type AvatarBehavior =
  | 'hold-product'      // Avatar holds physical product (perfume, skincare)
  | 'use-product'       // Avatar applies/uses product (beauty, food)
  | 'demonstrate'       // Avatar shows features (electronics, fashion)
  | 'pip-overlay'       // Avatar in corner explaining (SaaS, screen recordings)
  | 'lifestyle'         // Avatar in environment with product (fashion, food)
  | 'no-avatar';        // No avatar, content speaks for itself (纯 screen recordings)

export type VisualStrategy =
  | 'ai-video'              // AI generates avatar video (physical products)
  | 'ken-burns'             // Zoom/pan on static screenshots
  | 'user-video-composite'  // User's video + avatar PiP overlay
  | 'hybrid';               // Mix of AI video + Ken Burns (multiple item types)

export type MotionType =
  | 'selfie-talk'      // Avatar talking to camera, holding product
  | 'show-camera'      // Avatar showing product to camera
  | 'apply-product'    // Avatar applying/using product
  | 'screen-nav'       // Screen navigation with cursor
  | 'lifestyle-walk'   // Avatar walking/moving with product
  | 'static-zoom';     // Static image with zoom effect

export interface ClassificationResult {
  productType: ProductType;
  avatarBehavior: AvatarBehavior;
  visualStrategy: VisualStrategy;
  motionType: MotionType;
  productCategory: ProductCategory;
  confidence: number;  // 0-1, how confident we are
  reasoning: string;   // Why we chose this classification
}

export type ProductType = 'physical' | 'screenshot' | 'screen-recording' | 'mixed';

// ── Classifier ─────────────────────────────────────────────────

/**
 * Classify uploaded product media based on vision analysis results.
 * Determines the best avatar behavior, visual strategy, and motion type.
 *
 * @param analyses - Array of ProductAnalysis from vision-analyzer
 * @param showcaseItemTypes - Original upload types ('image' | 'video') from each item
 * @returns ClassificationResult with full strategy
 */
export function classifyProduct(
  analyses: ProductAnalysis[],
  showcaseItemTypes: Array<'image' | 'video'>
): ClassificationResult {
  if (analyses.length === 0) {
    return defaultClassification('other');
  }

  // Aggregate content types across all items
  const contentTypes = analyses.map(a => a.visualContentType);
  const categories = analyses.map(a => a.productCategory);

  // Determine overall product type
  const productType = aggregateProductType(contentTypes, showcaseItemTypes);

  // Determine dominant product category (majority vote)
  const dominantCategory = getDominantCategory(categories);

  // Classify based on product type + category
  const classification = classifyByType(productType, dominantCategory, analyses);

  console.log(`[Classifier] Product type: ${classification.productType}, Category: ${classification.productCategory}, Avatar: ${classification.avatarBehavior}, Visual: ${classification.visualStrategy}`);

  return classification;
}

// ── Classification Logic ───────────────────────────────────────

function aggregateProductType(
  contentTypes: VisualContentType[],
  itemTypes: Array<'image' | 'video'>
): ProductType {
  const counts = {
    'product-photo': 0,
    'screenshot': 0,
    'screen-recording': 0,
    'mixed': 0,
  };

  for (const ct of contentTypes) {
    counts[ct]++;
  }

  // If any item is a screen recording, and user uploaded a video → screen-recording
  if (counts['screen-recording'] > 0 && itemTypes.some(t => t === 'video')) {
    return 'screen-recording';
  }

  // If majority are screenshots → screenshot
  if (counts['screenshot'] > counts['product-photo']) {
    return 'screenshot';
  }

  // If we have a mix → mixed
  if (counts['screenshot'] > 0 && counts['product-photo'] > 0) {
    return 'mixed';
  }

  // If any item is mixed → mixed
  if (counts['mixed'] > 0) {
    return 'mixed';
  }

  // Default to physical product
  return 'physical';
}

function getDominantCategory(categories: ProductCategory[]): ProductCategory {
  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] || 0) + 1;
  }

  let dominant: ProductCategory = 'other';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = cat as ProductCategory;
    }
  }

  return dominant;
}

function classifyByType(
  productType: ProductType,
  category: ProductCategory,
  analyses: ProductAnalysis[]
): ClassificationResult {
  // ── Physical Products ──
  if (productType === 'physical') {
    return classifyPhysicalProduct(category, analyses);
  }

  // ── Screenshots (SaaS / Software) ──
  if (productType === 'screenshot') {
    return classifyScreenshot(category, analyses);
  }

  // ── Screen Recordings ──
  if (productType === 'screen-recording') {
    return classifyScreenRecording(category, analyses);
  }

  // ── Mixed content ──
  return classifyMixed(category, analyses);
}

function classifyPhysicalProduct(
  category: ProductCategory,
  analyses: ProductAnalysis[]
): ClassificationResult {
  const base: Omit<ClassificationResult, 'avatarBehavior' | 'motionType'> = {
    productType: 'physical',
    visualStrategy: 'ai-video',
    productCategory: category,
    confidence: 0.9,
    reasoning: `Physical product detected (${category}). AI will generate avatar video.`,
  };

  switch (category) {
    case 'beauty':
      return {
        ...base,
        avatarBehavior: 'use-product',   // Avatar applies skincare/makeup
        motionType: 'apply-product',
        reasoning: 'Beauty product detected. Avatar will demonstrate application.',
      };

    case 'food':
      return {
        ...base,
        avatarBehavior: 'use-product',   // Avatar tastes/uses food
        motionType: 'apply-product',
        reasoning: 'Food product detected. Avatar will taste and demonstrate.',
      };

    case 'fashion':
      return {
        ...base,
        avatarBehavior: 'demonstrate',   // Avatar shows off fashion item
        motionType: 'lifestyle-walk',
        reasoning: 'Fashion product detected. Avatar will showcase in lifestyle context.',
      };

    case 'electronics':
      return {
        ...base,
        avatarBehavior: 'demonstrate',   // Avatar shows features
        motionType: 'show-camera',
        reasoning: 'Electronics detected. Avatar will demonstrate features.',
      };

    default:
      return {
        ...base,
        avatarBehavior: 'hold-product',  // Generic: avatar holds product
        motionType: 'selfie-talk',
        reasoning: 'Physical product detected. Avatar will hold and talk about it.',
      };
  }
}

function classifyScreenshot(
  category: ProductCategory,
  analyses: ProductAnalysis[]
): ClassificationResult {
  // For screenshots: no full-screen avatar, use PiP overlay
  return {
    productType: 'screenshot',
    avatarBehavior: 'pip-overlay',      // Avatar in corner explaining
    visualStrategy: 'ken-burns',        // Ken Burns zoom/pan on screenshots
    motionType: 'screen-nav',           // Screen navigation effect
    productCategory: category,
    confidence: 0.95,
    reasoning: 'Screenshot detected. Ken Burns effect on images with avatar PiP overlay.',
  };
}

function classifyScreenRecording(
  category: ProductCategory,
  analyses: ProductAnalysis[]
): ClassificationResult {
  // For screen recordings: user's video is the content, avatar narrates over it
  return {
    productType: 'screen-recording',
    avatarBehavior: 'pip-overlay',              // Avatar in corner
    visualStrategy: 'user-video-composite',     // User's video + avatar PiP
    motionType: 'screen-nav',                   // Screen navigation
    productCategory: category,
    confidence: 0.95,
    reasoning: 'Screen recording detected. User video plays with avatar PiP narration.',
  };
}

function classifyMixed(
  category: ProductCategory,
  analyses: ProductAnalysis[]
): ClassificationResult {
  // Mixed: some physical, some screenshots — use hybrid strategy
  const hasPhysical = analyses.some(a => a.visualContentType === 'product-photo');
  const hasScreenshot = analyses.some(a =>
    a.visualContentType === 'screenshot' || a.visualContentType === 'screen-recording'
  );

  if (hasPhysical && hasScreenshot) {
    return {
      productType: 'mixed',
      avatarBehavior: 'hold-product',
      visualStrategy: 'hybrid',  // AI video for physical, Ken Burns for screenshots
      motionType: 'selfie-talk',
      productCategory: category,
      confidence: 0.7,
      reasoning: 'Mixed content detected. Physical items use AI avatar, screenshots use Ken Burns.',
    };
  }

  // Default mixed fallback
  return {
    productType: 'mixed',
    avatarBehavior: 'hold-product',
    visualStrategy: 'ai-video',
    motionType: 'selfie-talk',
    productCategory: category,
    confidence: 0.6,
    reasoning: 'Mixed content. Defaulting to AI avatar video strategy.',
  };
}

function defaultClassification(category: ProductCategory): ClassificationResult {
  return {
    productType: 'physical',
    avatarBehavior: 'hold-product',
    visualStrategy: 'ai-video',
    motionType: 'selfie-talk',
    productCategory: category,
    confidence: 0.3,
    reasoning: 'No vision analysis available. Defaulting to physical product strategy.',
  };
}

// ── Per-Scene Classification ───────────────────────────────────

/**
 * Determine the classification for a specific scene within a multi-item showcase.
 * Some items may be physical, others screenshots — each scene gets its own strategy.
 */
export function classifyScene(
  sceneIndex: number,
  analyses: ProductAnalysis[],
  itemTypes: Array<'image' | 'video'>
): {
  visualStrategy: VisualStrategy;
  avatarBehavior: AvatarBehavior;
  motionType: MotionType;
} {
  const analysis = analyses[sceneIndex];
  const itemType = itemTypes[sceneIndex];

  if (!analysis) {
    return {
      visualStrategy: 'ai-video',
      avatarBehavior: 'hold-product',
      motionType: 'selfie-talk',
    };
  }

  // Use the individual item's content type
  switch (analysis.visualContentType) {
    case 'screenshot':
      return {
        visualStrategy: 'ken-burns',
        avatarBehavior: 'pip-overlay',
        motionType: 'screen-nav',
      };

    case 'screen-recording':
      return {
        visualStrategy: 'user-video-composite',
        avatarBehavior: 'pip-overlay',
        motionType: 'screen-nav',
      };

    case 'product-photo':
    default: {
      // Physical product — determine avatar behavior from category
      const categoryClassification = classifyPhysicalProduct(analysis.productCategory, [analysis]);
      return {
        visualStrategy: 'ai-video',
        avatarBehavior: categoryClassification.avatarBehavior,
        motionType: categoryClassification.motionType,
      };
    }
  }
}
