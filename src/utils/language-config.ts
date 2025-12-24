export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  enabled?: boolean;
}

export const getSampleText = (languageCode: string, voiceName: string): string => {
  const texts: Record<string, string> = {
    en: `Hello, I'm ${voiceName}. I can help narrate your content with a clear and expressive voice.`,
    es: `Hola, soy ${voiceName}. Puedo ayudar a narrar tu contenido con una voz clara y expresiva.`,
    fr: `Bonjour, je suis ${voiceName}. Je peux aider à narrer votre contenu avec une voix claire et expressive.`,
    de: `Hallo, ich bin ${voiceName}. Ich kann Ihnen helfen, Ihren Inhalt mit einer klaren und ausdrucksstarken Stimme zu erzählen.`,
    it: `Ciao, sono ${voiceName}. Posso aiutare a narrare i tuoi contenuti con una voce chiara ed espressiva.`,
    pt: `Olá, eu sou ${voiceName}. Posso ajudar a narrar seu conteúdo com uma voz clara e expressiva.`,
    nl: `Hallo, ik ben ${voiceName}. Ik kan helpen je content te vertellen met een duidelijke en expressieve stem.`,
    ru: `Привет, я ${voiceName}. Я могу помочь озвучить ваш контент чистым и выразительным голосом.`,
    hi: `नमस्ते, मैं ${voiceName} हूं। मैं एक स्पष्ट और अभिव्यंजक आवाज़ के साथ आपकी सामग्री का वर्णन करने में मदद कर सकता हूं।`,
    ta: `வணக்கம், நான் ${voiceName}. தெளிவான மற்றும் வெளிப்படையான குரலுடன் உங்கள் உள்ளடக்கத்தை விவரிக்க உதவலாம்.`,
    kn: `ನಮಸ್ಕಾರ, ನಾನು ${voiceName}. ಸ್ಪಷ್ಟ ಮತ್ತು ಅಭಿವ್ಯಕ್ತಿಯುತ ಧ್ವನಿಯೊಂದಿಗೆ ನಿಮ್ಮ ವಿಷಯವನ್ನು ನಿರೂಪಿಸಲು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.`,
    te: `నమస్కారం, నేను ${voiceName}. స్పష్టమైన మరియు వ్యక్తీకరణ స్వరంతో మీ కంటెంట్‌ను వర్ణించడంలో నేను సహాయం చేయగలను.`
  };
  return texts[languageCode] || texts.en;
};

export const languageOptions: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    enabled: true
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    enabled: true
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    enabled: true
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    enabled: true
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    enabled: true
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    enabled: true
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    enabled: true
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    enabled: true
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    enabled: false
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    enabled: false
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    enabled: false
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    enabled: false
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    enabled: false
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    enabled: false
  }
];

/**
 * Get language name by code
 * @param code Language code (e.g., 'en', 'es')
 * @returns Language name or 'English' as default
 */
export function getLanguageName(code: string): string {
  const language = languageOptions.find(lang => lang.code === code);
  return language?.name || 'English';
}

/**
 * Get language map as Record for quick lookup
 * @returns Record mapping language codes to names
 */
export function getLanguageMap(): Record<string, string> {
  return languageOptions.reduce((acc, lang) => {
    acc[lang.code] = lang.name;
    return acc;
  }, {} as Record<string, string>);
}

