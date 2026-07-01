import { SkillContext } from './types';
import { IntentMetadata } from '../types';

export interface IntentAnalyzer {
  analyze(prompt: string): Promise<IntentMetadata>;
}

const INTENT_ANALYSIS_PROMPT = `Analyze the following user prompt and extract structured metadata for visual content generation. Return ONLY a JSON object with these fields:

{
  "contentType": "product|health|story|educational|food|fitness|tech|entertainment|nature|travel|automotive|fashion|finance|other",
  "contentSubtype": "optional more specific category (e.g., 'skincare' for product, 'anatomy' for health)",
  "mood": "premium|dramatic|educational|energetic|serene|mysterious|playful|epic|intimate|cinematic",
  "atmosphere": "warm|cool|neutral|ethereal|gritty|minimalist|maximalist|futuristic|organic|industrial",
  "lightingStyle": "studio|golden_hour|dramatic|soft|high_key|low_key|neon|natural|clinical|cinematic",
  "cameraStyle": "portrait|macro|wide|aerial|dynamic|locked|tracking|handheld|dutch|overhead",
  "textureStyle": "premium|organic|technical|minimalist|textured|smooth|rough|glossy|matte|holographic",
  "targetModel": "optional: flux|midjourney|kling|seedance|veo|runway if implied by context"
}

ANALYSIS RULES:
1. contentType: What is the primary subject matter?
2. contentSubtype: More specific category if applicable (leave undefined if not clear)
3. mood: What emotional tone should the visuals convey?
4. atmosphere: What environmental feeling should the visuals have?
5. lightingStyle: What lighting approach fits this content?
6. cameraStyle: What camera angle/movement fits this content?
7. textureStyle: What material/surface quality fits this content?
8. targetModel: Only include if user explicitly mentions a model or if clearly implied

EXAMPLES:
- "Make a video about how bananas help digestion" → contentType: "health", contentSubtype: "digestive system", mood: "educational", atmosphere: "organic", lightingStyle: "soft", cameraStyle: "macro", textureStyle: "organic"
- "Create a premium ad for our new watch" → contentType: "product", contentSubtype: "luxury goods", mood: "premium", atmosphere: "minimalist", lightingStyle: "dramatic", cameraStyle: "macro", textureStyle: "premium"
- "Tell the story of a skeleton learning to dance" → contentType: "story", contentSubtype: "character journey", mood: "playful", atmosphere: "ethereal", lightingStyle: "dramatic", cameraStyle: "dynamic", textureStyle: "textured"

Return ONLY the JSON object, no explanation.`;

export class LLMIntentAnalyzer implements IntentAnalyzer {
  private llmCall: (prompt: string) => Promise<string>;

  constructor(llmCall: (prompt: string) => Promise<string>) {
    this.llmCall = llmCall;
  }

  async analyze(prompt: string): Promise<IntentMetadata> {
    const fullPrompt = `${INTENT_ANALYSIS_PROMPT}\n\nUSER PROMPT: "${prompt}"`;
    
    try {
      const response = await this.llmCall(fullPrompt);
      const metadata = this.parseResponse(response);
      return metadata;
    } catch (error) {
      console.error('[IntentAnalyzer] Failed to analyze intent:', error);
      return this.getDefaultMetadata(prompt);
    }
  }

  private parseResponse(response: string): IntentMetadata {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    return {
      contentType: parsed.contentType || 'other',
      contentSubtype: parsed.contentSubtype,
      mood: parsed.mood || 'cinematic',
      atmosphere: parsed.atmosphere || 'neutral',
      lightingStyle: parsed.lightingStyle || 'cinematic',
      cameraStyle: parsed.cameraStyle || 'dynamic',
      textureStyle: parsed.textureStyle || 'premium',
      targetModel: parsed.targetModel,
    };
  }

  private getDefaultMetadata(prompt: string): IntentMetadata {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('how') || lowerPrompt.includes('what is') || lowerPrompt.includes('explain')) {
      return {
        contentType: 'educational',
        mood: 'educational',
        atmosphere: 'neutral',
        lightingStyle: 'soft',
        cameraStyle: 'wide',
        textureStyle: 'minimalist',
      };
    }
    
    if (lowerPrompt.includes('story') || lowerPrompt.includes('tale') || lowerPrompt.includes('once upon')) {
      return {
        contentType: 'story',
        mood: 'cinematic',
        atmosphere: 'ethereal',
        lightingStyle: 'dramatic',
        cameraStyle: 'dynamic',
        textureStyle: 'textured',
      };
    }
    
    return {
      contentType: 'other',
      mood: 'cinematic',
      atmosphere: 'neutral',
      lightingStyle: 'cinematic',
      cameraStyle: 'dynamic',
      textureStyle: 'premium',
    };
  }
}
