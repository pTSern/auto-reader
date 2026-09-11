import React, { useState, useEffect } from 'react';
import { Trash2, HardDrive, CheckCircle2, X, AlertTriangle, Disc3, ShieldCheck } from 'lucide-react';
import { DesktopBridge } from '../services/desktopBridge';
import { Logger } from '../services/logger';

interface ProjectCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  onCleaned?: (freedMb: number) => void;
}

export const ProjectCleanupModal: React.FC<ProjectCleanupModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  onCleaned,
}) => {
  const [isCleaning, setIsCleaning] = useState(false);
  const [audioUsage, setAudioUsage] = useState<{ size_mb: number; file_count: number }>({
    size_mb: 0,
    file_count: 0,
  });
  const [cleanedSuccess, setCleanedSuccess] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && projectId && DesktopBridge.isDesktop()) {
      setCleanedSuccess(null);
      DesktopBridge.getProjectAudioSize(projectId).then((usage) => {
        setAudioUsage(usage);
      });
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleCleanAudio = async () => {
    setIsCleaning(true);
    try {
      const res = await DesktopBridge.cleanupProjectAudio(projectId);
      if (res.success) {
        setCleanedSuccess(res.freed_mb);
        Logger.info(`Cleaned audio for ${projectTitle}: freed ${res.freed_mb} MB (${res.deleted_count} files)`);
        onCleaned?.(res.freed_mb);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (e: any) {
      Logger.error('Failed to clean audio:', e);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 relative animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <Disc3 className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>🎉 Listening Complete!</span>
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[280px]">
              Finished reading: <span className="text-cyan-300 font-medium">{projectTitle}</span>
            </p>
          </div>
        </div>

        {cleanedSuccess !== null ? (
          <div className="my-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col items-center justify-center text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
            <p className="text-sm font-semibold text-emerald-200">Disk Space Freed Successfully!</p>
            <p className="text-xs text-emerald-400/80">
              Recovered <strong className="text-emerald-300 font-mono text-sm">{cleanedSuccess} MB</strong> of storage.
            </p>
          </div>
        ) : (
          <>
            {/* Content */}
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Would you like to clean up generated audio files (<code className="text-cyan-300">.mp3</code> chunks) to save disk space?
            </p>

            {/* Storage Usage Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <HardDrive className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-xs text-slate-400">Audio Cache on Disk</div>
                  <div className="text-sm font-mono font-bold text-white">
                    {audioUsage.size_mb > 0 ? `${audioUsage.size_mb} MB` : 'Calculating...'}
                  </div>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                {audioUsage.file_count} chunks
              </span>
            </div>

            {/* Safety Notice */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-900/40 flex items-start space-x-2.5 mb-6 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Your project text, timestamps, subtitles, and history will stay preserved in{' '}
                <code className="text-cyan-300">project.json</code>. You can regenerate audio anytime.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCleanAudio}
                disabled={isCleaning}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-xs flex items-center justify-center space-x-2 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isCleaning ? 'Cleaning...' : 'Clean Audio & Free Space'}</span>
              </button>

              <button
                onClick={onClose}
                disabled={isCleaning}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
              >
                Keep Audio
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
