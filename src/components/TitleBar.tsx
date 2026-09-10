import React from 'react';
import { Pin, Minimize2, FolderKanban, Volume2, Terminal, Minus, Square, X, HardDrive, Settings, Zap } from 'lucide-react';
import { ViewMode } from '../types';
import { DesktopBridge } from '../services/desktopBridge';

interface TitleBarProps {
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onOpenProjects: () => void;
  onOpenProjectSettings?: () => void;
  onOpenLogs: () => void;
  onOpenStorageSettings: () => void;
  projectTitle: string;
  isSwiftRead?: boolean;
  onToggleSwiftRead?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  viewMode,
  onToggleViewMode,
  isPinned,
  onTogglePin,
  onOpenProjects,
  onOpenProjectSettings,
  onOpenLogs,
  onOpenStorageSettings,
  projectTitle,
  isSwiftRead = false,
  onToggleSwiftRead,
}) => {
  const isDesktop = DesktopBridge.isDesktop();

  return (
    <header
      className="h-12 bg-slate-950 border-b border-slate-800/80 px-4 flex items-center justify-between select-none z-20 pywebview-drag-region"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: App title & Project Switcher */}
      <div className="flex items-center space-x-3 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center space-x-2 text-cyan-400 font-semibold tracking-wide">
          <Volume2 className="w-5 h-5 text-cyan-400" />
          <span className="text-white text-sm font-bold">VoiceFlow Studio</span>
        </div>

        <span className="text-slate-600 text-xs">•</span>

        <button
          onClick={onOpenProjects}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700/70 hover:border-cyan-500/50 text-slate-300 hover:text-white transition text-xs font-medium"
          title="Open Projects & Reading Memory"
        >
          <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
          <span className="max-w-[180px] truncate">{projectTitle || 'Projects'}</span>
        </button>

        {onOpenProjectSettings && (
          <button
            onClick={onOpenProjectSettings}
            className="p-1 rounded-md bg-slate-900 border border-slate-700/70 hover:border-cyan-500/50 text-slate-400 hover:text-white transition"
            title="Project Settings (Title, Speech Tuning, Chunking)"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400/80 hover:text-cyan-300" />
          </button>
        )}
      </div>

      {/* Center: Engine Status */}
      <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-subtle" />
        <span>Edge-TTS Online</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Subtitle Sync Ready</span>
      </div>

      {/* Right: Window Controls, Pin, Mini-Player, Logs, Storage */}
      <div className="flex items-center space-x-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* Disk Storage Folder Toggle */}
        <button
          onClick={onOpenStorageSettings}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-400 hover:text-slate-200 transition text-xs font-medium"
          title="Project & Audio Disk Storage Location"
        >
          <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Storage</span>
        </button>

        {/* Logs Viewer Toggle */}
        <button
          onClick={onOpenLogs}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-400 hover:text-slate-200 transition text-xs font-medium"
          title="Open Application Logs & Error Diagnostic Console"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Logs</span>
        </button>

        {/* Pin Always on Top Toggle */}
        <button
          onClick={onTogglePin}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition border ${
            isPinned
              ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
          title={isPinned ? 'Window is pinned Always On Top' : 'Pin window Always On Top'}
        >
          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'rotate-45 fill-cyan-400 text-cyan-400' : ''}`} />
          <span className="hidden sm:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
        </button>

        {/* SwiftRead Mode Toggle */}
        {onToggleSwiftRead && (
          <button
            onClick={onToggleSwiftRead}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition border ${
              isSwiftRead
                ? 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
            title={isSwiftRead ? 'Swift Reading mode is ON' : 'Turn on Swift Reading mode (RSVP)'}
          >
            <Zap className={`w-3.5 h-3.5 ${isSwiftRead ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Swift</span>
          </button>
        )}

        {/* Mini-Player Toggle */}
        <button
          onClick={onToggleViewMode}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition text-xs font-medium"
          title="Minimize to Floating Subtitle Player Bar"
        >
          <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Mini Player</span>
        </button>

        {/* Frameless Desktop Window Controls (Min, Max, Close) */}
        {isDesktop && (
          <div className="flex items-center pl-2 ml-1 border-l border-slate-800 space-x-1">
            <button
              onClick={() => DesktopBridge.minimize()}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Minimize Window"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => DesktopBridge.toggleMaximize()}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              title="Maximize / Restore"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => DesktopBridge.close()}
              className="p-1.5 rounded hover:bg-rose-900/80 text-slate-400 hover:text-rose-200 transition"
              title="Close Application"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

