// Audio generation service for Cloudflare Workers

import { R2Bucket } from '@cloudflare/workers-types';
import { Caption } from '../types';
import { generateUUID } from '../utils/storage';
import { DEFAULT_NARRATION_STYLE, NARRATION_STYLES, NarrationStyle } from '../config/narration-styles';
import { audio_output_format, FOLDER_NAMES } from '../config/table-config';

export interface AudioGenerationResult {
  audioUrl: string;
  audioDuration: number;
  captions: Caption[];
}

export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

const ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;

// Valid stability values for TTD (Text-to-Dialog) models like eleven_turbo_v2_5
const VALID_TTD_STABILITY_VALUES = [0.0, 0.5, 1.0] as const;

function validateSpeed(speed: number): number {
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
}

/**
 * Clamp stability to valid TTD model values: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)
 * Non-TTD models accept any value 0-1, but TTD models only accept these discrete values
 */
function clampToValidTTDStability(stability: number): number {
  // Find the closest valid TTD stability value
  let closest: number = VALID_TTD_STABILITY_VALUES[0];
  let minDiff = Math.abs(stability - closest);

  for (const valid of VALID_TTD_STABILITY_VALUES) {
    const diff = Math.abs(stability - valid);
    if (diff < minDiff) {
      minDiff = diff;
      closest = valid;
    }
  }

  return closest;
}

function convertCharacterTimestampsToWords(
  characters: string[],
  charStartTimes: number[],
  charEndTimes: number[]
): Caption[] {
  const wordCaptions: Caption[] = [];
  let currentWord = '';
  let wordStartTime = 0;
  let wordEndTime = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const startTime = charStartTimes[i] || 0;
    const endTime = charEndTimes[i] || 0;
    const isWordSeparator = /\s/.test(char);

    if (isWordSeparator) {
      if (currentWord.length > 0) {
        const isFirstWord = wordCaptions.length === 0;
        wordCaptions.push({
          text: isFirstWord ? currentWord : ` ${currentWord}`,
          startTime: wordStartTime,
          endTime: wordEndTime,
          timestampMs: wordStartTime * 1000,
          confidence: null,
          tokens: [{
            text: isFirstWord ? currentWord : ` ${currentWord}`,
            startTime: wordStartTime,
            endTime: wordEndTime,
          }],
        });
        currentWord = '';
      }
    } else {
      if (currentWord.length === 0) {
        wordStartTime = startTime;
      }
      currentWord += char;
      wordEndTime = endTime;
    }
  }

  if (currentWord.length > 0) {
    const isFirstWord = wordCaptions.length === 0;
    wordCaptions.push({
      text: isFirstWord ? currentWord : ` ${currentWord}`,
      startTime: wordStartTime,
      endTime: wordEndTime,
      timestampMs: wordStartTime * 1000,
      confidence: null,
      tokens: [{
        text: isFirstWord ? currentWord : ` ${currentWord}`,
        startTime: wordStartTime,
        endTime: wordEndTime,
      }],
    });
  }

  return wordCaptions;
}

