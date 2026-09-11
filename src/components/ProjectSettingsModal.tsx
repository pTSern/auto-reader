import React, { useState, useEffect } from 'react';
import { X, Settings, Check, Volume2, FastForward, Sliders, Layers, Sparkles, Zap, Trash2, HardDrive } from 'lucide-react';
import { ProjectData } from '../types';
import { DesktopBridge } from '../services/desktopBridge';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  onSaveProjectSettings: (updated: ProjectData) => Promise<void>;
  onAudioCleaned?: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  onSaveProjectSettings,
  onAudioCleaned,
}) => {
  const [title, setTitle] = useState(project.title);
  const [rate, setRate] = useState(project.voiceSettings.rate ?? 0);
  const [pitch, setPitch] = useState(project.voiceSettings.pitch ?? 0);
  const [volume, setVolume] = useState(project.voiceSettings.volume ?? 85);
  const [shadowEnabled, setShadowEnabled] = useState(project.shadowSettings?.enabled ?? true);
  const [chunkSizeWords, setChunkSizeWords] = useState(project.shadowSettings?.chunkSizeWords ?? 500);
  const [useFastStartLadder, setUseFastStartLadder] = useState(project.shadowSettings?.useFastStartLadder ?? true);
  const [concurrencyMode, setConcurrencyMode] = useState<'auto' | 'aggressive' | 'potato'>(
    project.shadowSettings?.concurrencyMode ?? 'auto'
  );
  const [syncOffsetSec, setSyncOffsetSec] = useState<number>(project.swiftSettings?.syncOffsetSec ?? 0.20);

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [audioUsage, setAudioUsage] = useState<{ size_mb: number; file_count: number }>({ size_mb: 0, file_count: 0 });
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanedFreedMb, setCleanedFreedMb] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(project.title);
      setRate(project.voiceSettings.rate ?? 0);
      setPitch(project.voiceSettings.pitch ?? 0);
      setVolume(project.voiceSettings.volume ?? 85);
      setShadowEnabled(project.shadowSettings?.enabled ?? true);
      setChunkSizeWords(project.shadowSettings?.chunkSizeWords ?? 500);
      setUseFastStartLadder(project.shadowSettings?.useFastStartLadder ?? true);
      setConcurrencyMode(project.shadowSettings?.concurrencyMode ?? 'auto');
      setSyncOffsetSec(project.swiftSettings?.syncOffsetSec ?? 0.20);
      setSavedSuccess(false);
      setCleanedFreedMb(null);
      if (DesktopBridge.isDesktop() && project.id) {
        DesktopBridge.getProjectAudioSize(project.id).then((usage) => {
          setAudioUsage(usage);
        });
      }
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleCleanAudio = async () => {
    if (!project.id || !DesktopBridge.isDesktop()) return;
    setIsCleaning(true);
    try {
      const res = await DesktopBridge.cleanupProjectAudio(project.id);
      if (res.success) {
        setCleanedFreedMb(res.freed_mb);
        setAudioUsage({ size_mb: 0, file_count: 0 });
        onAudioCleaned?.();
      }
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    const updated: ProjectData = {
      ...project,
      title: title.trim(),
      voiceSettings: {
        ...project.voiceSettings,
        rate,
        pitch,
        volume,
      },
      shadowSettings: {
        enabled: shadowEnabled,
        chunkSizeWords,
        useFastStartLadder,
        concurrencyMode,
      },
      swiftSettings: {
        ...project.swiftSettings,
        syncOffsetSec,
      },
      updatedAt: Date.now(),
    };

    await onSaveProjectSettings(updated);
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Project Settings</h3>
              <p className="text-[11px] text-slate-400">Configure title, speech parameters, and chunking for this project</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-xs text-slate-300">
          {/* Project Title Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white flex items-center justify-between">
              <span>Project Title</span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {project.id}</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title..."
              required
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-white font-medium outline-none text-sm transition"
            />
          </div>

          {/* Voice Tuning Parameters */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 text-white font-semibold">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Voice Speech Tuning</span>
            </div>

            {/* Speech Rate Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Speech Rate Offset</span>
                <span className="font-mono text-cyan-300 font-semibold">{rate > 0 ? `+${rate}%` : `${rate}%`}</span>
              </div>
              <input
                type="range"
                min={-50}
                max={100}
                step={5}
                value={rate}
                onChange={(e) => setRate(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Pitch Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Pitch Tuning</span>
                <span className="font-mono text-cyan-300 font-semibold">{pitch > 0 ? `+${pitch}Hz` : `${pitch}Hz`}</span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={2}
                value={pitch}
                onChange={(e) => setPitch(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Volume Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Default Volume</span>
                <span className="font-mono text-cyan-300 font-semibold">{volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Shadow Generation & Chunking Settings */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 text-white font-semibold">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Text Chunking & Shadow Synthesis</span>
            </div>

            {/* Shadow Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200">Enable Shadow Generation</span>
                <p className="text-[10px] text-slate-500">Synthesizes remaining chunks continuously in the background</p>
              </div>
              <input
                type="checkbox"
                checked={shadowEnabled}
                onChange={(e) => setShadowEnabled(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 cursor-pointer rounded"
              />
            </div>

            {/* Fast-Start Ladder Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200">Fast-Start Micro Ladder</span>
                <p className="text-[10px] text-slate-500">Generates first ~30 words in &lt;400ms for instant speech</p>
              </div>
              <input
                type="checkbox"
                checked={useFastStartLadder}
                onChange={(e) => setUseFastStartLadder(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 cursor-pointer rounded"
              />
            </div>

            {/* Chunk Size Slider */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Chunk Size (Words per Section)</span>
                <span className="font-mono text-cyan-300 font-semibold">{chunkSizeWords} words</span>
              </div>
              <input
                type="range"
                min={150}
                max={1200}
                step={50}
                value={chunkSizeWords}
                onChange={(e) => setChunkSizeWords(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Concurrency Mode Radio Group */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-slate-400">Concurrency Profile</label>
              <div className="grid grid-cols-3 gap-2">
                {(['auto', 'aggressive', 'potato'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setConcurrencyMode(mode)}
                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium capitalize transition ${
                      concurrencyMode === mode
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Swift Reading Sync Offset */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Swift Reading & Subtitle Sync Offset
                </h4>
              </div>

              {/* Direct Unconstrained Number Input */}
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  step="0.05"
                  value={syncOffsetSec}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    setSyncOffsetSec(isNaN(parsed) ? 0 : parsed);
                  }}
                  className="w-20 px-2 py-0.5 rounded bg-slate-900 border border-amber-400/80 text-amber-300 font-mono text-center text-xs font-bold focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="0.25"
                  title="Type any positive (earlier) or negative (delayed) offset in seconds"
                />
                <span className="text-[11px] text-slate-400 font-mono">sec</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Compensates for speaker audio latency. Positive values display text earlier/faster before audio plays; negative values delay text. Automatically scales with speech playback speed (e.g. 1.5x, 2x). No minimum or maximum limits.
            </p>

            <div className="space-y-1.5 pt-1">
              <input
                type="range"
                min={-2.0}
                max={2.0}
                step={0.05}
                value={Math.max(-2.0, Math.min(2.0, syncOffsetSec))}
                onChange={(e) => setSyncOffsetSec(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-2.0s (Slower)</span>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setSyncOffsetSec(0.0)}
                    className="hover:text-slate-300 underline"
                  >
                    0.0s (Exact)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncOffsetSec(0.20)}
                    className="hover:text-slate-300 underline"
                  >
                    +0.20s
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncOffsetSec(0.25)}
                    className="text-amber-400 hover:text-amber-300 underline font-semibold"
                  >
                    +0.25s (Recommended)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncOffsetSec(0.50)}
                    className="hover:text-slate-300 underline"
                  >
                    +0.50s
                  </button>
                </div>
                <span>+2.0s (Faster)</span>
              </div>
            </div>
          </div>

          {/* Audio Storage & Disk Cache */}
          {DesktopBridge.isDesktop() && (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="text-sm font-semibold text-white">Audio Storage & Cache</span>
                    <p className="text-[11px] text-slate-400">
                      Generated MP3 chunks and audio timing files on disk.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {audioUsage.size_mb > 0 ? `${audioUsage.size_mb} MB` : '0 MB'}
                  </span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {audioUsage.file_count} chunks
                  </div>
                </div>
              </div>

              {cleanedFreedMb !== null && (
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center space-x-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Cleaned audio successfully! Freed {cleanedFreedMb} MB.</span>
                </div>
              )}

              {audioUsage.file_count > 0 && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleCleanAudio}
                    disabled={isCleaning}
                    className="py-1.5 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 hover:border-rose-500 text-rose-300 font-medium text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isCleaning ? 'Cleaning...' : 'Clean Audio Files (Free Space)'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            {savedSuccess ? (
              <span className="text-emerald-400 font-medium flex items-center space-x-1.5 animate-pulse">
                <Check className="w-4 h-4" />
                <span>Project settings updated!</span>
              </span>
            ) : (
              <span />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition shadow-lg shadow-cyan-950/50 flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
