// Prompt sanitizer — strips text, typography, and overlay references from prompts
// AI image/video models cannot render text — any text in prompts produces garbled results
// Text overlays and UI elements are added in post-production by the video compiler

/**
 * Patterns that reference text, typography, or overlay elements.
 * These will be stripped from prompts sent to image/video generation models.
 */
const TEXT_PATTERNS = [
  // Quoted text that the LLM might embed
  /["']?[A-Z][A-Za-z\s]*["']?\s*(text|overlay|badge|label|logo|banner|watermark|title|caption|subtitle|button|ui|typography|font)/gi,
  /["'](?:[^"']{1,50})["']/g,  // Quoted strings up to 50 chars (e.g., "Buy Now", "50% Off")
  // Direct references
  /\b(text\s*(overlay|on\s*screen|on\s*image|displayed|written|showing|says?|reads?))\b/gi,
  /\b(overlay\s*(text|with|showing|that\s*says?|containing))\b/gi,
  /\b(typography|typographic)\b/gi,
  /\b(with\s+text)\b/gi,
  /\b(text\s+on)\b/gi,
  /\b(on[\s-]?screen\s+text)\b/gi,
  // UI elements
  /\b(badge|watermark|logo|branding|price\s*tag|call[\s-]?out)\b/gi,
  /\b(button|cta\s*button|buy\s*now|shop\s*now|learn\s*more)\b/gi,
  /\b(banner|lower\s*third|title\s*card|end\s*card)\b/gi,
  // Specific common LLM mistakes
  /\bshowing\s+["']?[^,.]*["']?\s*(text|overlay|badge)/gi,
  /\bwith\s+["']?[^,.]*["']?\s*(text|overlay|badge)/gi,
];

/**
 * Strip text/typography/overlay references from a prompt.
 * Returns the cleaned prompt with only visual elements.
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt) return prompt;

  let cleaned = prompt;

  for (const pattern of TEXT_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Clean up double commas, trailing commas, and extra whitespace
  cleaned = cleaned
    .replace(/,\s*,/g, ',')           // double commas
    .replace(/\s{2,}/g, ' ')          // multiple spaces
    .replace(/^[\s,]+|[\s,]+$/g, '')  // leading/trailing whitespace or commas
    .trim();

  // If the prompt was entirely text references, return a safe fallback
  if (!cleaned || cleaned.length < 10) {
    return 'Product on clean background, soft studio lighting, professional photography';
  }

  return cleaned;
}
