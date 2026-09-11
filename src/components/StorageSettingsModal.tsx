import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  ExternalLink,
  HardDrive,
  Check,
  RefreshCw,
  X,
  AlertCircle,
  Cpu,
  Sliders,
  Music,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { DesktopBridge, StorageInfo } from '../services/desktopBridge';
import { getMaxHardwareThreads, getGlobalCpuThreads, setGlobalCpuThreads } from '../services/chunkingEngine';
import { Logger } from '../services/logger';
import { ProjectData } from '../types';

interface StorageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStorageChanged?: (scannedProjects?: ProjectData[]) => void;
  currentProjectId?: string;
}

export const StorageSettingsModal: React.FC<StorageSettingsModalProps> = ({
  isOpen,
  onClose,
  onStorageChanged,
  currentProjectId,
}) => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [autoLoadedTitle, setAutoLoadedTitle] = useState<string | null>(null);
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
    try {
      const info = await DesktopBridge.getStorageInfo();
      if (info) {
        setStorageInfo(info);
        setCustomPath(info.storage_dir);
      }
    } catch (e) {
      Logger.warn('Failed to load storage info:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    setIsScanning(true);
    try {
      const selected = await DesktopBridge.browseStorageFolder();
      if (selected) {
        setCustomPath(selected);
        const info = await DesktopBridge.getStorageInfo();
        if (info) {
          setStorageInfo(info);
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 3000);
          const scanned = (info.projects || []) as ProjectData[];
          if (scanned.length > 0) {
            setAutoLoadedTitle(scanned[0].title);
          } else {
            setAutoLoadedTitle(null);
          }
          onStorageChanged?.(scanned);
        }
      }
    } catch (err) {
      Logger.warn('Browse storage folder failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSavePath = async () => {
    if (!customPath.trim()) return;
    setIsScanning(true);
    try {
      const updated = await DesktopBridge.setStorageDir(customPath.trim());
      if (updated) {
        setStorageInfo(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        const scanned = (updated.projects || []) as ProjectData[];
        if (scanned.length > 0) {
          setAutoLoadedTitle(scanned[0].title);
        } else {
          setAutoLoadedTitle(null);
        }
        onStorageChanged?.(scanned);
      }
    } catch (err) {
      Logger.warn('Set storage dir failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const info = await DesktopBridge.getStorageInfo();
      if (info) {
        setStorageInfo(info);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        const scanned = (info.projects || []) as ProjectData[];
        if (scanned.length > 0) {
          setAutoLoadedTitle(scanned[0].title);
        }
        onStorageChanged?.(scanned);
      }
    } catch (err) {
      Logger.warn('Rescan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenExplorer = async () => {
    await DesktopBridge.openStorageFolder();
    Logger.info('Opened project storage directory in Windows Explorer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Storage & Global Settings</h3>
              <p className="text-[11px] text-slate-400">
                Configure disk storage location, auto-detect projects, and hardware threads
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
        <div className="p-6 space-y-5 text-xs text-slate-300 overflow-y-auto flex-1 custom-scrollbar">
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

              {/* Folder Path Input & Picker */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                  <span>Project Storage Location:</span>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSavePath();
                        }
                      }}
                      placeholder="C:\path\to\projects_data"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500/60 text-slate-100 font-mono text-xs outline-none"
                    />
                  </div>

                  <button
                    onClick={handleBrowseFolder}
                    disabled={isScanning}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition shadow-md whitespace-nowrap disabled:opacity-50"
                    title="Browse and select folder in Windows dialog"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Browse...</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Changing folder will automatically scan and auto-select existing projects found within.
                </p>
              </div>

              {/* Discovered Projects Auto-Scan Preview Section */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-white">
                      Discovered Projects ({storageInfo?.projects?.length ?? 0})
                    </span>
                  </div>
                  <button
                    onClick={handleRescan}
                    disabled={isScanning || isLoading}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-700 transition disabled:opacity-50"
                    title="Rescan directory for newly added project folders"
                  >
                    <RefreshCw className={`w-3 h-3 text-cyan-400 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'Scanning...' : 'Rescan Folder'}</span>
                  </button>
                </div>

                {/* Auto-loaded Notification Banner */}
                {autoLoadedTitle && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] truncate">
                      Auto-loaded latest project: <strong className="text-white">"{autoLoadedTitle}"</strong>
                    </span>
                  </div>
                )}

                {isScanning ? (
                  <div className="py-6 flex flex-col items-center justify-center space-y-2 text-cyan-400">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="text-xs">Scanning storage path and subfolders for project.json files...</span>
                  </div>
                ) : storageInfo?.projects && storageInfo.projects.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {storageInfo.projects.map((p: any, idx: number) => {
                      const isCurrent = p.id === currentProjectId;
                      const isAutoSelected = (!currentProjectId || isCurrent) && idx === 0;

                      return (
                        <div
                          key={p.id || idx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between transition ${
                            isCurrent
                              ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-100'
                              : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold truncate text-white text-xs">{p.title || 'Untitled Project'}</span>
                              {isCurrent ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shrink-0">
                                  Active & In Use
                                </span>
                              ) : isAutoSelected ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shrink-0 flex items-center space-x-1">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>Auto-Loaded</span>
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center space-x-3 text-[10px] text-slate-400 mt-1">
                              <span>Updated: {new Date(p.updatedAt || Date.now()).toLocaleDateString()}</span>
                              {p.hasDiskAudio && (
                                <span className="text-emerald-400 flex items-center space-x-1">
                                  <Music className="w-3 h-3" />
                                  <span>Combined MP3</span>
                                </span>
                              )}
                              {p.diskChunkCount > 0 && (
                                <span className="text-cyan-400 font-mono">
                                  {p.diskChunkCount} chunks
                                </span>
                              )}
                            </div>
                          </div>
                          {DesktopBridge.isDesktop() && (
                            <button
                              onClick={() => DesktopBridge.openStorageFolder(`projects/${p.id}`)}
                              className="p-1.5 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition shrink-0"
                              title="Open project folder in Windows Explorer"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 px-3 rounded-lg bg-slate-900/50 border border-slate-800/60 text-slate-400 text-[11px] text-center">
                    No existing projects found in this location. Any new projects you create will be stored here.
                  </div>
                )}
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

              {/* Open in File Explorer Action */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white mb-0.5">Inspect Storage Folder</h4>
                  <p className="text-[11px] text-slate-400">
                    Open your active storage directory directly in Windows File Explorer
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
        <div className="h-14 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 select-none shrink-0">
          {isDesktop && (
            <button
              onClick={handleSavePath}
              disabled={isScanning}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition border border-slate-700 font-medium disabled:opacity-50"
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
