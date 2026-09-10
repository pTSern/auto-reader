import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { FileIngestPanel } from './components/FileIngestPanel';
import { WorkspacePanel } from './components/WorkspacePanel';
import { VoiceSettingsPanel } from './components/VoiceSettingsPanel';
import { BottomPlayerBar } from './components/BottomPlayerBar';
import { FloatingMiniPlayer } from './components/FloatingMiniPlayer';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { StorageSettingsModal } from './components/StorageSettingsModal';
import { LogViewerModal } from './components/LogViewerModal';
import { MobileHeader } from './components/MobileHeader';
import { MobilePlayerSheet } from './components/MobilePlayerSheet';
import { ProjectData, FileReference, VoiceModel, TimedCue, ViewMode, TextChunk, VoiceTrackStatus } from './types';
import { getVoiceById, getVoiceFolderSubpath } from './services/voicesCatalog';
import { exportToSrt } from './services/edgeTtsClient';
import { calculateTextStats } from './services/pdfExtractor';
import {
  saveProject,
  savePlaybackProgress,
  loadPlaybackProgress,
  getLastActiveProject,
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
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState<boolean>(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
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

  // Load Last Active Project from Memory on Startup
  useEffect(() => {
    async function initMemory() {
      try {
        const lastProject = await getLastActiveProject();
        const all = await getAllProjects();
        setProjectsList(all);

        if (lastProject) {
          setProject(lastProject);
          setPlaybackSpeed(1.0);
          setVolume(lastProject.voiceSettings.volume ?? 85);

          // Restore saved listening progress
          if (lastProject.playbackMemory.currentTime > 0) {
            setCurrentTime(lastProject.playbackMemory.currentTime);
            setDuration(lastProject.playbackMemory.duration || 0);
            setActiveCueIndex(lastProject.playbackMemory.activeCueIndex || 0);

            const mins = Math.floor(lastProject.playbackMemory.currentTime / 60);
            const secs = Math.floor(lastProject.playbackMemory.currentTime % 60);
            const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
            setResumeNotification(
              `Resumed "${lastProject.title}" at ${timeStr}. Press Play to continue.`
            );
            setTimeout(() => setResumeNotification(null), 5000);
          }
        }
      } catch (err) {
        console.warn('Could not restore last project session', err);
      }
    }
    initMemory();
  }, []);

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

      // Fast O(log N) active subtitle cue lookup using binary search
      const currentCues = cuesRef.current;
      if (currentCues && currentCues.length > 0) {
        const idx = findActiveCueIndex(currentCues, cur);
        if (idx !== -1) {
          setActiveCueIndex(idx);
        }
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
        }
      }
      setIsPlaying(false);
    };

    return () => {
      audio.pause();
      audio.src = '';
      preloadAudio.pause();
      preloadAudio.src = '';
    };
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
          return;
        }
      }
    }

    // Default seek when using combined audio file
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const seekToCue = (cue: TimedCue) => {
    // Only allow selecting subtitle lines that are completed/ready
    if (cue.isReady === false || (isGenerating && cue.isReady !== true)) {
      Logger.warn(`Cannot seek to unloaded subtitle line "${cue.text.slice(0, 30)}..."`);
      return;
    }
    seekTo(cue.start);
    if (!isPlaying) {
      togglePlay();
    }
  };

  // Generate Audio via ChunkCoordinator with Fast Start & Shadow Pre-gen
  const handleGenerateAudio = async () => {
    if (!project.textContent || project.textContent.trim() === '') {
      alert('Please add or extract text first.');
      return;
    }

    setIsGenerating(true);
    Logger.info(`Initiating fast-start audio streaming pipeline for: "${project.title}"`);

    const coordinator = new ChunkCoordinator(
      project.id,
      project.textContent,
      project.voiceSettings.voiceId,
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
      (firstChunk) => {
        Logger.info(`Fast-start ready: streaming chunk 1 (${firstChunk.wordCount} words) in <400ms.`);
        isChunkStreamingRef.current = true;
        currentChunkIndexRef.current = 0;
        chunksRef.current = coordinator.getChunks();

        // Estimated duration for entire document
        const stats = calculateTextStats(project.textContent);
        const estDuration = stats.totalSeconds || firstChunk.duration;
        setDuration(estDuration);

        // Pre-populate cues for the whole text so user has full subtitle timeline immediately
        const initialCues = coordinator.getAllCues();
        cuesRef.current = initialCues;

        setProject((prev) => ({
          ...prev,
          audioBlob: firstChunk.audioBlob,
          audioUrl: firstChunk.audioUrl,
          cues: initialCues,
          playbackMemory: {
            ...prev.playbackMemory,
            duration: estDuration,
          },
        }));

        if (audioRef.current && firstChunk.audioUrl) {
          audioRef.current.src = firstChunk.audioUrl;
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.volume = volume / 100;
          audioRef.current.currentTime = 0;
          audioRef.current
            .play()
            .then(() => {
              setIsPlaying(true);
              Logger.info('Streaming audio playback started instantly!');
            })
            .catch(() => {
              // User browser autoplay policy: primed and ready to play on user click
              setIsPlaying(false);
            });
        }
        setCurrentTime(0);
        setActiveCueIndex(0);
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
      selectedVoice
    );

    coordinatorRef.current = coordinator;

    try {
      const result = await coordinator.start();

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
      await refreshVoiceStatuses(project.id);

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

  // Mini-Player & Pin Handlers
  const handleToggleViewMode = async () => {
    const nextMode: ViewMode = viewMode === 'full' ? 'mini' : 'full';
    setViewMode(nextMode);
    await DesktopBridge.setMiniMode(nextMode === 'mini');
  };

  const handleTogglePin = async () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    await DesktopBridge.setAlwaysOnTop(nextPin);
  };

  // Voice Switching with Multi-Voice Track Awareness & Resumable Status
  const handleVoiceChange = async (newVoice: VoiceModel) => {
    if (isGenerating && coordinatorRef.current) {
      coordinatorRef.current.abort();
      setIsGenerating(false);
    }
    stopAudio();

    const subpath = getVoiceFolderSubpath(newVoice);
    const voiceStatus = voiceStatuses[subpath] || voiceStatuses[newVoice.id];

    Logger.info(`Switched active voice to "${newVoice.name}" (${newVoice.id}), subpath: ${subpath}`);

    let newAudioUrl: string | undefined = undefined;
    let newAudioBlob: Blob | undefined = undefined;

    if (voiceStatus?.hasCombined && voiceStatus.combinedUrl) {
      newAudioUrl = voiceStatus.combinedUrl;
      isChunkStreamingRef.current = false;
      if (audioRef.current) {
        audioRef.current.src = voiceStatus.combinedUrl;
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.volume = volume / 100;
        audioRef.current.currentTime = 0;
      }
      setResumeNotification(`Voice switched to "${newVoice.name}". Full audio ready! Press Play.`);
      setTimeout(() => setResumeNotification(null), 4000);
    } else if (voiceStatus && voiceStatus.chunkCount > 0) {
      const totalCh = splitTextIntoChunks(project.textContent, project.shadowSettings?.chunkSizeWords || 500).length;
      setChunkProgress({
        completedChunks: voiceStatus.chunkCount,
        totalChunks: totalCh,
        activeChunkId: voiceStatus.chunkCount,
      });
      setResumeNotification(`Voice switched to "${newVoice.name}". ${voiceStatus.chunkCount}/${totalCh} chunks generated. Press Generate to resume.`);
      setTimeout(() => setResumeNotification(null), 5000);
    } else {
      setChunkProgress(null);
      setResumeNotification(`Voice switched to "${newVoice.name}". Ready to generate speech.`);
      setTimeout(() => setResumeNotification(null), 3000);
    }

    const updatedProject: ProjectData = {
      ...project,
      voiceSettings: {
        ...project.voiceSettings,
        voiceId: newVoice.id,
      },
      audioUrl: newAudioUrl,
      audioBlob: newAudioBlob,
    };

    setProject(updatedProject);
    await saveProject(updatedProject, false);
  };

  // Project Switching Handlers
  const handleSelectProject = (selected: ProjectData) => {
    setProject(selected);
    setCurrentTime(selected.playbackMemory.currentTime || 0);
    setActiveCueIndex(selected.playbackMemory.activeCueIndex || 0);
    refreshVoiceStatuses(selected.id);
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
          onPlaybackSpeedChange={setPlaybackSpeed}
          volume={volume}
          onVolumeChange={setVolume}
          trackTitle={project.title}
          activeCue={activeCue}
          activeCueIndex={activeCueIndex}
          totalCues={project.cues.length}
          isPinned={isPinned}
          onTogglePin={handleTogglePin}
          onExpand={() => handleToggleViewMode()}
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
              onOpenLogs={() => setIsLogModalOpen(true)}
              onOpenStorageSettings={() => setIsStorageModalOpen(true)}
              projectTitle={project.title}
            />
          </div>

          {/* Mobile Header (visible on mobile only) */}
          <div className="sm:hidden">
            <MobileHeader
              onOpenProjects={() => setIsProjectModalOpen(true)}
              onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
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
              onPlaybackSpeedChange={setPlaybackSpeed}
              volume={volume}
              onVolumeChange={setVolume}
              trackTitle={project.title}
              activeCue={activeCue}
              activeCueIndex={activeCueIndex}
              totalCues={project.cues.length}
              onPopOutMini={handleToggleViewMode}
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
              onPlaybackSpeedChange={setPlaybackSpeed}
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
      />

      {/* Disk & Folder Storage Settings Modal */}
      <StorageSettingsModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onStorageChanged={async () => {
          const all = await getAllProjects();
          setProjectsList(all);
        }}
      />

      {/* Real-time Diagnostic Log Viewer Modal */}
      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
}

