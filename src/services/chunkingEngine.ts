import { TextChunk, TimedCue, ShadowGenSettings, VoiceModel } from '../types';
import { synthesizeSpeech, generateEstimatedCues } from './edgeTtsClient';
import { DesktopBridge } from './desktopBridge';
import { Logger } from './logger';

export interface ChunkProgressUpdate {
  chunks: TextChunk[];
  activeChunkId: number;
  completedChunks: number;
  totalChunks: number;
  isFirstChunkReady: boolean;
  isAllCompleted: boolean;
}

/**
 * Splits text into sentence-aligned chunks.
 * Sentences are never sliced in half.
 *
 * When useFastStartLadder is true, applies an adaptive ramp:
 * - Chunk 0: ~30 words (1-2 sentences) for near-instant (<400ms) audio playback.
 * - Chunk 1: ~100 words (bridge chunk) synthesized while Chunk 0 is already playing.
 * - Chunk 2: ~250 words.
 * - Chunk 3+: full targetWordCount (default 500 words).
 */
export function splitTextIntoChunks(
  text: string,
  targetWordCount: number = 500,
  useFastStartLadder: boolean = true
): TextChunk[] {
  if (!text || text.trim() === '') return [];

  // Split text by sentence terminators while preserving punctuation
  const sentences = text
    .split(/(?<=[.?!…\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return [
      {
        id: 0,
        text,
        wordCount: text.split(/\s+/).length,
        status: 'pending',
        cues: [],
        duration: 0,
        offsetSeconds: 0,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentWords = 0;
  let chunkId = 0;

  for (const sentence of sentences) {
    const sWords = sentence.split(/\s+/).length;

    // Calculate adaptive target word count for this chunk
    let threshold = targetWordCount;
    if (useFastStartLadder) {
      if (chunkId === 0) {
        threshold = Math.min(30, targetWordCount);
      } else if (chunkId === 1) {
        threshold = Math.min(100, targetWordCount);
      } else if (chunkId === 2) {
        threshold = Math.min(250, targetWordCount);
      }
    }

    // If adding this sentence exceeds target and we already have sentences, commit chunk
    if (currentWords + sWords > threshold && currentSentences.length > 0) {
      const chunkText = currentSentences.join(' ');
      chunks.push({
        id: chunkId++,
        text: chunkText,
        wordCount: currentWords,
        status: 'pending',
        cues: [],
        duration: 0,
        offsetSeconds: 0,
      });
      currentSentences = [];
      currentWords = 0;
    }

    currentSentences.push(sentence);
    currentWords += sWords;
  }

  // Final chunk
  if (currentSentences.length > 0) {
    chunks.push({
      id: chunkId++,
      text: currentSentences.join(' '),
      wordCount: currentWords,
      status: 'pending',
      cues: [],
      duration: 0,
      offsetSeconds: 0,
    });
  }

  Logger.info(`Text partitioned into ${chunks.length} chunks (fastStartLadder: ${useFastStartLadder}, max ~${targetWordCount} words/chunk)`);
  return chunks;
}

/**
 * Detects hardware concurrency to adapt shadow pre-generation
 */
export function getHardwareProfile(): { cores: number; isStrongCpu: boolean; defaultConcurrency: number } {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const isStrongCpu = cores >= 8;
  const defaultConcurrency = isStrongCpu ? 3 : 1; // 1 for standard/potato CPU, up to 3 for strong CPU

  return { cores, isStrongCpu, defaultConcurrency };
}

export class ChunkCoordinator {
  private chunks: TextChunk[] = [];
  private isAborted = false;
  private projectId?: string;
  private voice: string;
  private voiceModel?: VoiceModel;
  private rate: number;
  private pitch: number;
  private volume: number;
  private shadowSettings: ShadowGenSettings;
  private onProgress: (update: ChunkProgressUpdate) => void;
  private onFirstChunkReady?: (firstChunk: TextChunk) => void;
  private onChunkReady?: (chunk: TextChunk, allChunks: TextChunk[]) => void;

  constructor(
    projectId: string | undefined,
    text: string,
    voice: string,
    rate: number,
    pitch: number,
    volume: number,
    shadowSettings: ShadowGenSettings,
    onProgress: (update: ChunkProgressUpdate) => void,
    onFirstChunkReady?: (firstChunk: TextChunk) => void,
    onChunkReady?: (chunk: TextChunk, allChunks: TextChunk[]) => void,
    voiceModel?: VoiceModel
  ) {
    const useLadder = shadowSettings.useFastStartLadder ?? true;
    this.chunks = splitTextIntoChunks(text, shadowSettings.chunkSizeWords || 500, useLadder);
    this.projectId = projectId;
    this.voice = voice;
    this.voiceModel = voiceModel;
    this.rate = rate;
    this.pitch = pitch;
    this.volume = volume;
    this.shadowSettings = shadowSettings;
    this.onProgress = onProgress;
    this.onFirstChunkReady = onFirstChunkReady;
    this.onChunkReady = onChunkReady;
  }


  public abort() {
    this.isAborted = true;
    Logger.warn('Audio generation aborted by user');
  }

  public async start(): Promise<{ combinedBlob: Blob; combinedUrl: string; combinedCues: TimedCue[] }> {
    if (this.chunks.length === 0) {
      throw new Error('No text to generate.');
    }

    this.isAborted = false;
    Logger.info(`Starting chunk synthesis pipeline. Total chunks: ${this.chunks.length}`);

    // Phase 1: Immediately synthesize Chunk 0 (Fast Start)
    await this.synthesizeChunk(0);

    if (this.isAborted) {
      throw new Error('Generation stopped by user.');
    }

    const firstChunk = this.chunks[0];
    if (firstChunk.status === 'ready') {
      Logger.info(`Fast-start ready: Chunk 0 completed (${firstChunk.duration.toFixed(1)}s). Triggering playback!`);
      this.onFirstChunkReady?.(firstChunk);
      this.emitProgress(0, true, this.chunks.length === 1);
    }

    // If only 1 chunk, we are done
    if (this.chunks.length === 1) {
      return this.combineAllReadyChunks();
    }

    // Phase 2: Shadow generation for remaining chunks (Chunks 1..N)
    const { isStrongCpu } = getHardwareProfile();
    let maxConcurrent = 1;

    if (this.shadowSettings.enabled) {
      if (this.shadowSettings.concurrencyMode === 'aggressive' || (this.shadowSettings.concurrencyMode === 'auto' && isStrongCpu)) {
        maxConcurrent = Math.min(3, this.chunks.length - 1);
        Logger.info(`Shadow generation: High performance mode enabled (${maxConcurrent} parallel workers).`);
      } else {
        maxConcurrent = 1; // Standard / potato mode: 1 worker at a time
        Logger.info('Shadow generation: Standard potato mode (1 background worker at a time).');
      }
    } else {
      maxConcurrent = 1;
      Logger.info('Shadow generation OFF: Generating sequential next chunks in background.');
    }

    // Worker pool for remaining chunks
    let nextIndex = 1;
    const workerPromises: Promise<void>[] = [];

    const runWorker = async (workerId: number) => {
      while (nextIndex < this.chunks.length && !this.isAborted) {
        const chunkToProcess = nextIndex++;
        await this.synthesizeChunk(chunkToProcess);
        this.emitProgress(chunkToProcess, true, this.getCompletedCount() === this.chunks.length);
      }
    };

    for (let w = 0; w < maxConcurrent; w++) {
      workerPromises.push(runWorker(w + 1));
    }

    await Promise.all(workerPromises);

    if (this.isAborted) {
      throw new Error('Generation stopped by user.');
    }

    Logger.info('All text chunks generated successfully. Merging audio stream...');
    return this.combineAllReadyChunks();
  }

  private async synthesizeChunk(index: number): Promise<void> {
    if (this.isAborted || index >= this.chunks.length) return;

    const chunk = this.chunks[index];
    chunk.status = 'generating';
    this.emitProgress(index, index > 0, false);

    try {
      // Step 1: Check if this chunk is already synthesized and saved on disk!
      if (this.projectId && DesktopBridge.isDesktop()) {
        const isCached = await DesktopBridge.checkChunkCache(this.projectId, index, this.voiceModel);
        if (isCached) {
          const cachedBlob = await DesktopBridge.getChunkAudio(this.projectId, index, this.voiceModel);
          if (cachedBlob && cachedBlob.size > 0) {
            Logger.info(`Found cached Chunk ${index + 1} on disk (${cachedBlob.size} bytes). Reusing existing MP3!`);
            chunk.audioBlob = cachedBlob;
            chunk.audioUrl = URL.createObjectURL(cachedBlob);
            chunk.status = 'ready';

            // Generate approximate cues from text
            const cues = generateEstimatedCues(chunk.text);
            const lastCue = cues[cues.length - 1];
            chunk.rawCues = cues;
            chunk.duration = lastCue ? lastCue.end : Math.max(3, chunk.wordCount * 0.4);

            this.recalculateOffsets();
            this.onChunkReady?.(chunk, [...this.chunks]);
            return;
          }
        }
      }

      // Step 2: Synthesize via Edge-TTS if not cached
      Logger.info(`Synthesizing Chunk ${index + 1}/${this.chunks.length} (${chunk.wordCount} words)...`);
      const result = await synthesizeSpeech(
        chunk.text,
        this.voice,
        this.rate,
        this.pitch,
        this.volume
      );

      if (this.isAborted) {
        chunk.status = 'error';
        return;
      }

      chunk.audioBlob = result.audioBlob;
      chunk.audioUrl = result.audioUrl;
      chunk.status = 'ready';
      chunk.rawCues = result.cues && result.cues.length > 0 ? result.cues : generateEstimatedCues(chunk.text);

      // Save Chunk audio directly to disk file if running on desktop
      if (this.projectId && DesktopBridge.isDesktop()) {
        DesktopBridge.saveChunkAudio(this.projectId, index, result.audioBlob, this.voiceModel).catch((e) => {
          Logger.warn(`Failed to persist chunk ${index} to disk:`, e);
        });
      }

      // Calculate total duration of this chunk from cues
      const lastCue = chunk.rawCues[chunk.rawCues.length - 1];
      chunk.duration = lastCue ? lastCue.end : 5;

      this.recalculateOffsets();
      this.onChunkReady?.(chunk, [...this.chunks]);

      Logger.info(`Chunk ${index + 1} ready (${chunk.duration.toFixed(1)}s, offset: ${chunk.offsetSeconds.toFixed(1)}s).`);
    } catch (err: any) {
      Logger.error(`Chunk ${index + 1} synthesis failed:`, err.message || err);
      chunk.status = 'error';
    }
  }

  public recalculateOffsets(): void {
    let runningOffset = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      ch.offsetSeconds = runningOffset;

      // Ensure rawCues are always populated (from Edge-TTS if ready, or estimated if pending)
      if (!ch.rawCues || ch.rawCues.length === 0) {
        ch.rawCues = generateEstimatedCues(ch.text);
      }

      // Map cues with current running offset
      ch.cues = ch.rawCues.map((c, cIdx) => ({
        id: (ch.id * 1000) + cIdx,
        start: parseFloat((c.start + runningOffset).toFixed(2)),
        end: parseFloat((c.end + runningOffset).toFixed(2)),
        text: c.text,
      }));

      // Determine chunk duration: real duration if ready, else end timestamp of last estimated cue
      const lastCue = ch.rawCues[ch.rawCues.length - 1];
      const dur = ch.duration > 0 ? ch.duration : (lastCue ? lastCue.end : Math.max(2, ch.wordCount / 2.6));
      runningOffset = parseFloat((runningOffset + dur).toFixed(2));
    }
  }

  public getChunks(): TextChunk[] {
    return [...this.chunks];
  }

  public getAllCues(): TimedCue[] {
    this.recalculateOffsets();
    const all: TimedCue[] = [];
    for (const ch of this.chunks) {
      if (ch.cues && ch.cues.length > 0) {
        all.push(...ch.cues);
      }
    }
    return all;
  }

  private getCompletedCount(): number {
    return this.chunks.filter((c) => c.status === 'ready').length;
  }

  private emitProgress(activeId: number, firstReady: boolean, allDone: boolean) {
    this.onProgress({
      chunks: [...this.chunks],
      activeChunkId: activeId,
      completedChunks: this.getCompletedCount(),
      totalChunks: this.chunks.length,
      isFirstChunkReady: firstReady,
      isAllCompleted: allDone,
    });
  }

  public combineAllReadyChunks(): { combinedBlob: Blob; combinedUrl: string; combinedCues: TimedCue[] } {
    const readyChunks = this.chunks.filter((c) => c.status === 'ready' && c.audioBlob);

    if (readyChunks.length === 0) {
      throw new Error('No audio chunks were successfully generated.');
    }

    const allBlobs = readyChunks.map((c) => c.audioBlob!);
    const combinedBlob = new Blob(allBlobs, { type: 'audio/mp3' });
    const combinedUrl = URL.createObjectURL(combinedBlob);

    const combinedCues: TimedCue[] = [];
    readyChunks.forEach((c) => {
      combinedCues.push(...c.cues);
    });

    // Save combined.mp3 to disk file
    if (this.projectId && DesktopBridge.isDesktop()) {
      DesktopBridge.saveCombinedAudio(this.projectId, combinedBlob, this.voiceModel).catch((e) => {
        Logger.warn('Failed to persist combined.mp3 to disk:', e);
      });
    }

    return {
      combinedBlob,
      combinedUrl,
      combinedCues,
    };
  }
}

