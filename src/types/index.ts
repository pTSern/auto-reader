export interface TimedCue {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface VoiceModel {
  id: string; // e.g. "en-US-JennyNeural"
  name: string; // e.g. "Jenny"
  locale: string; // e.g. "en-US"
  language: string; // e.g. "English"
  region: string; // e.g. "United States"
  gender: 'Female' | 'Male';
  personality?: string;
  flag: string;
}

export interface FileReference {
  id: string;
  name: string;
  path?: string;
  size: number;
  type: string; // "pdf" | "txt" | "md" | etc.
  extractedText?: string;
  pageCount?: number;
  missing?: boolean;
}

export interface TextChunk {
  id: number;
  text: string;
  wordCount: number;
  status: 'pending' | 'generating' | 'ready' | 'error';
  audioBlob?: Blob;
  audioUrl?: string;
  cues: TimedCue[];
  duration: number;
  offsetSeconds: number; // time offset in overall audio timeline
}

export interface ShadowGenSettings {
  enabled: boolean;
  chunkSizeWords: number; // e.g. 500 words
  concurrencyMode: 'auto' | 'aggressive' | 'potato'; // auto detects CPU, aggressive pre-generates all, potato does 1 next
}

export interface PlaybackMemory {
  currentTime: number;
  duration: number;
  activeCueIndex: number;
  percentCompleted: number;
}

export interface ProjectData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  textContent: string;
  fileRefs: FileReference[];
  voiceSettings: {
    voiceId: string;
    rate: number; // percentage, e.g. 0 (-50 to +50)
    pitch: number; // Hz, e.g. 0 (-50 to +50)
    volume: number; // percentage 0 to 100
  };
  shadowSettings: ShadowGenSettings;
  audioBlob?: Blob;
  audioUrl?: string;
  cues: TimedCue[];
  playbackMemory: PlaybackMemory;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

export type ViewMode = 'full' | 'mini';
