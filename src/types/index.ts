export interface TimedCue {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  chunkId?: number;
  isReady?: boolean; // true if this line has audio generated & ready to play
  status?: 'ready' | 'generating' | 'pending' | 'error';
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
  rawCues?: TimedCue[];
  duration: number;
  offsetSeconds: number; // time offset in overall audio timeline
}

export interface ShadowGenSettings {
  enabled: boolean;
  chunkSizeWords: number; // e.g. 500 words
  concurrencyMode: 'auto' | 'aggressive' | 'potato'; // auto detects CPU, aggressive pre-generates all, potato does 1 next
  useFastStartLadder?: boolean; // Micro-chunk ladder for <500ms first audio playback
}

export interface PlaybackMemory {
  currentTime: number;
  duration: number;
  activeCueIndex: number;
  percentCompleted: number;
}

export interface VoiceTrackStatus {
  voiceSubpath: string; // e.g. "en-US/female_jenny"
  locale?: string;
  hasCombined: boolean;
  combinedUrl?: string | null;
  chunkCount: number;
  generatedChunkIndices: number[];
  mtime?: number;
}

export interface VoiceTrackData {
  voiceId: string;
  voiceSubpath: string;
  locale: string;
  gender: 'Female' | 'Male';
  name: string;
  hasCombined: boolean;
  combinedUrl?: string | null;
  chunkCount: number;
  generatedChunkIndices: number[];
  cues?: TimedCue[];
  duration?: number;
  updatedAt?: number;
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
  voiceTracks?: Record<string, VoiceTrackData>;
  swiftSettings?: {
    syncOffsetSec?: number; // Timing lead/lag offset in seconds (e.g. +0.25 displays text 0.25s faster)
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
}

export type ViewMode = 'full' | 'mini';
