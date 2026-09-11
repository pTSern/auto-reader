import React, { useState } from 'react';
import {
  Sliders,
  X,
  Mic,
  Cpu,
  Zap,
  Layers,
  Sparkles,
  Download,
  FileAudio,
  FileCode,
  Square,
  Loader2,
  ChevronDown,
  Check,
  HardDrive,
} from 'lucide-react';
import { VoiceModel, ShadowGenSettings, VoiceTrackStatus } from '../types';
import {
  getMaxHardwareThreads,
  getGlobalCpuThreads,
  setGlobalCpuThreads,
  getHardwareProfile,
} from '../services/chunkingEngine';

interface MobileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: VoiceModel;
  onOpenVoiceModal: () => void;
  voiceStatus?: VoiceTrackStatus;
  speed: number;
  onSpeedChange: (speed: number) => void;
  pitch: number;
  onPitchChange: (pitch: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onGenerateAudio: () => void;
  onStopGenerating: () => void;
  isGenerating: boolean;
  shadowSettings: ShadowGenSettings;
  onShadowSettingsChange: (settings: ShadowGenSettings) => void;
  chunkProgress?: {
    completedChunks: number;
    totalChunks: number;
    activeChunkId: number;
  } | null;
  onExportMp3: () => void;
  onExportSrt: () => void;
  hasAudio: boolean;
  onOpenStorageSettings?: () => void;
}

export const MobileSettingsModal: React.FC<MobileSettingsModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onOpenVoiceModal,
  voiceStatus,
  speed,
  onSpeedChange,
  pitch,
  onPitchChange,
  volume,
  onVolumeChange,
  onGenerateAudio,
  onStopGenerating,
  isGenerating,
  shadowSettings,
  onShadowSettingsChange,
  chunkProgress,
  onExportMp3,
  onExportSrt,
  hasAudio,
  onOpenStorageSettings,
}) => {
  const maxThreads = getMaxHardwareThreads();
  const [cpuThreads, setCpuThreads] = useState<number>(getGlobalCpuThreads());
  const hardware = getHardwareProfile();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Voice & Engine Settings</h3>
              <p className="text-[11px] text-slate-400">
                CPU threads, shadow generation, and speech tuning
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
        <div className="p-5 space-y-4 text-xs text-slate-300 overflow-y-auto flex-1 custom-scrollbar">
          {/* Primary Action: Generate / Stop Synthesis */}
          <div className="space-y-2">
            {isGenerating ? (
              <button
                onClick={onStopGenerating}
                className="w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 transition animate-pulse"
                title="Stop audio generation in progress"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Stop Generating</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onGenerateAudio();
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-950/40 transition active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>🎙️ Generate Audio (Edge-TTS)</span>
              </button>
            )}

            {/* Chunk Progress Status */}
            {chunkProgress && chunkProgress.totalChunks > 1 && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-300 font-medium flex items-center space-x-1.5">
                    {isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>
                      {isGenerating
                        ? `Synthesizing Chunk ${chunkProgress.activeChunkId + 1}/${chunkProgress.totalChunks}...`
                        : `All ${chunkProgress.totalChunks} Chunks Ready`}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {chunkProgress.completedChunks}/{chunkProgress.totalChunks}
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full transition-all duration-300"
                    style={{
                      width: `${(chunkProgress.completedChunks / chunkProgress.totalChunks) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Voice Selection Trigger Card */}
          <div
            onClick={() => {
              onClose();
              onOpenVoiceModal();
            }}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-700/80 hover:border-cyan-400/80 cursor-pointer transition group shadow-md"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center space-x-1.5">
                <span className="text-sm">{selectedVoice.flag}</span>
                <span className="font-semibold text-white">{selectedVoice.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
                  {selectedVoice.gender}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition" />
            </div>

            <p className="text-[11px] font-mono text-cyan-400 truncate">{selectedVoice.id}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {selectedVoice.personality || selectedVoice.region}
            </p>

            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-cyan-300 transition font-medium">
              <span>Change Voice & Language</span>
              <span>300+ available &rarr;</span>
            </div>
          </div>

          {/* CPU Hardware Threads Slider */}
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
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>1 Thread (Battery Saver)</span>
                <span className="text-slate-500 font-mono">Device: {maxThreads} Cores</span>
                <span>{maxThreads} (Max Speed)</span>
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

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Controls how many background audio workers run concurrently during pre-generation. Set between 1 and {maxThreads} depending on device temperature and speed.
            </p>
          </div>

          {/* Chunking & Shadow Generation Settings */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-white">Massive Context & Chunking</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
                Fast Start
              </span>
            </div>

            {/* Chunk Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Chunk Size</span>
                <span className="font-mono text-white font-semibold">
                  {shadowSettings.chunkSizeWords} words
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="1500"
                step="50"
                disabled={isGenerating}
                value={shadowSettings.chunkSizeWords}
                onChange={(e) =>
                  onShadowSettingsChange({
                    ...shadowSettings,
                    chunkSizeWords: parseInt(e.target.value),
                  })
                }
                className={`w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 ${
                  isGenerating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>200w (Fast start)</span>
                <span>1500w (Large batch)</span>
              </div>
            </div>

            {/* Shadow Generation Toggle */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center space-x-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span className="font-medium text-white text-[11px]">Shadow Background Generation</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Pre-synthesize subsequent chunks while you listen
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  disabled={isGenerating}
                  checked={shadowSettings.enabled}
                  onChange={(e) =>
                    onShadowSettingsChange({
                      ...shadowSettings,
                      enabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Concurrency Mode */}
            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <span className="text-[10px] text-slate-400 block font-medium">Generation Priority</span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {(['auto', 'aggressive', 'potato'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() =>
                      onShadowSettingsChange({
                        ...shadowSettings,
                        concurrencyMode: mode,
                      })
                    }
                    className={`py-1 px-2 rounded-lg border text-center capitalize transition ${
                      shadowSettings.concurrencyMode === mode
                        ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300 font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Speech Tuning Sliders */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-white">Speech Tuning</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Real-time SSML</span>
            </div>

            {/* Speed Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Speed / Rate</span>
                <span className="font-mono text-white">
                  {speed >= 0 ? `+${speed}%` : `${speed}%`} ({(1 + speed / 100).toFixed(2)}x)
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={speed}
                onChange={(e) => onSpeedChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Pitch Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Voice Pitch</span>
                <span className="font-mono text-white">
                  {pitch >= 0 ? `+${pitch} Hz` : `${pitch} Hz`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={pitch}
                onChange={(e) => onPitchChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Volume Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Volume</span>
                <span className="font-mono text-white">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Export Section */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-white flex items-center space-x-1.5">
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Outputs</span>
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onExportMp3}
                disabled={!hasAudio}
                className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition text-xs font-medium border ${
                  hasAudio
                    ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-300'
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <FileAudio className="w-4 h-4 text-cyan-400" />
                <span>Save MP3</span>
              </button>

              <button
                onClick={onExportSrt}
                disabled={!hasAudio}
                className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition text-xs font-medium border ${
                  hasAudio
                    ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-emerald-300'
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Save SRT</span>
              </button>
            </div>
          </div>

          {/* Storage Settings Shortcut */}
          {onOpenStorageSettings && (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Disk Storage Location</p>
                <p className="text-[10px] text-slate-400">Configure file paths & auto-scan</p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenStorageSettings();
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
              >
                Manage
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 select-none shrink-0">
          <button
            onClick={onClose}
            className="ml-auto px-5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
