import React from 'react';
import {
  Mic,
  Sliders,
  ChevronDown,
  Download,
  FileAudio,
  FileCode,
  Sparkles,
  Loader2,
  Square,
  Cpu,
  Layers,
  Zap,
  Check,
} from 'lucide-react';
import { VoiceModel, ShadowGenSettings, VoiceTrackStatus } from '../types';
import { getHardwareProfile } from '../services/chunkingEngine';

interface VoiceSettingsPanelProps {
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
}

export const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
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
}) => {
  const hardware = getHardwareProfile();

  return (
    <div className="w-80 flex flex-col bg-slate-900 border-l border-slate-800/80 h-full p-4 space-y-4 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
          <Mic className="w-4 h-4 text-cyan-400" />
          <span>Voice & Speech Engine</span>
        </h2>
      </div>

      {/* Voice Selection Trigger Card */}
      <div
        onClick={onOpenVoiceModal}
        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-700/80 hover:border-cyan-400/80 cursor-pointer transition group shadow-md"
      >
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span className="flex items-center space-x-1">
            <span>{selectedVoice.flag}</span>
            <span className="font-semibold text-white">{selectedVoice.name}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
              {selectedVoice.gender}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition" />
        </div>

        <p className="text-[11px] font-mono text-cyan-400 truncate">
          {selectedVoice.id}
        </p>

        <p className="text-[10px] text-slate-400 mt-1 truncate">
          {selectedVoice.personality || selectedVoice.region}
        </p>

        {/* Voice Generation Status Badge */}
        <div className="mt-2 flex items-center justify-between">
          {voiceStatus?.hasCombined ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center space-x-1 shadow-sm">
              <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-400" />
              <span>Full Audio Ready (100%)</span>
            </span>
          ) : voiceStatus && voiceStatus.chunkCount > 0 ? (
            <span className="px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-500/40 text-amber-300 text-[10px] font-medium flex items-center space-x-1 shadow-sm">
              <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
              <span>
                {chunkProgress?.totalChunks
                  ? `${Math.round((voiceStatus.chunkCount / chunkProgress.totalChunks) * 100)}% Generated (${voiceStatus.chunkCount}/${chunkProgress.totalChunks})`
                  : `${voiceStatus.chunkCount} chunks generated`}
              </span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-500 text-[10px]">
              Not Generated
            </span>
          )}
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-cyan-300 transition font-medium">
          <span>Change Voice & Language</span>
          <span>300+ available &rarr;</span>
        </div>
      </div>

      {/* Sliders Box */}
      <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3.5 text-xs text-slate-300">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span className="flex items-center space-x-1">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span>Speech Tuning</span>
          </span>
          <span className="text-[10px] text-cyan-400">Real-time SSML</span>
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

      {/* Chunking & Shadow Generation Settings */}
      <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3 text-xs text-slate-300">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Massive Context & Chunking</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
            Fast Start
          </span>
        </div>

        {/* Chunk Size */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Chunk Size</span>
            <span className="font-mono text-white">{shadowSettings.chunkSizeWords} words</span>
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
            className={`w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 ${
              isGenerating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>200w (Fast start)</span>
            <span>1500w (Batch)</span>
          </div>
        </div>

        {/* Shadow Generation Toggle */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="font-medium text-white text-[11px]">Shadow Generation</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Pre-synthesize subsequent chunks in background
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
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

        {/* Hardware Adaptation Badge */}
        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[10px]">
          <span className="flex items-center space-x-1 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>CPU Hardware:</span>
          </span>
          <span className="font-mono text-cyan-300">
            {hardware.cores} Cores &bull; {hardware.isStrongCpu ? '3x Parallel' : '1x Potato'}
          </span>
        </div>
      </div>

      {/* Chunk Progress Status (Visible when generating or partially completed) */}
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

          {/* Progress Bar */}
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

      {/* Action Buttons: Generate & Stop Generating */}
      <div className="space-y-2">
        {isGenerating ? (
          <button
            onClick={onStopGenerating}
            className="w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 transition animate-pulse"
            title="Force stop audio generation in progress"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Stop Generating</span>
          </button>
        ) : (
          <button
            onClick={onGenerateAudio}
            className="w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-950/40 transition"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Generate Audio (Edge-TTS)</span>
          </button>
        )}
      </div>

      {/* Export Section */}
      <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-400 font-medium text-[11px] pb-1 border-b border-slate-800">
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Outputs</span>
        </div>

        <button
          onClick={onExportMp3}
          disabled={!hasAudio}
          className={`w-full py-2 px-3 rounded-lg flex items-center justify-between transition text-xs ${
            hasAudio
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center space-x-2">
            <FileAudio className="w-4 h-4 text-cyan-400" />
            <span>Save Audio File (.MP3)</span>
          </span>
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onExportSrt}
          disabled={!hasAudio}
          className={`w-full py-2 px-3 rounded-lg flex items-center justify-between transition text-xs ${
            hasAudio
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
          }`}
        >
          <span className="flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>Save Subtitles (.SRT)</span>
          </span>
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
