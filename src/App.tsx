import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { FileIngestPanel } from './components/FileIngestPanel';
import { WorkspacePanel } from './components/WorkspacePanel';
import { VoiceSettingsPanel } from './components/VoiceSettingsPanel';
import { BottomPlayerBar } from './components/BottomPlayerBar';
import { FloatingMiniPlayer } from './components/FloatingMiniPlayer';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { StorageSettingsModal } from './components/StorageSettingsModal';
import { LogViewerModal } from './components/LogViewerModal';
import { MobileHeader } from './components/MobileHeader';
import { MobilePlayerSheet } from './components/MobilePlayerSheet';
import { MobileFileIngestModal } from './components/MobileFileIngestModal';
import { MobileSettingsModal } from './components/MobileSettingsModal';
import { ProjectCleanupModal } from './components/ProjectCleanupModal';
import { ProjectData, FileReference, VoiceModel, TimedCue, ViewMode, TextChunk, VoiceTrackStatus, PlaybackMemory } from './types';
import { getVoiceById, getVoiceFolderSubpath } from './services/voicesCatalog';
import { exportToSrt } from './services/edgeTtsClient';
import { calculateTextStats } from './services/pdfExtractor';
import {
  saveProject,
  persistPlaybackMemory,
  savePlaybackProgress,
  loadPlaybackProgress,
  getLastActiveProject,
  setLastActiveProject,
  getAllProjects,
  deleteProject,
  createDefaultProject,
} from './services/projectStorage';
import { DesktopBridge } from './services/desktopBridge';
import { ChunkCoordinator, splitTextIntoChunks } from './services/chunkingEngine';
import { Logger } from './services/logger';

/**
 * Fast O(log N) binary search for active subtitle cue.
 * Replaces linear O(N) scan that caused lag on documents with thousands of sentences.
 */
