import { VoiceModel } from '../types';

export const VOICES_CATALOG: VoiceModel[] = [
  // English (United States)
  { id: 'en-US-JennyNeural', name: 'Jenny', locale: 'en-US', language: 'English', region: 'United States', gender: 'Female', personality: 'Natural, Expressive & High Clarity', flag: '🇺🇸' },
  { id: 'en-US-GuyNeural', name: 'Guy', locale: 'en-US', language: 'English', region: 'United States', gender: 'Male', personality: 'Conversational, Warm & Professional', flag: '🇺🇸' },
  { id: 'en-US-AriaNeural', name: 'Aria', locale: 'en-US', language: 'English', region: 'United States', gender: 'Female', personality: 'Polite, Clear & Articulate', flag: '🇺🇸' },
  { id: 'en-US-DavisNeural', name: 'Davis', locale: 'en-US', language: 'English', region: 'United States', gender: 'Male', personality: 'Calm, Relaxed & Deep', flag: '🇺🇸' },
  { id: 'en-US-JaneNeural', name: 'Jane', locale: 'en-US', language: 'English', region: 'United States', gender: 'Female', personality: 'Friendly & Casual', flag: '🇺🇸' },
  { id: 'en-US-JasonNeural', name: 'Jason', locale: 'en-US', language: 'English', region: 'United States', gender: 'Male', personality: 'Confident & Dynamic', flag: '🇺🇸' },
  { id: 'en-US-SaraNeural', name: 'Sara', locale: 'en-US', language: 'English', region: 'United States', gender: 'Female', personality: 'Upbeat & Crisp', flag: '🇺🇸' },
  { id: 'en-US-TonyNeural', name: 'Tony', locale: 'en-US', language: 'English', region: 'United States', gender: 'Male', personality: 'Authoritative & Energetic', flag: '🇺🇸' },
  { id: 'en-US-NancyNeural', name: 'Nancy', locale: 'en-US', language: 'English', region: 'United States', gender: 'Female', personality: 'Storytelling & Warm', flag: '🇺🇸' },

  // English (Great Britain)
  { id: 'en-GB-SoniaNeural', name: 'Sonia', locale: 'en-GB', language: 'English', region: 'United Kingdom', gender: 'Female', personality: 'British Accent • Clear & Refined', flag: '🇬🇧' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', locale: 'en-GB', language: 'English', region: 'United Kingdom', gender: 'Male', personality: 'British Accent • Professional & Engaging', flag: '🇬🇧' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', locale: 'en-GB', language: 'English', region: 'United Kingdom', gender: 'Female', personality: 'Warm & Articulate', flag: '🇬🇧' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', locale: 'en-GB', language: 'English', region: 'United Kingdom', gender: 'Male', personality: 'Classic & Thoughtful', flag: '🇬🇧' },

  // English (Australia, Canada, India)
  { id: 'en-AU-NatashaNeural', name: 'Natasha', locale: 'en-AU', language: 'English', region: 'Australia', gender: 'Female', personality: 'Australian Accent • Friendly', flag: '🇦🇺' },
  { id: 'en-AU-WilliamNeural', name: 'William', locale: 'en-AU', language: 'English', region: 'Australia', gender: 'Male', personality: 'Australian Accent • Conversational', flag: '🇦🇺' },
  { id: 'en-CA-ClaraNeural', name: 'Clara', locale: 'en-CA', language: 'English', region: 'Canada', gender: 'Female', personality: 'Canadian Accent • Neutral', flag: '🇨🇦' },
  { id: 'en-CA-LiamNeural', name: 'Liam', locale: 'en-CA', language: 'English', region: 'Canada', gender: 'Male', personality: 'Canadian Accent • Calm', flag: '🇨🇦' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja', locale: 'en-IN', language: 'English', region: 'India', gender: 'Female', personality: 'Indian English Accent • Clear', flag: '🇮🇳' },
  { id: 'en-IN-PrabhatNeural', name: 'Prabhat', locale: 'en-IN', language: 'English', region: 'India', gender: 'Male', personality: 'Indian English Accent • Expressive', flag: '🇮🇳' },

  // Vietnamese
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My', locale: 'vi-VN', language: 'Vietnamese', region: 'Vietnam', gender: 'Female', personality: 'Giọng Bắc • Truyền cảm & Tự nhiên', flag: '🇻🇳' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh', locale: 'vi-VN', language: 'Vietnamese', region: 'Vietnam', gender: 'Male', personality: 'Giọng Bắc • Trầm ấm & Rõ ràng', flag: '🇻🇳' },

  // Spanish
  { id: 'es-ES-ElviraNeural', name: 'Elvira', locale: 'es-ES', language: 'Spanish', region: 'Spain', gender: 'Female', personality: 'Castilian Spanish • Expressive', flag: '🇪🇸' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', locale: 'es-ES', language: 'Spanish', region: 'Spain', gender: 'Male', personality: 'Castilian Spanish • Professional', flag: '🇪🇸' },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', locale: 'es-MX', language: 'Spanish', region: 'Mexico', gender: 'Female', personality: 'Latin American Spanish • Warm', flag: '🇲🇽' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge', locale: 'es-MX', language: 'Spanish', region: 'Mexico', gender: 'Male', personality: 'Latin American Spanish • Confident', flag: '🇲🇽' },

  // French
  { id: 'fr-FR-DeniseNeural', name: 'Denise', locale: 'fr-FR', language: 'French', region: 'France', gender: 'Female', personality: 'French • Refined & Melodic', flag: '🇫🇷' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', locale: 'fr-FR', language: 'French', region: 'France', gender: 'Male', personality: 'French • Calm & Articulate', flag: '🇫🇷' },

  // German
  { id: 'de-DE-KatjaNeural', name: 'Katja', locale: 'de-DE', language: 'German', region: 'Germany', gender: 'Female', personality: 'German • Crisp & Authoritative', flag: '🇩🇪' },
  { id: 'de-DE-ConradNeural', name: 'Conrad', locale: 'de-DE', language: 'German', region: 'Germany', gender: 'Male', personality: 'German • Professional & Warm', flag: '🇩🇪' },

  // Japanese
  { id: 'ja-JP-NanamiNeural', name: 'Nanami (七海)', locale: 'ja-JP', language: 'Japanese', region: 'Japan', gender: 'Female', personality: 'Japanese • Polite & Bright', flag: '🇯🇵' },
  { id: 'ja-JP-KeitaNeural', name: 'Keita (圭太)', locale: 'ja-JP', language: 'Japanese', region: 'Japan', gender: 'Male', personality: 'Japanese • Calm & Gentle', flag: '🇯🇵' },

  // Chinese (Mandarin)
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao (晓晓)', locale: 'zh-CN', language: 'Chinese', region: 'China', gender: 'Female', personality: 'Mandarin • Expressive & Natural', flag: '🇨🇳' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi (云希)', locale: 'zh-CN', language: 'Chinese', region: 'China', gender: 'Male', personality: 'Mandarin • Lively & Storytelling', flag: '🇨🇳' },

  // Korean
  { id: 'ko-KR-SunHiNeural', name: 'Sun-Hi (선히)', locale: 'ko-KR', language: 'Korean', region: 'South Korea', gender: 'Female', personality: 'Korean • Clear & Warm', flag: '🇰🇷' },
  { id: 'ko-KR-InJoonNeural', name: 'In-Joon (인준)', locale: 'ko-KR', language: 'Korean', region: 'South Korea', gender: 'Male', personality: 'Korean • Friendly & Calm', flag: '🇰🇷' },

  // Italian
  { id: 'it-IT-ElsaNeural', name: 'Elsa', locale: 'it-IT', language: 'Italian', region: 'Italy', gender: 'Female', personality: 'Italian • Dynamic & Melodic', flag: '🇮🇹' },
  { id: 'it-IT-DiegoNeural', name: 'Diego', locale: 'it-IT', language: 'Italian', region: 'Italy', gender: 'Male', personality: 'Italian • Confident & Smooth', flag: '🇮🇹' },

  // Portuguese
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', locale: 'pt-BR', language: 'Portuguese', region: 'Brazil', gender: 'Female', personality: 'Brazilian Portuguese • Vibrant', flag: '🇧🇷' },
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', locale: 'pt-BR', language: 'Portuguese', region: 'Brazil', gender: 'Male', personality: 'Brazilian Portuguese • Warm', flag: '🇧🇷' },
];

export const AVAILABLE_LANGUAGES = Array.from(
  new Set(VOICES_CATALOG.map((v) => v.language))
).sort();

export function getVoiceById(id: string): VoiceModel {
  const found = VOICES_CATALOG.find((v) => v.id === id);
  return found || VOICES_CATALOG[0];
}

export function filterVoices(
  language?: string,
  gender?: 'All' | 'Female' | 'Male',
  query?: string
): VoiceModel[] {
  return VOICES_CATALOG.filter((voice) => {
    if (language && language !== 'All' && voice.language !== language) {
      return false;
    }
    if (gender && gender !== 'All' && voice.gender !== gender) {
      return false;
    }
    if (query && query.trim() !== '') {
      const q = query.toLowerCase();
      const match =
        voice.name.toLowerCase().includes(q) ||
        voice.id.toLowerCase().includes(q) ||
        voice.region.toLowerCase().includes(q) ||
        voice.language.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}
