import React from 'react';
import { Volume2, FolderKanban, Settings, Menu } from 'lucide-react';
import { VoiceModel } from '../types';

interface MobileHeaderProps {
  onOpenFileIngest: () => void;
  onOpenProjects: () => void;
  onOpenVoiceModal: () => void;
  onOpenMobileSettings: () => void;
  selectedVoice: VoiceModel;
  isPinned: boolean;
  onTogglePin: () => void;
  onPopOutMini: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenFileIngest,
  onOpenProjects,
  onOpenVoiceModal,
  onOpenMobileSettings,
  selectedVoice,
  isPinned,
  onTogglePin,
  onPopOutMini,
}) => {
  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between select-none shrink-0">
      {/* Left: 3-line Menu/Upload Button & Logo */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenFileIngest}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 hover:text-white hover:bg-slate-800 active:scale-95 transition flex items-center justify-center shadow-sm"
          title="Source Files & Upload (PDF / TXT)"
          aria-label="Upload Files"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-1.5">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white text-sm tracking-tight">VoiceFlow</span>
        </div>
      </div>

      {/* Right: Projects, Voice, PiP, Settings */}
      <div className="flex items-center space-x-1.5">
        <button
          onClick={onOpenProjects}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition"
          title="Projects & Reading Memory"
        >
          <FolderKanban className="w-4 h-4 text-cyan-400" />
        </button>

        <button
          onClick={onOpenVoiceModal}
          className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white flex items-center space-x-1 active:scale-95 transition"
          title="Change Voice"
        >
          <span>{selectedVoice.flag}</span>
          <span className="max-w-[60px] truncate text-[11px] font-medium">{selectedVoice.name}</span>
        </button>

        <button
          onClick={onPopOutMini}
          className="px-2 py-1 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-[11px] font-semibold active:scale-95 transition"
          title="Picture-in-Picture / Floating Mini Mode"
        >
          PiP
        </button>

        <button
          onClick={onOpenMobileSettings}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95 transition"
          title="Voice & Engine Settings (CPU Threads, Shadow Loading)"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    </header>
  );
};
