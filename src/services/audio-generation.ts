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
  elevenLabsModel: string = ELEVENLABS_MODEL,
  enableCaptions: boolean = true
): Promise<{ audioBuffer: ArrayBuffer; alignment: ElevenLabsAlignment; audioDuration: number }> {
  const validatedSpeed = validateSpeed(requestedSpeed);
  const finalVoiceId = voiceId === 'alloy' ? (defaultVoiceId || voiceId) : voiceId;

  // Get audio settings from narration style configuration
  const styleConfig = NARRATION_STYLES[narrationStyle];
  const audioSettings = styleConfig.audioSettings;

  // Clamp stability to valid TTD values for models like eleven_turbo_v2_5
  const validStability = clampToValidTTDStability(audioSettings.stability);

  // When captions are disabled, use the cheaper/faster endpoint without timestamps.
  // This skips the character-alignment computation on ElevenLabs' side.
  const endpoint = enableCaptions
    ? `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/with-timestamps`
    : `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`;

  const response = await fetch(endpoint, {
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

  let audioBuffer: ArrayBuffer;
  let alignment: ElevenLabsAlignment;
  let audioDuration: number;

  if (enableCaptions) {
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
    audioBuffer = bytes.buffer;

    // Get actual alignment data from ElevenLabs
    alignment = {
      characters: responseData.alignment.characters,
      character_start_times_seconds: responseData.alignment.character_start_times_seconds,
      character_end_times_seconds: responseData.alignment.character_end_times_seconds,
    };

    // Calculate actual audio duration from alignment
    audioDuration = alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1] || 0;
  } else {
    // No alignment data — decode MP3 binary directly and estimate duration
    audioBuffer = await response.arrayBuffer();
    alignment = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
    // Rough estimate: sceneDuration is a fine placeholder; exact duration can be measured later if needed
    audioDuration = sceneDuration;
  }

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
  elevenLabsModel?: string,
  folderOverride?: string,
  enableCaptions: boolean = true,
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
    elevenLabsModel,
    enableCaptions
  );
  const latencySeconds = (Date.now() - startTime) / 1000;

  const audioBuffer = result.audioBuffer;
  const audioDuration = result.audioDuration;
  let captions: Caption[] = [];

  // Generate captions from ElevenLabs character alignment (skipped when captions disabled)
  if (enableCaptions && result.alignment.characters.length > 0) {
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
  const folder = folderOverride || FOLDER_NAMES.VOICE_OVERS;
  const key = `${folder}/${userId}/${fileName}`;

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

/**
 * Transcribe an audio file using ElevenLabs STT (scribe_v2)
 * Uses the @elevenlabs/elevenlabs-js SDK for proper integration
 */
export async function transcribeUploadedAudio(
  audioUrl: string,
  elevenLabsApiKey: string,
): Promise<Caption[]> {
  console.log(`[STT] Transcribing audio: ${audioUrl}`);

  // Download the audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio for transcription: ${audioResponse.statusText}`);
  }
  const audioBlob = await audioResponse.blob();
  const audioFile = new File([audioBlob], 'audio.mp3', {
    type: audioResponse.headers.get('content-type') || 'audio/mpeg',
  });

  // Use ElevenLabs SDK for transcription
  const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
  const client = new ElevenLabsClient({ apiKey: elevenLabsApiKey });

  const result = await client.speechToText.convert({
    file: audioFile,
    modelId: 'scribe_v2',
    timestampsGranularity: 'word',
  });

  console.log(`[STT] Transcription complete: ${result.text.substring(0, 100)}...`);

  // Convert to Caption[] format (same as TTS alignment output)
  const captions = convertSTTWordsToCaptions(result.words);
  return captions;
}

/**
 * Convert ElevenLabs STT word output to Caption[] format
 * Matches the format used by convertCharacterTimestampsToWords from TTS alignment
 */
function convertSTTWordsToCaptions(
  words: Array<{ text: string; start?: number; end?: number; type?: string }>
): Caption[] {
  const captions: Caption[] = [];

  for (const word of words) {
    if (word.type === 'spacing' || word.start == null || word.end == null) continue; // Skip spacing tokens

    captions.push({
      text: word.text,
      startTime: word.start / 1000, // ElevenLabs returns ms, convert to seconds
      endTime: word.end / 1000,
      timestampMs: word.start,
      confidence: null,
      tokens: [{
        text: word.text,
        startTime: word.start / 1000,
        endTime: word.end / 1000,
      }],
    });
  }

  return captions;
}

