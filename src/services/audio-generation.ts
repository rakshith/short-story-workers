// Audio generation service for Cloudflare Workers

import { R2Bucket } from '@cloudflare/workers-types';
import { Caption } from '../types';
import { generateUUID } from '../utils/storage';

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

function validateSpeed(speed: number): number {
  return Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
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
  defaultVoiceId?: string
): Promise<{ audioBuffer: ArrayBuffer; alignment: ElevenLabsAlignment; audioDuration: number }> {
  const validatedSpeed = validateSpeed(requestedSpeed);
  const finalVoiceId = voiceId === 'alloy' ? (defaultVoiceId || voiceId) : voiceId;

  // Use the text-to-speech endpoint with timestamps
  // Note: This requires ElevenLabs API v1 with output_format that includes timestamps
  // For now, we'll use the standard endpoint and estimate timing
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: narration,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.85,
        style: 0.5,
        use_speaker_boost: false,
        speed: validatedSpeed,
      },
      output_format: 'mp3_44100_128',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();

  // Estimate audio duration based on text length and speed
  // Average speaking rate: ~150 words per minute = ~2.5 words per second
  // With speed adjustment: actualRate = baseRate * speed
  const wordCount = narration.split(/\s+/).length;
  const baseWordsPerSecond = 2.5;
  const actualWordsPerSecond = baseWordsPerSecond * validatedSpeed;
  const estimatedDuration = wordCount / actualWordsPerSecond;

  // Create a simple alignment estimate for caption generation
  // This is a simplified version - for production, you may want to use
  // ElevenLabs' actual alignment data if available on your plan
  const characters = narration.split('');
  const charDuration = estimatedDuration / characters.length;
  const alignment: ElevenLabsAlignment = {
    characters: characters,
    character_start_times_seconds: characters.map((_, i) => i * charDuration),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * charDuration),
  };

  return { 
    audioBuffer, 
    alignment, 
    audioDuration: estimatedDuration 
  };
}

async function generateOpenAIAudio(
  narration: string,
  voice: string,
  openAiApiKey: string
): Promise<{ audioBuffer: ArrayBuffer; audioDuration: number }> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      voice: voice,
      input: narration,
      response_format: 'mp3',
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS error: ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const wordCount = narration.split(/\s+/).length;
  const audioDuration = Math.ceil(wordCount / 2.75);

  return { audioBuffer, audioDuration };
}

function getTtsProviderByVoiceId(voice: string): 'elevenlabs' | 'openai' {
  // Simple heuristic - adjust based on your voice IDs
  if (voice === 'alloy' || voice === 'echo' || voice === 'fable' || voice === 'onyx' || voice === 'nova' || voice === 'shimmer') {
    return 'openai';
  }
  return 'elevenlabs';
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
  defaultVoiceId?: string
): Promise<AudioGenerationResult> {
  const ttsProvider = getTtsProviderByVoiceId(voice);
  let audioBuffer: ArrayBuffer;
  let audioDuration: number;
  let captions: Caption[] = [];

  if (ttsProvider === 'elevenlabs') {
    const result = await generateElevenLabsAudio(
      narration,
      voice,
      sceneDuration,
      speed,
      elevenLabsApiKey,
      defaultVoiceId
    );

    audioBuffer = result.audioBuffer;
    audioDuration = result.audioDuration;

    // Generate captions from alignment
    if (result.alignment.characters.length > 0) {
      const wordCaptions = convertCharacterTimestampsToWords(
        result.alignment.characters,
        result.alignment.character_start_times_seconds,
        result.alignment.character_end_times_seconds
      );
      captions = createTikTokStylePages(wordCaptions);
    }
  } else {
    const result = await generateOpenAIAudio(narration, voice, openAiApiKey);
    audioBuffer = result.audioBuffer;
    audioDuration = result.audioDuration;
    captions = [];
  }

  // Upload audio to R2
  const cleanNarration = narration
    .split(' ')
    .slice(0, 2)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  const fileName = `${cleanNarration}-${sceneNumber}-${generateUUID()}.mp3`;
  const key = `voice-overs/${userId}/${fileName}`;

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

