// Audio Service - handles audio/voice generation logic

interface CaptionToken {
  text: string;
  startTime: number;
  endTime: number;
}

interface Caption {
  text: string;
  startTime: number;
  endTime: number;
  timestampMs?: number | null;
  confidence?: number | null;
  tokens?: CaptionToken[];
}

export interface AudioServiceOptions {
  elevenLabsApiKey: string;
  openAiApiKey: string;
  defaultVoiceId?: string;
}

export interface AudioGenerationInput {
  narration: string;
  voice: string;
  sceneDuration: number;
  speed?: number;
  narrationStyle?: string;
  elevenLabsModel?: string;
}

export interface AudioServiceResult {
  audioUrl: string;
  audioDuration: number;
  captions: Caption[];
}

export class AudioService {
  private elevenLabsApiKey: string;
  private openAiApiKey: string;
  private defaultVoiceId: string;

  constructor(options: AudioServiceOptions) {
    this.elevenLabsApiKey = options.elevenLabsApiKey;
    this.openAiApiKey = options.openAiApiKey;
    this.defaultVoiceId = options.defaultVoiceId || '21m00Tcm4TlvDq8ikWAM';
  }

  async generate(
    input: AudioGenerationInput,
    options: {
      userId: string;
      sceneNumber: number;
      audioBucket: any;
    }
  ): Promise<AudioServiceResult> {
    const { narration, voice, sceneDuration, speed = 1.0, narrationStyle = 'neutral', elevenLabsModel } = input;
    const { userId, sceneNumber, audioBucket } = options;

    const finalVoiceId = voice === 'alloy' ? this.defaultVoiceId : voice;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/with-timestamps`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: narration,
        model_id: elevenLabsModel || 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.5,
          useSpeakerBoost: true,
          speed: Math.max(0.7, Math.min(1.2, speed)),
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

    const audioBase64 = responseData.audio_base64;
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBuffer = bytes.buffer;

    const alignment = responseData.alignment;
    const audioDuration = alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1] || 0;

    const captions = this.generateCaptions(
      alignment.characters,
      alignment.character_start_times_seconds,
      alignment.character_end_times_seconds
    );

    const { generateUUID } = await import('../../utils/storage');
    const { audio_output_format, FOLDER_NAMES } = await import('../../config/table-config');

    const cleanNarration = narration.split(' ').slice(0, 2).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const fileName = `${cleanNarration}-${sceneNumber}-${generateUUID()}.${audio_output_format}`;
    const key = `${FOLDER_NAMES.VOICE_OVERS}/${userId}/${fileName}`;

    await audioBucket.put(key, audioBuffer, {
      httpMetadata: {
        contentType: 'audio/mpeg',
      },
    });

    const audioUrl = `https://audio.artflicks.app/${key}`;

    return {
      audioUrl,
      audioDuration,
      captions,
    };
  }

  private generateCaptions(
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

    return this.combineToPages(wordCaptions);
  }

  private combineToPages(wordCaptions: Caption[]): Caption[] {
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
}

export function createAudioService(options: AudioServiceOptions): AudioService {
  return new AudioService(options);
}
