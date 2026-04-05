// Script Parser - Parse user script with embedded hints [Visual] Narration format

// Common motion verbs that indicate character action
const MOTION_VERBS = [
  "sharpening",
  "gripping",
  "running",
  "charging",
  "dropping",
  "falling",
  "sprinting",
  "laughing",
  "looking",
  "turning",
  "raising",
  "swinging",
  "jumping",
  "kneeling",
  "standing",
  "walking",
  "riding",
  "fighting",
  "clashing",
  "marching",
  "advancing",
  "retreating",
  "defending",
  "attacking",
  "drawing",
  "sheathing",
  "aiming",
  "firing",
  "reloading",
  "loading",
  "shouting",
  "screaming",
  "whispering",
  "pointing",
  "gesturing",
  "waving",
  "leaning",
  "crouching",
  "crawling",
  "creeping",
  "sneaking",
  "hiding",
  "emerging",
  "appearing",
  "vanishing",
  "fading",
  "glowing",
  "burning",
  "exploding",
  "collapsing",
  "rising",
  "falling",
  "floating",
  "flying",
  "dancing",
  "singing",
  "playing",
  "working",
  "building",
  "crafting",
  "forging",
  "hammering",
  "cutting",
  "slicing",
  "thrusting",
  "parrying",
  "blocking",
  "dodging",
  "ducking",
  "rolling",
  "diving",
  "leaping",
  "landing",
  "taking",
  "holding",
  "carrying",
  "lifting",
  "throwing",
  "catching",
  "reaching",
  "touching",
  "feeling",
  "smelling",
  "tasting",
  "watching",
  "observing",
  "staring",
  "glaring",
  "winking",
  "blinking",
  "breathing",
  "panting",
  "sweating",
  "bleeding",
  "dying",
  "living",
];

function containsMotionVerb(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MOTION_VERBS.some((verb) => lowerText.includes(verb));
}

function extractActionFromVisual(visualHint: string): {
  action: string | undefined;
  remainingVisual: string;
} {
  // Check for patterns like "samurai sharpening blade" or "hands gripping hilt"
  // Pattern: [subject] [verb-ing] [object]
  const actionPattern = new RegExp(
    `(\\w+\\s+(?:${MOTION_VERBS.join("|")})\\s+(\\w+(?:\\s+\\w+){0,3}))`,
    "i",
  );

  const match = visualHint.match(actionPattern);
  if (match) {
    const action = match[0].trim();
    const remainingVisual = visualHint
      .replace(match[0], "")
      .trim()
      .replace(/^[,.\\s]+/, "");
    return { action, remainingVisual };
  }

  return { action: undefined, remainingVisual: visualHint };
}

export interface AnchorScene {
  visualHint: string;
  narration: string;
  cameraAngle?: string;
  mood?: string;
  action?: string;
}

export interface ParsedScript {
  anchors: AnchorScene[];
  totalDuration: number;
  wordCount: number;
}

const WORDS_PER_SECOND = 2.5;
const CHARS_PER_SECOND = 12;

export function parseUserScript(script: string): ParsedScript {
  const anchors: AnchorScene[] = [];

  // Regex to match [Visual] Narration pattern
  // Captures: (1) visual hint in brackets, (2) narration text until next bracket or end
  const pattern = /\[([^\]]+)\]\s*([^\[]*(?=\[|$))/g;

  let match;
  while ((match = pattern.exec(script)) !== null) {
    const visualHint = match[1].trim();
    const narration = match[2].trim();

    if (visualHint && narration) {
      // Parse camera angle from visual hint if present: [Wide shot: Dark forest]
      let cameraAngle: string | undefined;
      let action: string | undefined;
      let actualVisualHint = visualHint;

      // Check for [Action: ...] pattern
      const actionMatch = actualVisualHint.match(/\[Action:\s*([^\]]+)\]/i);
      if (actionMatch) {
        action = actionMatch[1].trim();
        actualVisualHint = actualVisualHint.replace(actionMatch[0], "").trim();
      }

      // Check for camera angle with colon: [Camera: Description]
      const cameraMatch = actualVisualHint.match(/^([a-zA-Z\s]+):\s*(.+)$/);
      if (cameraMatch) {
        cameraAngle = cameraMatch[1].trim();
        actualVisualHint = cameraMatch[2].trim();
      }

      // Check for comma-separated format: [Camera, Description with motion]
      // Extract action from visual hint if it contains motion verbs
      if (!action && containsMotionVerb(actualVisualHint)) {
        const extracted = extractActionFromVisual(actualVisualHint);
        if (extracted.action) {
          action = extracted.action;
          actualVisualHint = extracted.remainingVisual;
        }
      }

      anchors.push({
        visualHint: actualVisualHint,
        narration,
        cameraAngle,
        action,
      });
    }
  }

  // If no anchors found, treat entire script as single scene
  if (anchors.length === 0 && script.trim()) {
    anchors.push({
      visualHint: "Story scene",
      narration: script.trim(),
    });
  }

  // Calculate word count from narration
  const wordCount = anchors.reduce((total, anchor) => {
    return (
      total + anchor.narration.split(/\s+/).filter((w) => w.length > 0).length
    );
  }, 0);

  // Calculate duration: use word count for better accuracy
  const totalDuration = Math.max(
    Math.round(wordCount / WORDS_PER_SECOND),
    anchors.length * 3, // Minimum 3 seconds per scene
  );

  return {
    anchors,
    totalDuration,
    wordCount,
  };
}

export function estimateDurationFromText(text: string): number {
  // Remove visual descriptions in [] brackets
  const narrationOnly = text.replace(/\[.*?\]/g, "").trim();

  // Count words from remaining narration
  const wordCount = narrationOnly.split(/\s+/).filter(Boolean).length;

  // Calculate: ~150 words/min = 2.5 words/sec
  const rawDuration = Math.ceil(wordCount / 2.5);

  // Apply min/max bounds
  return Math.max(Math.min(rawDuration, 180), 10);
}

export function formatAnchorsForLLM(anchors: AnchorScene[]): string {
  return anchors
    .map((anchor, index) => {
      let text = `- Scene ${index + 1}:`;
      if (anchor.visualHint) text += ` Visual [${anchor.visualHint}]`;
      if (anchor.cameraAngle) text += ` (${anchor.cameraAngle})`;
      if (anchor.action) text += ` [Action: ${anchor.action}]`;
      text += `, Narration "${anchor.narration}"`;
      return text;
    })
    .join("\n");
}