function findActiveCueIndex(cues: TimedCue[], currentTime: number): number {
  if (!cues || cues.length === 0) return -1;
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (currentTime >= cue.start && currentTime <= cue.end) {
      return mid;
    } else if (currentTime < cue.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // If between cues (e.g. gap between sentences), find closest preceding cue
  if (high >= 0 && high < cues.length && currentTime >= cues[high].start) {
    return high;
  }
  return Math.max(0, Math.min(low, cues.length - 1));
}

export function App() {
  // Active Project State
  const [project, setProject] = useState<ProjectData>(createDefaultProject());
  const [projectsList, setProjectsList] = useState<ProjectData[]>([]);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(85);
  const [activeCueIndex, setActiveCueIndex] = useState<number>(-1);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [isSwiftRead, setIsSwiftRead] = useState<boolean>(() => {
    try {
      return localStorage.getItem('voiceflow_swift_read') === 'true';
    } catch {
      return false;
    }
  });
  const [syncOffsetSec, setSyncOffsetSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('voiceflow_sync_offset_sec');
      return saved !== null ? parseFloat(saved) : 0.20;
    } catch {
      return 0.20;
    }
  });
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState<boolean>(false);
  const [settingsTargetProject, setSettingsTargetProject] = useState<ProjectData | null>(null);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState<boolean>(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState<boolean>(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState<boolean>(false);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [chunkProgress, setChunkProgress] = useState<{
    completedChunks: number;
    totalChunks: number;
    activeChunkId: number;
  } | null>(null);
  const [resumeNotification, setResumeNotification] = useState<string | null>(null);
  const [voiceStatuses, setVoiceStatuses] = useState<Record<string, VoiceTrackStatus>>({});

  const refreshVoiceStatuses = async (projectId: string) => {
    if (!projectId || !DesktopBridge.isDesktop()) return;
    try {
      const statuses = await DesktopBridge.getProjectVoiceStatuses(projectId);
      setVoiceStatuses(statuses);
    } catch (e) {
      console.warn('Failed to load voice statuses', e);
    }
  };

  useEffect(() => {
    if (project.id) {
      refreshVoiceStatuses(project.id);
    }
  }, [project.id]);

  // Coordinator & Audio Element Refs
  const coordinatorRef = useRef<ChunkCoordinator | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const cuesRef = useRef<TimedCue[]>(project.cues);
  const chunksRef = useRef<TextChunk[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const isChunkStreamingRef = useRef<boolean>(false);
  const isBufferingNextChunkRef = useRef<boolean>(false);
  const rapidJumpHistoryRef = useRef<number[]>([]);

  // Real-time playback position & memory tracking refs
  const projectIdRef = useRef<string>(project.id);
  const currentTimeRef = useRef<number>(currentTime);
  const durationRef = useRef<number>(duration);
  const activeCueIndexRef = useRef<number>(activeCueIndex);
  const syncOffsetSecRef = useRef<number>(syncOffsetSec);
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  const lastSavedTimeRef = useRef<number>(0);

  useEffect(() => {
    projectIdRef.current = project.id;
    if (project.swiftSettings?.syncOffsetSec !== undefined) {
      setSyncOffsetSec(project.swiftSettings.syncOffsetSec);
    }
  }, [project.id]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    activeCueIndexRef.current = activeCueIndex;
  }, [activeCueIndex]);

  useEffect(() => {
    syncOffsetSecRef.current = syncOffsetSec;
  }, [syncOffsetSec]);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    cuesRef.current = project.cues;
  }, [project.cues]);

  // Preloads the next chunk into standby audio element for 0ms gapless transition
  const preloadNextChunk = (nextIdx: number) => {
    const chunks = chunksRef.current;
    if (nextIdx < chunks.length && chunks[nextIdx]?.audioUrl && preloadAudioRef.current) {
      preloadAudioRef.current.src = chunks[nextIdx].audioUrl!;
      preloadAudioRef.current.load();
    }
  };

  // Initialize and Bind Audio Elements
  useEffect(() => {
    const audio = new Audio();
    const preloadAudio = new Audio();
    audioRef.current = audio;
    preloadAudioRef.current = preloadAudio;

    audio.onloadedmetadata = () => {
      if (!isChunkStreamingRef.current) {
        setDuration(audio.duration || 0);
      }
      // Restore saved progress seek
      if (!isChunkStreamingRef.current && project.playbackMemory.currentTime > 0 && audio.currentTime === 0) {
        audio.currentTime = project.playbackMemory.currentTime;
      }
    };

    audio.onpause = () => {
      setIsPlaying(false);
      const pId = projectIdRef.current;
      if (!pId) return;
      const cur = currentTimeRef.current;
      const dur = durationRef.current;
      const cueIdx = activeCueIndexRef.current;
      persistPlaybackMemory(pId, {
        currentTime: cur,
        duration: dur,
        activeCueIndex: cueIdx,
        percentCompleted: dur > 0 ? (cur / dur) * 100 : 0,
      });
      lastSavedTimeRef.current = cur;
      Logger.info(`Playback paused: progress saved at ${cur.toFixed(1)}s (line #${cueIdx + 1}).`);
    };

    audio.ontimeupdate = () => {
      let cur = audio.currentTime;
      if (isChunkStreamingRef.current) {
        const currentChunk = chunksRef.current[currentChunkIndexRef.current];
        if (currentChunk) {
          cur = currentChunk.offsetSeconds + audio.currentTime;
        }
      }
      setCurrentTime(cur);

      // Preload next chunk 3 seconds before current chunk finishes
      if (isChunkStreamingRef.current && audio.duration && (audio.duration - audio.currentTime < 3)) {
        preloadNextChunk(currentChunkIndexRef.current + 1);
      }

      // Fast O(log N) active subtitle cue lookup using binary search (with speed-adapted sync offset lead/lag)
      const currentCues = cuesRef.current;
      let activeIdx = activeCueIndexRef.current;
      if (currentCues && currentCues.length > 0) {
        const speed = playbackSpeedRef.current || 1.0;
        const effectiveOffset = syncOffsetSecRef.current * speed;
        const effectiveCur = Math.max(0, cur + effectiveOffset);
        const idx = findActiveCueIndex(currentCues, effectiveCur);
        if (idx !== -1) {
          activeIdx = idx;
          setActiveCueIndex(idx);
        }
      }

      // Real-time periodic save while listening: after a few seconds (every ~3s)
      if (Math.abs(cur - lastSavedTimeRef.current) >= 3 && projectIdRef.current) {
        lastSavedTimeRef.current = cur;
        persistPlaybackMemory(projectIdRef.current, {
          currentTime: cur,
          duration: durationRef.current,
          activeCueIndex: activeIdx,
          percentCompleted: durationRef.current > 0 ? (cur / durationRef.current) * 100 : 0,
        });
      }
    };

    audio.onended = () => {
      if (isChunkStreamingRef.current) {
        const nextIdx = currentChunkIndexRef.current + 1;
        const chunks = chunksRef.current;
        if (nextIdx < chunks.length) {
          const nextChunk = chunks[nextIdx];
          if (nextChunk && nextChunk.status === 'ready' && nextChunk.audioUrl) {
            currentChunkIndexRef.current = nextIdx;
            audio.src = nextChunk.audioUrl;
            audio.playbackRate = playbackSpeed;
            audio.volume = volume / 100;
            audio.currentTime = 0;
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            preloadNextChunk(nextIdx + 1);
            return;
          } else {
            // Next chunk still generating, flag buffering state
            isBufferingNextChunkRef.current = true;
            Logger.info(`Buffering next section (Chunk ${nextIdx + 1})...`);
            return;
          }
        } else {
          // Reached end of final chunk in chunk-streaming mode!
          setIsPlaying(false);
          if (DesktopBridge.isDesktop() && projectIdRef.current) {
            setIsCleanupModalOpen(true);
          }
          return;
        }
      }
      setIsPlaying(false);
      if (DesktopBridge.isDesktop() && projectIdRef.current) {
        setIsCleanupModalOpen(true);
      }
    };

    const handleBeforeUnload = () => {
      const pId = projectIdRef.current;
      if (pId) {
        const cur = currentTimeRef.current;
        const dur = durationRef.current;
        const cueIdx = activeCueIndexRef.current;
        persistPlaybackMemory(pId, {
          currentTime: cur,
          duration: dur,
          activeCueIndex: cueIdx,
          percentCompleted: dur > 0 ? (cur / dur) * 100 : 0,
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      audio.pause();
      audio.src = '';
      preloadAudio.pause();
      preloadAudio.src = '';
    };
  }, []);

  // Auto-scan Chunks and Instantly Activate Selected Project with Restored Memory
  const activateProject = async (selected: ProjectData, autoPlay: boolean = false) => {
    setProject(selected);
    setPlaybackSpeed(1.0);
    const projVol = selected.voiceSettings?.volume ?? 85;
    setVolume(projVol);

    const savedTime = selected.playbackMemory?.currentTime || 0;
    const savedDuration = selected.playbackMemory?.duration || 0;
    const savedCueIndex = selected.playbackMemory?.activeCueIndex || 0;

    setCurrentTime(savedTime);
    setDuration(savedDuration);
    setActiveCueIndex(savedCueIndex);
    lastSavedTimeRef.current = savedTime;

    // Refresh multi-voice statuses
    if (selected.id) {
      refreshVoiceStatuses(selected.id);
    }

    // 1. If combined audio exists, bind directly to combined URL
    if (selected.audioUrl) {
      isChunkStreamingRef.current = false;
      if (audioRef.current) {
        audioRef.current.src = selected.audioUrl;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.volume = projVol / 100;
        if (savedTime > 0) {
          audioRef.current.currentTime = savedTime;
        }
        if (autoPlay) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      }
      const mins = Math.floor(savedTime / 60);
      const secs = Math.floor(savedTime % 60);
      setResumeNotification(`Opened "${selected.title}" (${mins}:${String(secs).padStart(2, '0')}). Ready to play.`);
      setTimeout(() => setResumeNotification(null), 4000);
      return;
    }

    // 2. If no combined audio, check and auto-scan disk chunks for instant playback
    if (selected.textContent && selected.textContent.trim()) {
      try {
        const vModel = getVoiceById(selected.voiceSettings?.voiceId || 'en-US-JennyNeural');
        const coordinator = new ChunkCoordinator(
          selected.id,
          selected.textContent,
          selected.voiceSettings?.voiceId || 'en-US-JennyNeural',
          selected.voiceSettings?.rate || 0,
          selected.voiceSettings?.pitch || 0,
          projVol,
          selected.shadowSettings || { enabled: true, chunkSizeWords: 500, concurrencyMode: 'auto' },
          () => {},
          undefined,
          undefined,
          vModel
        );

        const hydrated = await coordinator.hydrateCachedChunks();
        if (hydrated.readyCount > 0) {
          isChunkStreamingRef.current = true;
          chunksRef.current = hydrated.chunks;
          cuesRef.current = hydrated.cues;

          // Estimate total duration
          const lastCue = hydrated.cues[hydrated.cues.length - 1];
          const totalDur = lastCue ? lastCue.end : savedDuration;
          setDuration(totalDur);

          setChunkProgress({
            completedChunks: hydrated.readyCount,
            totalChunks: hydrated.totalCount,
            activeChunkId: 0,
          });

          // Find which chunk covers the saved currentTime
          let targetIdx = 0;
          for (let i = 0; i < hydrated.chunks.length; i++) {
            const ch = hydrated.chunks[i];
            const chEnd = ch.offsetSeconds + (ch.duration || 10);
            if (savedTime >= ch.offsetSeconds && savedTime < chEnd) {
              targetIdx = i;
              break;
            }
          }

          currentChunkIndexRef.current = targetIdx;
          const activeChunk = hydrated.chunks[targetIdx];
          if (activeChunk && activeChunk.audioUrl && audioRef.current) {
            audioRef.current.src = activeChunk.audioUrl;
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.volume = projVol / 100;
            audioRef.current.currentTime = Math.max(0, savedTime - activeChunk.offsetSeconds);
            preloadNextChunk(targetIdx + 1);

            if (autoPlay) {
              audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            }
          }

          setProject((prev) => ({
            ...prev,
            cues: hydrated.cues,
            playbackMemory: {
              ...prev.playbackMemory,
              duration: totalDur,
            },
          }));

          const mins = Math.floor(savedTime / 60);
          const secs = Math.floor(savedTime % 60);
          const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
          setResumeNotification(
            `Loaded "${selected.title}" (${hydrated.readyCount}/${hydrated.totalCount} chunks on disk). Memory restored at ${timeStr}.`
          );
          setTimeout(() => setResumeNotification(null), 5000);
          Logger.info(`Auto-scanned ${hydrated.readyCount}/${hydrated.totalCount} chunks from disk for "${selected.title}". Ready for instant playback.`);
        }
      } catch (err) {
        Logger.warn('Auto-scan chunks error:', err);
      }
    }
  };

  // Load Last Active Project from Memory on Startup (Wait for desktop bridge so disk projects load reliably)
  useEffect(() => {
    async function initMemory() {
      try {
        await DesktopBridge.ensureReady(3000);
        const all = await getAllProjects();
        setProjectsList(all);

        const lastProject = await getLastActiveProject();
        if (lastProject) {
          await activateProject(lastProject, false);
        } else if (all.length > 0) {
          await activateProject(all[0], false);
        }
      } catch (err) {
        console.warn('Could not restore last project session', err);
      }
    }
    initMemory();
  }, []);

  // Update audio source when project.audioUrl changes (only in non-streaming or idle mode)
  useEffect(() => {
    if (audioRef.current && project.audioUrl) {
      if (isChunkStreamingRef.current) {
        return; // Don't interrupt dynamic chunk queue
      }
      const wasPlaying = isPlaying;
      audioRef.current.src = project.audioUrl;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.volume = volume / 100;

      if (project.playbackMemory.currentTime > 0) {
        audioRef.current.currentTime = project.playbackMemory.currentTime;
      }

      if (wasPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [project.audioUrl]);

  // Sync Audio Controls
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // 1. Lightweight Playback Progress Memory (<0.01ms in localStorage, 0 disk I/O, 0 IPC bridge lag)
  useEffect(() => {
    if (!project.id) return;
    savePlaybackProgress(project.id, {
      currentTime,
      duration,
      activeCueIndex,
      percentCompleted: duration > 0 ? (currentTime / duration) * 100 : 0,
    });
  }, [project.id, currentTime, duration, activeCueIndex]);

  // 2. Auto-Save Project metadata & text debounce
  // Triggered ONLY when text content, title, or settings change (NEVER during normal playback!)
  useEffect(() => {
    if (!project.id || !project.textContent) return;
    const timer = setTimeout(() => {
      const prog = loadPlaybackProgress(project.id);
      const updated: ProjectData = {
        ...project,
        playbackMemory: prog || project.playbackMemory,
      };
      saveProject(updated, false).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [project.id, project.title, project.textContent, project.fileRefs, project.voiceSettings, project.shadowSettings]);

  // Keyboard Shortcuts (Space: Play/Pause, Arrows: Skip, Esc: Stop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return; // Don't trigger when typing in editor or inputs
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        skip(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skip(10);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        stopAudio();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration]);

  // Audio Playback Functions
  const togglePlay = () => {
    if (!audioRef.current) return;
    const hasAudio = project.audioUrl || (chunksRef.current.length > 0 && chunksRef.current[0]?.audioUrl);
    if (!hasAudio) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback error', err);
          setIsPlaying(false);
        });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      setActiveCueIndex(0);
      currentChunkIndexRef.current = 0;
      isBufferingNextChunkRef.current = false;
    }
  };

  const skip = (deltaSeconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    seekTo(target);
  };

  const triggerSeekSave = (seconds: number, forcedCueIdx?: number) => {
    const pId = projectIdRef.current;
    if (!pId) return;
    const dur = durationRef.current;
    const cueIdx = forcedCueIdx !== undefined ? forcedCueIdx : findActiveCueIndex(cuesRef.current, seconds);
    const targetIdx = cueIdx !== -1 ? cueIdx : activeCueIndexRef.current;
    const memory: PlaybackMemory = {
      currentTime: seconds,
      duration: dur,
      activeCueIndex: targetIdx,
      percentCompleted: dur > 0 ? (seconds / dur) * 100 : 0,
    };
    persistPlaybackMemory(pId, memory);
    lastSavedTimeRef.current = seconds;
  };

  const seekTo = (seconds: number) => {
    if (!audioRef.current) return;

    if (isChunkStreamingRef.current) {
      const chunks = chunksRef.current;
      const targetIdx = chunks.findIndex((c) =>
        seconds >= c.offsetSeconds && seconds < (c.offsetSeconds + (c.duration || 10))
      );

      if (targetIdx !== -1) {
        const targetChunk = chunks[targetIdx];
        if (targetChunk.status === 'ready' && targetChunk.audioUrl) {
          currentChunkIndexRef.current = targetIdx;
          audioRef.current.src = targetChunk.audioUrl;
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.volume = volume / 100;
          audioRef.current.currentTime = Math.max(0, seconds - targetChunk.offsetSeconds);
          setCurrentTime(seconds);
          if (isPlaying) {
            audioRef.current.play().catch(() => {});
          }
          preloadNextChunk(targetIdx + 1);
          triggerSeekSave(seconds);
          return;
        }
      }
    }

    // Default seek when using combined audio file
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    triggerSeekSave(seconds);
  };

  const seekToCue = async (cue: TimedCue) => {
    const idx = cuesRef.current.findIndex((c) => c.id === cue.id);
    if (idx !== -1) {
      setActiveCueIndex(idx);
    }

    // Fast path: cue is already synthesized and ready
    if (cue.isReady !== false && (!isGenerating || cue.isReady === true)) {
      seekTo(cue.start);
      if (!isPlaying) {
        togglePlay();
      }
      triggerSeekSave(cue.start, idx !== -1 ? idx : undefined);
      Logger.info(`Jumped to subtitle line #${(idx !== -1 ? idx : activeCueIndexRef.current) + 1}: progress saved at ${cue.start.toFixed(1)}s.`);
      return;
    }

    // Unloaded cue path: user clicked an unloaded subtitle line
    const now = Date.now();
    rapidJumpHistoryRef.current = rapidJumpHistoryRef.current.filter((t) => now - t < 3500);
    rapidJumpHistoryRef.current.push(now);
    const isRapid = rapidJumpHistoryRef.current.length >= 3;

    let targetChunkId = cue.chunkId;
    if (targetChunkId === undefined || targetChunkId < 0) {
      const chunks = chunksRef.current;
      for (let i = 0; i < chunks.length; i++) {
        if (cue.start >= chunks[i].offsetSeconds) {
          targetChunkId = i;
        }
      }
    }
    targetChunkId = targetChunkId ?? 0;

    const lineNum = (idx !== -1 ? idx : 0) + 1;
    if (isRapid) {
      setResumeNotification(`⚠️ Jumping rapidly across unloaded sections! Prioritizing Chunk #${targetChunkId + 1} first...`);
    } else {
      setResumeNotification(`⚡ Generating Chunk #${targetChunkId + 1} for subtitle line #${lineNum}...`);
    }
    setTimeout(() => setResumeNotification(null), 4500);

    // If coordinator is running, prioritize chunk dynamically
    if (coordinatorRef.current) {
      coordinatorRef.current.prioritizeChunk(targetChunkId);
      const readyChunk = await coordinatorRef.current.ensureChunkReady(targetChunkId);
      if (readyChunk && readyChunk.audioUrl && audioRef.current) {
        isChunkStreamingRef.current = true;
        currentChunkIndexRef.current = targetChunkId;
        audioRef.current.src = readyChunk.audioUrl;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.volume = volume / 100;
        const intraOffset = Math.max(0, cue.start - readyChunk.offsetSeconds);
        audioRef.current.currentTime = intraOffset;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        setCurrentTime(cue.start);
        if (idx !== -1) setActiveCueIndex(idx);
        triggerSeekSave(cue.start, idx !== -1 ? idx : undefined);
        preloadNextChunk(targetChunkId + 1);
      }
    } else {
      startAudioPipeline(targetChunkId, cue.start, idx !== -1 ? idx : undefined);
    }
  };

  // Fast Travel / Direct Jump to specific Chunk ID
  const handleJumpToChunk = async (chunkNumber: number) => {
    let chunks = chunksRef.current;
    // Hydrate cached disk chunks if not yet loaded in state
    if ((!chunks || chunks.length === 0) && project.textContent) {
      const vModel = getVoiceById(project.voiceSettings.voiceId);
      const coordinator = new ChunkCoordinator(
        project.id,
        project.textContent,
        project.voiceSettings.voiceId,
        project.voiceSettings.rate,
        project.voiceSettings.pitch,
        project.voiceSettings.volume,
        project.shadowSettings || { enabled: true, chunkSizeWords: 500, concurrencyMode: 'auto' },
        () => {},
        undefined,
        undefined,
        vModel
      );
      const hydrated = await coordinator.hydrateCachedChunks();
      if (hydrated.chunks.length > 0) {
        chunks = hydrated.chunks;
        chunksRef.current = hydrated.chunks;
        cuesRef.current = hydrated.cues;
        setProject((p) => ({ ...p, cues: hydrated.cues }));
      }
    }

    if (!chunks || chunks.length === 0) return;

    const targetIdx = Math.max(0, Math.min(chunks.length - 1, chunkNumber - 1));
    const targetChunk = chunks[targetIdx];
    if (!targetChunk) return;

    // Fetch URL from desktop bridge if not yet bound
    if (!targetChunk.audioUrl && DesktopBridge.isDesktop() && project.id) {
      const vModel = getVoiceById(project.voiceSettings.voiceId);
      const audioUrl = await DesktopBridge.getChunkAudioUrl(project.id, targetIdx, vModel);
      if (audioUrl) {
        targetChunk.audioUrl = audioUrl;
        targetChunk.status = 'ready';
      }
    }

    if (targetChunk.audioUrl && audioRef.current) {
      isChunkStreamingRef.current = true;
      currentChunkIndexRef.current = targetIdx;
      audioRef.current.src = targetChunk.audioUrl;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.volume = volume / 100;
      audioRef.current.currentTime = 0;
      setCurrentTime(targetChunk.offsetSeconds);

      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
      preloadNextChunk(targetIdx + 1);
    } else if (project.audioUrl && audioRef.current) {
      audioRef.current.currentTime = targetChunk.offsetSeconds;
      setCurrentTime(targetChunk.offsetSeconds);
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    } else {
      setCurrentTime(targetChunk.offsetSeconds);
    }

    // Find the first subtitle cue belonging to this target chunk
    const currentCues = cuesRef.current;
    let cueIdx = currentCues.findIndex((c) => c.chunkId === targetIdx);
    if (cueIdx === -1) {
      cueIdx = currentCues.findIndex((c) => c.start >= targetChunk.offsetSeconds);
    }
    if (cueIdx !== -1) {
      setActiveCueIndex(cueIdx);
    }

    triggerSeekSave(targetChunk.offsetSeconds, cueIdx !== -1 ? cueIdx : undefined);

    const targetCueNum = cueIdx !== -1 ? cueIdx + 1 : 1;
    setResumeNotification(`⚡ Fast travelled to Chunk ${targetIdx + 1}/${chunks.length} (Subtitle line #${targetCueNum}).`);
    setTimeout(() => setResumeNotification(null), 4000);
    Logger.info(`Fast travelled to Chunk #${targetIdx + 1} at ${targetChunk.offsetSeconds.toFixed(1)}s (line #${targetCueNum}).`);
  };

  // Start or resume audio pipeline starting at a specific chunk ID and seek offset
  const startAudioPipeline = async (
    startChunkId: number = 0,
    initialSeekTime: number = 0,
    targetCueIndex?: number,
    voiceOverride?: VoiceModel
  ) => {
    if (!project.textContent || project.textContent.trim() === '') {
      alert('Please add or extract text first.');
      return;
    }

    const voiceToUse = voiceOverride || selectedVoice;
    setIsGenerating(true);
    const clampedStart = Math.max(0, startChunkId);
    Logger.info(`Initiating audio streaming pipeline starting at Chunk #${clampedStart + 1} for: "${project.title}" (voice: ${voiceToUse?.name || project.voiceSettings.voiceId})`);

    const coordinator = new ChunkCoordinator(
      project.id,
      project.textContent,
      voiceToUse?.id || project.voiceSettings.voiceId,
      project.voiceSettings.rate,
      project.voiceSettings.pitch,
      project.voiceSettings.volume,
      project.shadowSettings,
      (update) => {
        setChunkProgress({
          completedChunks: update.completedChunks,
          totalChunks: update.totalChunks,
          activeChunkId: update.activeChunkId,
        });
      },
      (targetChunk) => {
        Logger.info(`Playback ready: Chunk #${targetChunk.id + 1} (${targetChunk.wordCount} words).`);
        isChunkStreamingRef.current = true;
        currentChunkIndexRef.current = targetChunk.id;
        chunksRef.current = coordinator.getChunks();

        // Estimated duration for entire document
        const stats = calculateTextStats(project.textContent);
        const estDuration = stats.totalSeconds || targetChunk.duration;
        setDuration(estDuration);

        // Pre-populate cues for the whole text so user has full subtitle timeline immediately
        const initialCues = coordinator.getAllCues();
        cuesRef.current = initialCues;

        setProject((prev) => ({
          ...prev,
          audioBlob: targetChunk.audioBlob,
          audioUrl: targetChunk.audioUrl,
          cues: initialCues,
          playbackMemory: {
            ...prev.playbackMemory,
            duration: estDuration,
          },
        }));

        const intraOffset = Math.max(0, initialSeekTime - targetChunk.offsetSeconds);
        if (audioRef.current && targetChunk.audioUrl) {
          audioRef.current.src = targetChunk.audioUrl;
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.volume = volume / 100;
          audioRef.current.currentTime = intraOffset;
          audioRef.current
            .play()
            .then(() => {
              setIsPlaying(true);
              Logger.info(`Streaming audio playback started instantly from Chunk #${targetChunk.id + 1} at offset ${intraOffset.toFixed(1)}s!`);
            })
            .catch(() => {
              setIsPlaying(false);
            });
        }
        setCurrentTime(initialSeekTime);
        const activeIdx = targetCueIndex !== undefined ? targetCueIndex : initialCues.findIndex((c) => c.start >= initialSeekTime);
        if (activeIdx !== -1) {
          setActiveCueIndex(activeIdx);
        }
        triggerSeekSave(initialSeekTime, activeIdx !== -1 ? activeIdx : undefined);
        preloadNextChunk(targetChunk.id + 1);
      },
      (chunk, allChunks) => {
        chunksRef.current = allChunks;
        const updatedCues = coordinator.getAllCues();
        cuesRef.current = updatedCues;

        setProject((prev) => ({
          ...prev,
          cues: updatedCues,
        }));

        // If player was buffering waiting for this chunk, immediately resume playback!
        if (isBufferingNextChunkRef.current && chunk.id === currentChunkIndexRef.current + 1) {
          isBufferingNextChunkRef.current = false;
          currentChunkIndexRef.current = chunk.id;
          if (audioRef.current && chunk.audioUrl) {
            audioRef.current.src = chunk.audioUrl;
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.volume = volume / 100;
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            preloadNextChunk(chunk.id + 1);
          }
        } else if (chunk.id === currentChunkIndexRef.current + 1) {
          preloadNextChunk(chunk.id);
        }
      },
      voiceToUse
    );

    coordinatorRef.current = coordinator;

    try {
      const result = await coordinator.start(clampedStart);

      const finalDuration = result.combinedCues.length > 0
        ? result.combinedCues[result.combinedCues.length - 1].end
        : duration;

      setDuration(finalDuration);

      const updatedProject: ProjectData = {
        ...project,
        audioBlob: result.combinedBlob,
        audioUrl: result.combinedUrl,
        cues: result.combinedCues,
        playbackMemory: {
          ...project.playbackMemory,
          duration: finalDuration,
        },
      };

      setProject(updatedProject);
      await saveProject(updatedProject, true);
      if (project.id) {
        await refreshVoiceStatuses(project.id);
      }

      // If playback is not active, seamlessly switch to combined audio URL for whole-file scrubbing
      if (!isPlaying && audioRef.current && result.combinedUrl) {
        isChunkStreamingRef.current = false;
        audioRef.current.src = result.combinedUrl;
      }

      Logger.info(`Synthesis fully completed. Audio & text saved to disk. Total sentences synced: ${result.combinedCues.length}`);
    } catch (err: any) {
      if (err.message?.includes('stopped by user')) {
        Logger.warn('Audio generation halted by user.');
      } else {
        Logger.error('Synthesis error:', err.message || err);
        alert(`Synthesis error: ${err.message || 'Check network connection'}`);
      }
    } finally {
      setIsGenerating(false);
      coordinatorRef.current = null;
      if (project.id) {
        refreshVoiceStatuses(project.id);
      }
    }
  };

  // Generate Audio via ChunkCoordinator with Fast Start & Shadow Pre-gen
  const handleGenerateAudio = async () => {
    await startAudioPipeline(currentChunkIndexRef.current || 0, currentTimeRef.current || 0);
  };

  // Force Stop Generation
  const handleStopGenerating = () => {
    if (coordinatorRef.current) {
      coordinatorRef.current.abort();
      setIsGenerating(false);
      Logger.warn('User forced Stop Generating action.');
    }
  };


  // Multi-File Handlers
  const handleAddFiles = (newFiles: FileReference[]) => {
    setProject((prev) => ({
      ...prev,
      fileRefs: [...prev.fileRefs, ...newFiles],
    }));
  };

  const handleRemoveFile = (id: string) => {
    setProject((prev) => ({
      ...prev,
      fileRefs: prev.fileRefs.filter((f) => f.id !== id),
    }));
  };

  const handleExtractAll = () => {
    setIsExtracting(true);
    setTimeout(() => {
      const texts: string[] = [];
      project.fileRefs.forEach((f) => {
        if (f.extractedText) {
          texts.push(`=== [ ${f.name} ] ===\n\n${f.extractedText}`);
        }
      });

      const combined = texts.join('\n\n');
      setProject((prev) => ({
        ...prev,
        textContent: combined || prev.textContent,
      }));
      setIsExtracting(false);
    }, 400);
  };

  // Export handlers
  const handleExportMp3 = () => {
    if (!project.audioBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(project.audioBlob);
    a.download = `${project.title.replace(/\s+/g, '_')}.mp3`;
    a.click();
  };

  const handleExportSrt = () => {
    if (project.cues.length === 0) return;
    const srt = exportToSrt(project.cues);
    const blob = new Blob([srt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.title.replace(/\s+/g, '_')}.srt`;
    a.click();
  };

  // Mini-Player, SwiftRead & Pin Handlers
  const handleToggleViewMode = async () => {
    const nextMode: ViewMode = viewMode === 'full' ? 'mini' : 'full';
    setViewMode(nextMode);
    await DesktopBridge.setMiniMode(nextMode === 'mini', isSwiftRead);
  };

  const handleToggleSwiftRead = async () => {
    const nextSwift = !isSwiftRead;
    setIsSwiftRead(nextSwift);
    try {
      localStorage.setItem('voiceflow_swift_read', String(nextSwift));
    } catch {}
    if (viewMode === 'mini') {
      await DesktopBridge.setMiniMode(true, nextSwift);
    }
  };

  const handleSyncOffsetChange = (val: number) => {
    const cleanVal = isNaN(val) ? 0 : parseFloat(val.toFixed(2));
    setSyncOffsetSec(cleanVal);
    syncOffsetSecRef.current = cleanVal;
    try {
      localStorage.setItem('voiceflow_sync_offset_sec', String(cleanVal));
    } catch {}

    // INSTANT DISPLAY UPDATE: Immediately re-evaluate active cue based on speed-adapted offset
    const speed = playbackSpeedRef.current || 1.0;
    const effectiveOffset = cleanVal * speed;
    const currentCues = cuesRef.current;
    if (currentCues && currentCues.length > 0) {
      const effectiveCur = Math.max(0, currentTimeRef.current + effectiveOffset);
      const idx = findActiveCueIndex(currentCues, effectiveCur);
      if (idx !== -1) {
        activeCueIndexRef.current = idx;
        setActiveCueIndex(idx);
      }
    }

    setProject((p) => ({
      ...p,
      swiftSettings: {
        ...p.swiftSettings,
        syncOffsetSec: cleanVal,
      },
    }));
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    playbackSpeedRef.current = speed;
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }

    // INSTANT ADAPTIVE UPDATE: Immediately re-evaluate active cue for the new speed
    const currentCues = cuesRef.current;
    if (currentCues && currentCues.length > 0) {
      const effectiveOffset = syncOffsetSecRef.current * speed;
      const effectiveCur = Math.max(0, currentTimeRef.current + effectiveOffset);
      const idx = findActiveCueIndex(currentCues, effectiveCur);
      if (idx !== -1) {
        activeCueIndexRef.current = idx;
        setActiveCueIndex(idx);
      }
    }
  };

  const handleTogglePin = async () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    await DesktopBridge.setAlwaysOnTop(nextPin);
  };

  // Voice Switching with Multi-Voice Track Awareness & Resumable Status
  const handleVoiceChange = async (newVoice: VoiceModel) => {
    const currentPos = currentTimeRef.current;

    if (isGenerating && coordinatorRef.current) {
      coordinatorRef.current.abort();
      coordinatorRef.current = null;
      setIsGenerating(false);
    }
    stopAudio();

    const subpath = getVoiceFolderSubpath(newVoice);
    Logger.info(`Switched active voice to "${newVoice.name}" (${newVoice.id}), subpath: ${subpath}`);

    const updatedProject: ProjectData = {
      ...project,
      voiceSettings: {
        ...project.voiceSettings,
        voiceId: newVoice.id,
      },
      audioUrl: undefined,
      audioBlob: undefined,
    };
    setProject(updatedProject);
    await saveProject(updatedProject, false);

    if (!project.textContent || project.textContent.trim() === '') {
      return;
    }

    // Fast-scan and hydrate cached chunks on disk for this voice
    const tempCoordinator = new ChunkCoordinator(
      project.id,
      project.textContent,
      newVoice.id,
      project.voiceSettings.rate,
      project.voiceSettings.pitch,
      project.voiceSettings.volume,
      project.shadowSettings,
      () => {},
      undefined,
      undefined,
      newVoice
    );

    const hydrated = await tempCoordinator.hydrateCachedChunks();
    chunksRef.current = hydrated.chunks;
    cuesRef.current = hydrated.cues;
    setProject((p) => ({
      ...p,
      cues: hydrated.cues,
      voiceSettings: { ...p.voiceSettings, voiceId: newVoice.id },
    }));

    // Find the chunk containing current playback timeline
    let targetChunkId = 0;
    for (let i = 0; i < hydrated.chunks.length; i++) {
      const ch = hydrated.chunks[i];
      const dur = ch.duration > 0 ? ch.duration : Math.max(3, ch.wordCount * 0.4);
      if (currentPos >= ch.offsetSeconds && (currentPos < ch.offsetSeconds + dur || i === hydrated.chunks.length - 1)) {
        targetChunkId = i;
        break;
      }
    }

    const targetChunk = hydrated.chunks[targetChunkId];
    const isTargetReady = targetChunk && targetChunk.status === 'ready' && targetChunk.audioUrl;

    const timeStr = `${Math.floor(currentPos / 60)}:${Math.floor(currentPos % 60).toString().padStart(2, '0')}`;
    setResumeNotification(
      `Voice switched to "${newVoice.name}" (${hydrated.readyCount}/${hydrated.totalCount} cached). ${
        isTargetReady ? `Resuming at ${timeStr} (Chunk #${targetChunkId + 1})...` : `Synthesizing Chunk #${targetChunkId + 1}...`
      }`
    );
    setTimeout(() => setResumeNotification(null), 4500);

    // Automatically stream and synthesize starting from targetChunkId forward then backward!
    startAudioPipeline(targetChunkId, currentPos, undefined, newVoice);
    if (project.id) {
      refreshVoiceStatuses(project.id);
    }
  };

  // Project Switching Handlers
  const handleSelectProject = async (selected: ProjectData) => {
    stopAudio();
    await activateProject(selected, false);
  };

  const handleNewProject = () => {
    const newProj = createDefaultProject();
    setProject(newProj);
    setCurrentTime(0);
    setDuration(0);
    setActiveCueIndex(0);
    stopAudio();
    setIsProjectModalOpen(false);
  };

  const handleSaveCurrentAs = async (newTitle: string) => {
    const updated: ProjectData = {
      ...project,
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      title: newTitle,
      updatedAt: Date.now(),
    };
    await saveProject(updated, true);
    setProject(updated);
    const all = await getAllProjects();
    setProjectsList(all);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    const all = await getAllProjects();
    setProjectsList(all);
    if (project.id === id) {
      handleNewProject();
    }
  };

  const stats = calculateTextStats(project.textContent);
  const activeCue =
    activeCueIndex >= 0 && activeCueIndex < project.cues.length
      ? project.cues[activeCueIndex]
      : null;
  const selectedVoice = getVoiceById(project.voiceSettings.voiceId);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative font-sans">
      {/* Auto-Resume Floating Notification Banner */}
      {resumeNotification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 bg-cyan-950 border border-cyan-400/80 px-4 py-2 rounded-xl text-xs text-cyan-200 shadow-2xl flex items-center space-x-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>{resumeNotification}</span>
        </div>
      )}

      {/* Floating Mini-Player Widget (Always-on-Top & Draggable) */}
      {viewMode === 'mini' ? (
        <FloatingMiniPlayer
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onSkipBack={() => skip(-10)}
          onSkipForward={() => skip(10)}
          currentTime={currentTime}
          duration={duration}
          onSeek={seekTo}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={handlePlaybackSpeedChange}
          volume={volume}
          onVolumeChange={setVolume}
          trackTitle={project.title}
          activeCue={activeCue}
          activeCueIndex={activeCueIndex}
          totalCues={project.cues.length}
          cues={project.cues}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
          onExpand={() => handleToggleViewMode()}
          isSwiftRead={isSwiftRead}
          onToggleSwiftRead={handleToggleSwiftRead}
          syncOffsetSec={syncOffsetSec}
          onSyncOffsetChange={handleSyncOffsetChange}
        />
      ) : (
        /* Full Application Layout (16:9 Desktop & Adaptive Mobile) */
        <>
          {/* Desktop TitleBar (hidden on small mobile) */}
          <div className="hidden sm:block">
            <TitleBar
              viewMode={viewMode}
              onToggleViewMode={handleToggleViewMode}
              isPinned={isPinned}
              onTogglePin={handleTogglePin}
              onOpenProjects={() => setIsProjectModalOpen(true)}
              onOpenProjectSettings={() => {
                setSettingsTargetProject(project);
                setIsProjectSettingsOpen(true);
              }}
              onOpenLogs={() => setIsLogModalOpen(true)}
              onOpenStorageSettings={() => setIsStorageModalOpen(true)}
              projectTitle={project.title}
              isSwiftRead={isSwiftRead}
              onToggleSwiftRead={handleToggleSwiftRead}
            />
          </div>

          {/* Mobile Header (visible on mobile only) */}
          <div className="sm:hidden">
            <MobileHeader
              onOpenFileIngest={() => setIsFileModalOpen(true)}
              onOpenProjects={() => setIsProjectModalOpen(true)}
              onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
              onOpenMobileSettings={() => setIsMobileSettingsOpen(true)}
              selectedVoice={selectedVoice}
              isPinned={isPinned}
              onTogglePin={handleTogglePin}
              onPopOutMini={handleToggleViewMode}
            />
          </div>

          {/* Main 3-Column Content Body */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            {/* Left: Source File Ingestion Panel */}
            <div className="hidden lg:block">
              <FileIngestPanel
                files={project.fileRefs}
                onAddFiles={handleAddFiles}
                onRemoveFile={handleRemoveFile}
                onExtractAll={handleExtractAll}
                isExtracting={isExtracting}
                wordCount={stats.wordCount}
                charCount={stats.charCount}
                estDuration={stats.estDuration}
              />
            </div>

            {/* Center: Text Editor & Subtitle Workspace */}
            <WorkspacePanel
              textContent={project.textContent}
              onTextChange={(val) => setProject((p) => ({ ...p, textContent: val }))}
              cues={project.cues}
              activeCueIndex={activeCueIndex}
              onSeekToCue={seekToCue}
              isPlaying={isPlaying}
              isReadonly={isGenerating}
              totalChunks={chunkProgress?.totalChunks || splitTextIntoChunks(project.textContent, project.shadowSettings?.chunkSizeWords || 500).length}
              currentChunkIndex={currentChunkIndexRef.current}
              onJumpToChunk={handleJumpToChunk}
              onOpenSettings={() => setIsMobileSettingsOpen(true)}
            />

            {/* Right: Voice Settings & Synthesis Panel */}
            <div className="hidden xl:block">
              <VoiceSettingsPanel
                selectedVoice={selectedVoice}
                onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
                voiceStatus={voiceStatuses[getVoiceFolderSubpath(selectedVoice)] || voiceStatuses[selectedVoice.id]}
                speed={project.voiceSettings.rate}
                onSpeedChange={(r) =>
                  setProject((p) => ({
                    ...p,
                    voiceSettings: { ...p.voiceSettings, rate: r },
                  }))
                }
                pitch={project.voiceSettings.pitch}
                onPitchChange={(pitch) =>
                  setProject((p) => ({
                    ...p,
                    voiceSettings: { ...p.voiceSettings, pitch },
                  }))
                }
                volume={volume}
                onVolumeChange={setVolume}
                onGenerateAudio={handleGenerateAudio}
                onStopGenerating={handleStopGenerating}
                isGenerating={isGenerating}
                shadowSettings={project.shadowSettings}
                onShadowSettingsChange={(settings) =>
                  setProject((p) => ({
                    ...p,
                    shadowSettings: settings,
                  }))
                }
                chunkProgress={chunkProgress}
                onExportMp3={handleExportMp3}
                onExportSrt={handleExportSrt}
                hasAudio={!!project.audioBlob}
              />
            </div>
          </div>

          {/* Desktop Bottom Player Bar */}
          <div className="hidden sm:block">
            <BottomPlayerBar
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onStop={stopAudio}
              onSkipBack={() => skip(-10)}
              onSkipForward={() => skip(10)}
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={handlePlaybackSpeedChange}
              volume={volume}
              onVolumeChange={setVolume}
              trackTitle={project.title}
              activeCue={activeCue}
              activeCueIndex={activeCueIndex}
              totalCues={project.cues.length}
              onPopOutMini={handleToggleViewMode}
              isSwiftRead={isSwiftRead}
              onToggleSwiftRead={handleToggleSwiftRead}
            />
          </div>

          {/* Mobile Bottom Player Sheet */}
          <div className="sm:hidden">
            <MobilePlayerSheet
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onSkipBack={() => skip(-10)}
              onSkipForward={() => skip(10)}
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={handlePlaybackSpeedChange}
              trackTitle={project.title}
              activeCue={activeCue}
              onExportMp3={handleExportMp3}
              hasAudio={!!project.audioBlob}
            />
          </div>
        </>
      )}

      {/* Voice Selection & Language Filter Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => handleVoiceChange(v)}
        voiceStatuses={voiceStatuses}
        totalChunks={chunkProgress?.totalChunks || splitTextIntoChunks(project.textContent, project.shadowSettings?.chunkSizeWords || 500).length}
      />

      {/* Projects & Reading Memory Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        currentProject={project}
        projectsList={projectsList}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onSaveCurrentAs={handleSaveCurrentAs}
        onDeleteProject={handleDeleteProject}
        onResumePlayback={() => {
          if (!isPlaying) togglePlay();
        }}
        onOpenStorageSettings={() => setIsStorageModalOpen(true)}
        onEditProjectSettings={(p) => {
          setSettingsTargetProject(p);
          setIsProjectSettingsOpen(true);
        }}
      />

      {/* Project-level Settings Modal */}
      {settingsTargetProject && (
        <ProjectSettingsModal
          isOpen={isProjectSettingsOpen}
          onClose={() => {
            setIsProjectSettingsOpen(false);
            setSettingsTargetProject(null);
          }}
          project={settingsTargetProject}
          onSaveProjectSettings={async (updated) => {
            if (updated.id === project.id) {
              setProject(updated);
              if (updated.swiftSettings?.syncOffsetSec !== undefined) {
                handleSyncOffsetChange(updated.swiftSettings.syncOffsetSec);
              }
            }
            await saveProject(updated, false);
            const all = await getAllProjects();
            setProjectsList(all);
            setIsProjectSettingsOpen(false);
            setSettingsTargetProject(null);
            Logger.info(`Updated project settings for "${updated.title}"`);
          }}
          onAudioCleaned={() => {
            if (settingsTargetProject.id === project.id) {
              setProject((prev) => ({
                ...prev,
                hasDiskAudio: false,
                diskChunkCount: 0,
                audioUrl: undefined,
                audioBlob: undefined,
              }));
              if (project.id) {
                refreshVoiceStatuses(project.id);
              }
            }
          }}
        />
      )}

      {/* Disk & Folder Storage Settings Modal */}
      <StorageSettingsModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        currentProjectId={project.id}
        onStorageChanged={async (scannedProjects) => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
          const all = await getAllProjects();
          setProjectsList(all);

          // Auto-detect and use candidate project
          const candidate = (scannedProjects && scannedProjects.length > 0)
            ? scannedProjects[0]
            : (all.length > 0 ? all[0] : null);

          if (candidate) {
            await setLastActiveProject(candidate.id);
            await activateProject(candidate, false);
            setResumeNotification(`Storage changed: Auto-loaded "${candidate.title}".`);
            setTimeout(() => setResumeNotification(null), 5000);
            Logger.info(`Storage location switched. Discovered ${all.length} project(s). Auto-loaded "${candidate.title}".`);
          } else {
            const def = createDefaultProject();
            setProject(def);
            setCurrentTime(0);
            setDuration(0);
            setActiveCueIndex(-1);
            if (audioRef.current) {
              audioRef.current.src = '';
            }
            setResumeNotification('Storage location switched: No existing projects found in this folder.');
            setTimeout(() => setResumeNotification(null), 5000);
            Logger.info('Storage location switched. No existing projects found.');
          }
        }}
      />

      {/* Real-time Diagnostic Log Viewer Modal */}
      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />

      {/* Mobile / Android File Ingest & Upload Modal (3-line button) */}
      <MobileFileIngestModal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        files={project.fileRefs}
        onAddFiles={handleAddFiles}
        onRemoveFile={handleRemoveFile}
        onExtractAll={handleExtractAll}
        isExtracting={isExtracting}
        wordCount={stats.wordCount}
        charCount={stats.charCount}
        estDuration={stats.estDuration}
      />

      {/* Mobile / Android Settings Modal (CPU Threads, Shadow Loading, Speech Tuning) */}
      <MobileSettingsModal
        isOpen={isMobileSettingsOpen}
        onClose={() => setIsMobileSettingsOpen(false)}
        selectedVoice={selectedVoice}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        voiceStatus={voiceStatuses[getVoiceFolderSubpath(selectedVoice)] || voiceStatuses[selectedVoice.id]}
        speed={project.voiceSettings.rate}
        onSpeedChange={(r) =>
          setProject((p) => ({
            ...p,
            voiceSettings: { ...p.voiceSettings, rate: r },
          }))
        }
        pitch={project.voiceSettings.pitch}
        onPitchChange={(pitch) =>
          setProject((p) => ({
            ...p,
            voiceSettings: { ...p.voiceSettings, pitch },
          }))
        }
        volume={volume}
        onVolumeChange={setVolume}
        onGenerateAudio={handleGenerateAudio}
        onStopGenerating={handleStopGenerating}
        isGenerating={isGenerating}
        shadowSettings={project.shadowSettings}
        onShadowSettingsChange={(settings) =>
          setProject((p) => ({
            ...p,
            shadowSettings: settings,
          }))
        }
        chunkProgress={chunkProgress}
        onExportMp3={handleExportMp3}
        onExportSrt={handleExportSrt}
        hasAudio={!!project.audioBlob}
        onOpenStorageSettings={() => setIsStorageModalOpen(true)}
      />

      {/* Audio Cleanup & Storage Recovery Modal */}
      <ProjectCleanupModal
        isOpen={isCleanupModalOpen}
        onClose={() => setIsCleanupModalOpen(false)}
        projectId={project.id}
        projectTitle={project.title}
        onCleaned={(freedMb) => {
          setProject((p) => ({
            ...p,
            hasDiskAudio: false,
            diskChunkCount: 0,
            audioUrl: undefined,
            audioBlob: undefined,
          }));
          if (project.id) {
            refreshVoiceStatuses(project.id);
          }
          setResumeNotification(`🧹 Cleaned up audio files, freed ${freedMb} MB disk space.`);
          setTimeout(() => setResumeNotification(null), 4000);
        }}
      />
    </div>
  );
}

