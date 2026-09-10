import React, { useState, useEffect } from 'react';
import { Folder, FolderOpen, ExternalLink, HardDrive, Check, RefreshCw, X, AlertCircle, Cpu, Sliders } from 'lucide-react';
import { DesktopBridge, StorageInfo } from '../services/desktopBridge';
import { getMaxHardwareThreads, getGlobalCpuThreads, setGlobalCpuThreads } from '../services/chunkingEngine';
import { Logger } from '../services/logger';

interface StorageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStorageChanged?: () => void;
}

export const StorageSettingsModal: React.FC<StorageSettingsModalProps> = ({
  isOpen,
  onClose,
  onStorageChanged,
}) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const isDesktop = DesktopBridge.isDesktop();

  const maxThreads = getMaxHardwareThreads();
  const [cpuThreads, setCpuThreads] = useState<number>(getGlobalCpuThreads());

  useEffect(() => {
    if (isOpen && isDesktop) {
      loadInfo();
    }
  }, [isOpen, isDesktop]);

  const loadInfo = async () => {
    setIsLoading(true);
    const info = await DesktopBridge.getStorageInfo();
    if (info) {
      setStorageInfo(info);
      setCustomPath(info.storage_dir);
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    const selected = await DesktopBridge.browseStorageFolder();
    if (selected) {
      setCustomPath(selected);
      await loadInfo();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onStorageChanged?.();
    }
  };

  const handleSavePath = async () => {
    if (!customPath.trim()) return;
    const updated = await DesktopBridge.setStorageDir(customPath.trim());
    if (updated) {
      setStorageInfo(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      onStorageChanged?.();
    }
  };

  const handleOpenExplorer = async () => {
    await DesktopBridge.openStorageFolder();
    Logger.info('Opened project storage directory in Windows Explorer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Storage & Global Settings</h3>
              <p className="text-[11px] text-slate-400">
                Configure disk storage location and hardware CPU threads for shadow loading
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {!isDesktop ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Web Browser Sandbox Mode</p>
                <p className="text-[11px] text-amber-300/80">
                  You are running inside a standard browser tab. Data is stored safely in browser IndexedDB.
                  Launch the native desktop app (<code className="text-white font-mono">run.bat</code>) to choose custom folders and persist raw .MP3 files directly on your Windows hard drive.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Storage Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Saved Projects on Disk</span>
                  <div className="text-lg font-bold text-white font-mono">
                    {storageInfo?.project_count ?? 0} Projects
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400">Total Audio & Data Size</span>
                  <div className="text-lg font-bold text-cyan-400 font-mono">
                    {storageInfo?.total_size_mb ?? 0} MB
                  </div>
                </div>
              </div>

              {/* Global CPU Threads Slider for Shadow Generation */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-white">Shadow Loading CPU Threads</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold">
                    {cpuThreads} / {maxThreads} Threads
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>1 Thread (Min)</span>
                    <span className="text-slate-500 font-mono">Device Cores: {maxThreads}</span>
                    <span>{maxThreads} Threads (Max Speed)</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={maxThreads}
                    step={1}
                    value={cpuThreads}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCpuThreads(val);
                      setGlobalCpuThreads(val);
                    }}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Controls how many background audio workers run concurrently during shadow pre-generation. Default is 3. Adjust between 1 and {maxThreads} based on your device.
                </p>
              </div>

              {/* Folder Path Input & Picker */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                  <span>Current Storage Folder Location:</span>
                  {savedSuccess && (
                    <span className="text-emerald-400 font-medium flex items-center space-x-1 animate-pulse">
                      <Check className="w-3.5 h-3.5" />
                      <span>Folder location updated!</span>
                    </span>
                  )}
                </label>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Folder className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      placeholder="C:\path\to\projects_data"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500/60 text-slate-100 font-mono text-xs outline-none"
                    />
                  </div>

                  <button
                    onClick={handleBrowseFolder}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition shadow-md whitespace-nowrap"
                    title="Browse and select folder in Windows dialog"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              {/* Open in File Explorer Action */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white mb-0.5">Inspect Generated Files</h4>
                  <p className="text-[11px] text-slate-400">
                    Open your storage folder directly in Windows File Explorer to play and verify .mp3 files
                  </p>
                </div>

                <button
                  onClick={handleOpenExplorer}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open Explorer</span>
                </button>
              </div>

              {/* Disk Architecture Explainer */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] space-y-1.5 text-slate-400 font-mono">
                <div className="text-slate-300 font-bold mb-1">📁 How Disk Files are Structured:</div>
                <p>• <strong className="text-cyan-400">project.json</strong> — Text content, voice, settings & sync cues</p>
                <p>• <strong className="text-cyan-400">combined.mp3</strong> — Full merged audio file (instant playback)</p>
                <p>• <strong className="text-cyan-400">chunks/chunk_X.mp3</strong> — Individual 500w chunk audio files</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 select-none">
          {isDesktop && (
            <button
              onClick={handleSavePath}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition border border-slate-700 font-medium"
            >
              <span>Apply Path Change</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
