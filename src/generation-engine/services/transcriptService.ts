// Transcript Service - handles transcription of audio/video to text

export interface TranscriptServiceOptions {
  openAiApiKey: string;
}

export interface TranscriptInput {
  audioUrl: string;
  language?: string;
  prompt?: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export class TranscriptService {
  private openAiApiKey: string;

  constructor(options: TranscriptServiceOptions) {
    this.openAiApiKey = options.openAiApiKey;
  }

  async transcribe(input: TranscriptInput): Promise<TranscriptResult> {
    const { audioUrl, language = 'en', prompt } = input;

    const formData = new FormData();
    formData.append('file', await this.fetchAsFile(audioUrl));
    formData.append('model', 'whisper-1');
    if (language) {
      formData.append('language', language);
    }
    if (prompt) {
      formData.append('prompt', prompt);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Transcription error: ${error}`);
    }

    const data = await response.json() as {
      text: string;
      segments?: TranscriptSegment[];
    };

    return {
      text: data.text,
      segments: data.segments || [],
      language,
    };
  }

  private async fetchAsFile(url: string): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();
    const fileName = url.split('/').pop() || 'audio.mp3';
    return new File([blob], fileName, { type: blob.type });
  }
}

export function createTranscriptService(options: TranscriptServiceOptions): TranscriptService {
  return new TranscriptService(options);
}
