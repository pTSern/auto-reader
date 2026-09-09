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
import { ProjectData, FileReference, VoiceModel, TimedCue, ViewMode } from './types';
import { getVoiceById } from './services/voicesCatalog';
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
import { ChunkCoordinator } from './services/chunkingEngine';
import { Logger } from './services/logger';

/**
 * Fast O(log N) binary search for active karaoke cue.
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

  // Coordinator & Audio Element Refs
  const coordinatorRef = useRef<ChunkCoordinator | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cuesRef = useRef<TimedCue[]>(project.cues);

  useEffect(() => {
    cuesRef.current = project.cues;
  }, [project.cues]);

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

  // Initialize and Bind Audio Element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
      // Restore saved progress seek
      if (project.playbackMemory.currentTime > 0 && audio.currentTime === 0) {
        audio.currentTime = project.playbackMemory.currentTime;
      }
    };

    audio.ontimeupdate = () => {
      const cur = audio.currentTime;
      setCurrentTime(cur);

      // Fast O(log N) active karaoke cue lookup using binary search
      const currentCues = cuesRef.current;
      if (currentCues && currentCues.length > 0) {
        const idx = findActiveCueIndex(currentCues, cur);
        if (idx !== -1) {
          setActiveCueIndex(idx);
        }
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio source when project.audioUrl changes
  useEffect(() => {
    if (audioRef.current && project.audioUrl) {
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
    if (!audioRef.current || !project.audioUrl) return;

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
    }
  };

  const skip = (deltaSeconds: number) => {
    if (!audioRef.current) return;
    const target = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const seekTo = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  };

  const seekToCue = (cue: TimedCue) => {
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
    Logger.info(`Initiating audio generation for project: "${project.title}"`);

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
        Logger.info(`Fast-start: streaming chunk 1 (${firstChunk.wordCount} words) immediately.`);
        if (firstChunk.audioBlob && firstChunk.audioUrl) {
          setProject((prev) => ({
            ...prev,
            audioBlob: firstChunk.audioBlob,
            audioUrl: firstChunk.audioUrl,
            cues: firstChunk.cues,
            playbackMemory: {
              ...prev.playbackMemory,
              duration: firstChunk.duration,
            },
          }));
          setCurrentTime(0);
          setActiveCueIndex(0);
        }
      }
    );

    coordinatorRef.current = coordinator;

    try {
      const result = await coordinator.start();

      const updatedProject: ProjectData = {
        ...project,
        audioBlob: result.combinedBlob,
        audioUrl: result.combinedUrl,
        cues: result.combinedCues,
        playbackMemory: {
          ...project.playbackMemory,
          duration: result.combinedCues.length > 0 ? result.combinedCues[result.combinedCues.length - 1].end : 0,
        },
      };

      setProject(updatedProject);
      await saveProject(updatedProject, true);

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

  // Project Switching Handlers
  const handleSelectProject = (selected: ProjectData) => {
    setProject(selected);
    setCurrentTime(selected.playbackMemory.currentTime || 0);
    setActiveCueIndex(selected.playbackMemory.activeCueIndex || 0);
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

            {/* Center: Text Editor & Karaoke Workspace */}
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
        onSelectVoice={(v) => {
          setProject((p) => ({
            ...p,
            voiceSettings: { ...p.voiceSettings, voiceId: v.id },
          }));
        }}
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

