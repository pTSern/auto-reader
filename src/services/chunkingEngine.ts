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

const CPU_THREADS_STORAGE_KEY = 'voiceflow_global_cpu_threads';

export function getMaxHardwareThreads(): number {
  return typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
}

export function getGlobalCpuThreads(): number {
  const maxThreads = getMaxHardwareThreads();
  const defaultThreads = Math.min(3, maxThreads);
  try {
    const saved = localStorage.getItem(CPU_THREADS_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= maxThreads) {
        return parsed;
      }
    }
  } catch (e) {}
  return defaultThreads;
}

export function setGlobalCpuThreads(threads: number): void {
  const maxThreads = getMaxHardwareThreads();
  const clamped = Math.max(1, Math.min(maxThreads, threads));
  try {
    localStorage.setItem(CPU_THREADS_STORAGE_KEY, String(clamped));
  } catch (e) {}
}

/**
 * Detects hardware concurrency to adapt shadow pre-generation
 */
export function getHardwareProfile(): { cores: number; isStrongCpu: boolean; defaultConcurrency: number } {
  const cores = getMaxHardwareThreads();
  const isStrongCpu = cores >= 8;
  const defaultConcurrency = getGlobalCpuThreads();

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


  private pendingQueue: number[] = [];

  public abort() {
    this.isAborted = true;
    this.pendingQueue = [];
    Logger.warn('Audio generation aborted by user');
  }

  public prioritizeChunk(targetChunkId: number): boolean {
    if (targetChunkId < 0 || targetChunkId >= this.chunks.length) return false;
    const chunk = this.chunks[targetChunkId];
    if (chunk.status === 'ready') {
      return true;
    }
    // Remove from queue if present and prepend to the front
    this.pendingQueue = this.pendingQueue.filter((id) => id !== targetChunkId);
    this.pendingQueue.unshift(targetChunkId);
    Logger.info(`Chunk Coordinator: Prioritized Chunk #${targetChunkId + 1} to front of generation queue.`);
    return true;
  }

  public async ensureChunkReady(targetChunkId: number): Promise<TextChunk | null> {
    if (targetChunkId < 0 || targetChunkId >= this.chunks.length) return null;
    const chunk = this.chunks[targetChunkId];
    if (chunk.status === 'ready') return chunk;

    this.prioritizeChunk(targetChunkId);

    if (chunk.status !== 'generating') {
      await this.synthesizeChunk(targetChunkId);
      this.emitProgress(targetChunkId, true, this.getCompletedCount() === this.chunks.length);
    } else {
      let waited = 0;
      while ((chunk.status as string) === 'generating' && waited < 120 && !this.isAborted) {
        await new Promise((r) => setTimeout(r, 100));
        waited++;
      }
    }
    const finalChunk = this.chunks[targetChunkId];
    return (finalChunk.status as string) === 'ready' ? finalChunk : null;
  }

  public async start(startChunkId: number = 0): Promise<{ combinedBlob: Blob; combinedUrl: string; combinedCues: TimedCue[] }> {
    if (this.chunks.length === 0) {
      throw new Error('No text to generate.');
    }

    this.isAborted = false;
    const clampedStart = Math.max(0, Math.min(this.chunks.length - 1, startChunkId));
    Logger.info(`Starting chunk synthesis pipeline. Target start chunk: #${clampedStart + 1}, Total chunks: ${this.chunks.length}`);

    // Phase 1: Immediately synthesize or confirm startChunkId
    if (this.chunks[clampedStart].status !== 'ready') {
      await this.synthesizeChunk(clampedStart);
    }

    if (this.isAborted) {
      throw new Error('Generation stopped by user.');
    }

    const startChunk = this.chunks[clampedStart];
    if (startChunk.status === 'ready') {
      Logger.info(`Playback ready: Chunk #${clampedStart + 1} completed (${startChunk.duration.toFixed(1)}s). Triggering playback!`);
      this.onFirstChunkReady?.(startChunk);
      this.emitProgress(clampedStart, true, this.getCompletedCount() === this.chunks.length);
    }

    // If only 1 chunk, we are done
    if (this.chunks.length === 1) {
      return this.combineAllReadyChunks();
    }

    // Phase 2: Build bi-directional queue starting forward from clampedStart + 1 to N - 1, then wrapping 0 to clampedStart - 1
    const sequence: number[] = [];
    for (let i = clampedStart + 1; i < this.chunks.length; i++) {
      sequence.push(i);
    }
    for (let i = 0; i < clampedStart; i++) {
      sequence.push(i);
    }

    // Filter out chunks that are already loaded/ready from disk cache
    this.pendingQueue = sequence.filter((idx) => this.chunks[idx].status !== 'ready');

    const userConfiguredThreads = getGlobalCpuThreads();
    const maxDeviceThreads = getMaxHardwareThreads();
    let maxConcurrent = 1;

    if (this.shadowSettings.enabled) {
      if (this.shadowSettings.concurrencyMode === 'potato') {
        maxConcurrent = 1;
        Logger.info('Shadow generation: Potato mode active (1 background worker).');
      } else {
        maxConcurrent = Math.min(userConfiguredThreads, Math.max(1, this.chunks.length - 1));
        Logger.info(`Shadow generation: Using ${maxConcurrent} CPU worker threads (User config: ${userConfiguredThreads}/${maxDeviceThreads} threads).`);
      }
    } else {
      maxConcurrent = 1;
      Logger.info('Shadow generation OFF: Generating sequential next chunks in background.');
    }

    const workerPromises: Promise<void>[] = [];

    const runWorker = async (workerId: number) => {
      while (this.pendingQueue.length > 0 && !this.isAborted) {
        const chunkToProcess = this.pendingQueue.shift();
        if (chunkToProcess === undefined) break;
        if (this.chunks[chunkToProcess]?.status === 'ready') continue;
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
    if (chunk.status === 'ready' || chunk.status === 'generating') return;
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

            // Load exact cues or scale estimated cues with exact MP3 duration
            const cueData = await DesktopBridge.getChunkCues(this.projectId, index, this.voiceModel);
            if (cueData?.cues && cueData.cues.length > 0) {
              chunk.rawCues = cueData.cues;
              chunk.duration = cueData.duration || cueData.cues[cueData.cues.length - 1].end;
            } else {
              const estCues = generateEstimatedCues(chunk.text);
              const exactDur = cueData?.duration || Math.max(3, chunk.wordCount * 0.4);
              const estEnd = estCues[estCues.length - 1]?.end || 1;
              const scale = exactDur / estEnd;
              chunk.rawCues = estCues.map((c) => ({
                ...c,
                start: parseFloat((c.start * scale).toFixed(2)),
                end: parseFloat((c.end * scale).toFixed(2)),
              }));
              chunk.duration = exactDur;
            }

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

      // Calculate total duration of this chunk from cues
      const lastCue = chunk.rawCues[chunk.rawCues.length - 1];
      chunk.duration = lastCue ? lastCue.end : 5;

      // Save Chunk audio directly to disk file with synchronized timing cues if running on desktop
      if (this.projectId && DesktopBridge.isDesktop()) {
        DesktopBridge.saveChunkAudio(
          this.projectId,
          index,
          result.audioBlob,
          this.voiceModel,
          chunk.rawCues,
          chunk.duration
        ).catch((e) => {
          Logger.warn(`Failed to persist chunk ${index} to disk:`, e);
        });
      }

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
      const isChunkReady = ch.status === 'ready';
      ch.cues = ch.rawCues.map((c, cIdx) => ({
        id: (ch.id * 1000) + cIdx,
        start: parseFloat((c.start + runningOffset).toFixed(2)),
        end: parseFloat((c.end + runningOffset).toFixed(2)),
        text: c.text,
        chunkId: ch.id,
        isReady: isChunkReady,
        status: ch.status,
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

  /**
   * Fast-scans and hydrates all chunks that already exist on disk.
   * Enables instant playback of existing chunks without running synthesis.
   */
  public async hydrateCachedChunks(): Promise<{
    readyCount: number;
    totalCount: number;
    chunks: TextChunk[];
    cues: TimedCue[];
    firstReadyChunk?: TextChunk;
  }> {
    if (!this.projectId || !DesktopBridge.isDesktop()) {
      this.recalculateOffsets();
      return {
        readyCount: 0,
        totalCount: this.chunks.length,
        chunks: [...this.chunks],
        cues: this.getAllCues(),
      };
    }

    let readyCount = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      const isCached = await DesktopBridge.checkChunkCache(this.projectId, i, this.voiceModel);
      if (isCached) {
        const audioUrl = await DesktopBridge.getChunkAudioUrl(this.projectId, i, this.voiceModel);
        if (audioUrl) {
          ch.audioUrl = audioUrl;
          ch.status = 'ready';
          // Load exact cues or scale estimated cues with exact MP3 duration
          const cueData = await DesktopBridge.getChunkCues(this.projectId, i, this.voiceModel);
          if (cueData?.cues && cueData.cues.length > 0) {
            ch.rawCues = cueData.cues;
            ch.duration = cueData.duration || cueData.cues[cueData.cues.length - 1].end;
          } else {
            const estCues = generateEstimatedCues(ch.text);
            const exactDur = cueData?.duration || Math.max(3, ch.wordCount * 0.4);
            const estEnd = estCues[estCues.length - 1]?.end || 1;
            const scale = exactDur / estEnd;
            ch.rawCues = estCues.map((c) => ({
              ...c,
              start: parseFloat((c.start * scale).toFixed(2)),
              end: parseFloat((c.end * scale).toFixed(2)),
            }));
            ch.duration = exactDur;
          }
          readyCount++;
        }
      }
    }

    this.recalculateOffsets();
    const cues = this.getAllCues();
    const firstReady = this.chunks.find((c) => c.status === 'ready' && c.audioUrl);

    Logger.info(`Hydrated ${readyCount}/${this.chunks.length} cached chunks from disk for project ${this.projectId}`);

    return {
      readyCount,
      totalCount: this.chunks.length,
      chunks: [...this.chunks],
      cues,
      firstReadyChunk: firstReady,
    };
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
      const readyCues = c.cues.map((cue) => ({
        ...cue,
        chunkId: c.id,
        isReady: true,
        status: 'ready' as const,
      }));
      combinedCues.push(...readyCues);
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

