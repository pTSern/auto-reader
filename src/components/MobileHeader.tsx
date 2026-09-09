import React from 'react';
import { Volume2, FolderKanban, Pin, Settings, Globe } from 'lucide-react';
import { VoiceModel } from '../types';

interface MobileHeaderProps {
  onOpenProjects: () => void;
  onOpenVoiceModal: () => void;
  selectedVoice: VoiceModel;
  isPinned: boolean;
  onTogglePin: () => void;
  onPopOutMini: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenProjects,
  onOpenVoiceModal,
  selectedVoice,
  isPinned,
  onTogglePin,
  onPopOutMini,
}) => {
  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 px-3 flex items-center justify-between select-none">
      <div className="flex items-center space-x-2">
        <Volume2 className="w-5 h-5 text-cyan-400" />
        <span className="font-bold text-white text-sm">VoiceFlow</span>
      </div>

      <div className="flex items-center space-x-1.5">
        <button
          onClick={onOpenProjects}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          title="Projects"
        >
          <FolderKanban className="w-4 h-4 text-cyan-400" />
        </button>

        <button
          onClick={onOpenVoiceModal}
          className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white flex items-center space-x-1"
          title="Change Voice"
        >
          <span>{selectedVoice.flag}</span>
          <span className="max-w-[70px] truncate text-[11px] font-medium">{selectedVoice.name}</span>
        </button>

        <button
          onClick={onPopOutMini}
          className="px-2 py-1 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-[11px] font-semibold"
          title="Picture-in-Picture / Floating Mini Mode"
        >
          PiP
        </button>
      </div>
    </header>
  );
};