function createTikTokStylePages(wordCaptions: Caption[]): Caption[] {
  const TIKTOK_PAGE_COMBINE_THRESHOLD_MS = 1200;
  const pages: Caption[] = [];
  let currentPageWords: Caption[] = [];
  let pageStartTime = 0;

  for (const word of wordCaptions) {
    if (currentPageWords.length === 0) {
      currentPageWords.push(word);
      pageStartTime = word.startTime;
    } else {
      const lastWord = currentPageWords[currentPageWords.length - 1];
      const gapMs = (word.startTime - lastWord.endTime) * 1000;

      if (gapMs > TIKTOK_PAGE_COMBINE_THRESHOLD_MS) {
        const lastPageWord = currentPageWords[currentPageWords.length - 1];
        pages.push({
          text: currentPageWords.map(w => w.text).join(''),
          startTime: pageStartTime,
          endTime: lastPageWord.endTime,
          timestampMs: pageStartTime * 1000,
          confidence: null,
          tokens: currentPageWords.map(w => ({
            text: w.text,
            startTime: w.startTime,
            endTime: w.endTime,
          })),
        });
        currentPageWords = [word];
        pageStartTime = word.startTime;
      } else {
        currentPageWords.push(word);
      }
    }
  }

  if (currentPageWords.length > 0) {
    const lastPageWord = currentPageWords[currentPageWords.length - 1];
    pages.push({
      text: currentPageWords.map(w => w.text).join(''),
      startTime: pageStartTime,
      endTime: lastPageWord.endTime,
      timestampMs: pageStartTime * 1000,
      confidence: null,
      tokens: currentPageWords.map(w => ({
        text: w.text,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
    });
  }

  return pages;
}

async function generateElevenLabsAudio(
  narration: string,
  voiceId: string,
  sceneDuration: number,
  requestedSpeed: number = 1.0,
  elevenLabsApiKey: string,
  defaultVoiceId?: string,
  narrationStyle: NarrationStyle = DEFAULT_NARRATION_STYLE,
  elevenLabsModel: string = ELEVENLABS_MODEL
): Promise<{ audioBuffer: ArrayBuffer; alignment: ElevenLabsAlignment; audioDuration: number }> {
  const validatedSpeed = validateSpeed(requestedSpeed);
  const finalVoiceId = voiceId === 'alloy' ? (defaultVoiceId || voiceId) : voiceId;

  // Get audio settings from narration style configuration
  const styleConfig = NARRATION_STYLES[narrationStyle];
  const audioSettings = styleConfig.audioSettings;

  // Use the text-to-speech endpoint with alignment data
  // Clamp stability to valid TTD values for models like eleven_turbo_v2_5
  const validStability = clampToValidTTDStability(audioSettings.stability);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: narration,
      model_id: elevenLabsModel,
      voice_settings: {
        stability: validStability,
        similarityBoost: audioSettings.similarityBoost,
        style: audioSettings.style,
        useSpeakerBoost: audioSettings.useSpeakerBoost,
        speed: validatedSpeed,
      },
      output_format: 'mp3_44100_128',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  const responseData = await response.json() as {
    audio_base64: string;
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };

  // Convert base64 audio to ArrayBuffer
  const audioBase64 = responseData.audio_base64;
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const audioBuffer = bytes.buffer;

  // Get actual alignment data from ElevenLabs
  const alignment: ElevenLabsAlignment = {
    characters: responseData.alignment.characters,
    character_start_times_seconds: responseData.alignment.character_start_times_seconds,
    character_end_times_seconds: responseData.alignment.character_end_times_seconds,
  };

  // Calculate actual audio duration from alignment
  const audioDuration = alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1] || 0;

  return {
    audioBuffer,
    alignment,
    audioDuration
  };
}


export async function generateSceneAudio(
  narration: string,
  voice: string,
  sceneDuration: number,
  userId: string,
  sceneNumber: number,
  speed: number,
  audioBucket: R2Bucket,
  elevenLabsApiKey: string,
  openAiApiKey: string,
  defaultVoiceId?: string,
  narrationStyle: NarrationStyle = DEFAULT_NARRATION_STYLE,
  elevenLabsModel?: string
): Promise<AudioGenerationResult> {
  // Always use ElevenLabs for all voices with character alignment
  const startTime = Date.now();
  const result = await generateElevenLabsAudio(
    narration,
    voice,
    sceneDuration,
    speed,
    elevenLabsApiKey,
    defaultVoiceId,
    narrationStyle,
    elevenLabsModel
  );
  const latencySeconds = (Date.now() - startTime) / 1000;

  // Track AI Usage
  const { trackAIUsageInternal } = await import('./usage-tracking');
  // We need env here. It's not passed directly to generateSceneAudio but we can't easily get it without refactoring.
  // Wait, generateSceneAudio takes args individually, it doesn't take 'env'.
  // But wait, the caller 'processSceneAudio' in queue-processor.ts HAS env.

  // Checking generateSceneAudio signature:
  // export async function generateSceneAudio(..., audioBucket: R2Bucket, ...)
  // It does NOT take 'env'. It takes specific keys.

  // Check queue-processor.ts to see how it calls generateSceneAudio.
  // I need to either pass 'env' to generateSceneAudio or track it in queue-processor.ts.
  // Tracking in queue-processor.ts seems better to avoid changing signature of generateSceneAudio too much, 
  // BUT generateSceneAudio is where the API call happens.

  // Let's modify generateSceneAudio to take optional Env or just track it in the caller?
  // Caller 'processSceneAudio' in 'src/services/queue-processor.ts' calls this.
  // Let's modify 'src/services/queue-processor.ts' instead? 
  // Implementation plan said "MODIFY audio-generation.ts".
  // If I modify audio-generation.ts I need to pass Env.
  // Let's look at audio-generation.ts signature again.
  // It takes elevenLabsApiKey, openAiApiKey.

  // It's cleaner to return usage metrics or track it in the caller.
  // However, for consistency, let's track it here if we can pass valid credentials.
  // But trackAIUsageInternal needs 'Env' object mainly for AI_METER_INGEST_KEY.
  // I don't see AI_METER_INGEST_KEY passed to generateSceneAudio.

  // Correct approach: Update 'processSceneAudio' in 'src/services/queue-processor.ts' to track usage.
  // OR update generateSceneAudio to take 'env' instead of just keys.
  // Updating generateSceneAudio signature is cleaner for future.

  // BUT, I can't easily change the signature without updating all callers.
  // Let's check callers. Only 'processSceneAudio' is likely calling it.

  // I'll stick to the plan but realize I need to modify queue-processor.ts to track audio usage 
  // OR modify generateSceneAudio to accept env.
  // Let's modify generateSceneAudio to take 'env' as a last optional parameter or part of options if possible.
  // Actually, let's look at `processSceneAudio` in `queue-processor.ts`. I haven't read that file yet.
  // I read `queue-consumer.ts`, which imports `processSceneAudio`.

  // Let's read `src/services/queue-processor.ts` first to see where `generateSceneAudio` is called.
  // Then I will decide.

  // For now, I will pause this Edit to AudioGeneration and read queue-processor.ts.


  const audioBuffer = result.audioBuffer;
  const audioDuration = result.audioDuration;
  let captions: Caption[] = [];

  // Generate captions from ElevenLabs character alignment
  if (result.alignment.characters.length > 0) {
    const wordCaptions = convertCharacterTimestampsToWords(
      result.alignment.characters,
      result.alignment.character_start_times_seconds,
      result.alignment.character_end_times_seconds
    );
    captions = createTikTokStylePages(wordCaptions);
  }

  // Upload audio to R2
  const cleanNarration = narration
    .split(' ')
    .slice(0, 2)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  const fileName = `${cleanNarration}-${sceneNumber}-${generateUUID()}.${audio_output_format}`;
  const key = `${FOLDER_NAMES.VOICE_OVERS}/${userId}/${fileName}`;

  await audioBucket.put(key, audioBuffer, {
    httpMetadata: {
      contentType: 'audio/mpeg',
    },
  });

  // Generate public URL
  // Note: Update this with your actual R2 public URL or custom domain
  // Format: https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/<key>
  // Or use a custom domain if configured
  const audioUrl = `https://audio.artflicks.app/${key}`;

  return {
    audioUrl,
    audioDuration,
    captions,
  };
}

