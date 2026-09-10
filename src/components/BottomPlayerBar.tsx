import React, { useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Square, Volume2, VolumeX, Minimize2, Sparkles, Mic, Zap } from 'lucide-react';
import { TimedCue } from '../types';

interface BottomPlayerBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  trackTitle: string;
  activeCue: TimedCue | null;
  activeCueIndex: number;
  totalCues: number;
  onPopOutMini: () => void;
  isSwiftRead?: boolean;
  onToggleSwiftRead?: () => void;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  isPlaying,
  onTogglePlay,
  onStop,
  onSkipBack,
  onSkipForward,
  currentTime,
  duration,
  onSeek,
  playbackSpeed,
  onPlaybackSpeedChange,
  volume,
  onVolumeChange,
  trackTitle,
  activeCue,
  activeCueIndex,
  totalCues,
  onPopOutMini,
  isSwiftRead = false,
  onToggleSwiftRead,
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatSec = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration === 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pos * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="h-20 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between select-none z-20">
      {/* Left: Track Info & Current Line */}
      <div className="w-1/4 min-w-[200px] truncate pr-4">
        <p className="text-xs font-semibold text-white truncate" title={trackTitle}>
          🎵 {trackTitle || 'Audio Ready'}
        </p>
        <p className="text-[11px] text-cyan-400 truncate mt-0.5">
          {totalCues > 0
            ? `Line ${activeCueIndex + 1} of ${totalCues} • ${activeCue?.text.substring(0, 40) || ''}...`
            : 'Ready to play'}
        </p>
      </div>

      {/* Center: Controls & Timeline */}
      <div className="flex-1 max-w-2xl flex flex-col items-center space-y-1.5">
        {/* Buttons Row */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onSkipBack}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Skip back 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-cyan-950/50 transition transform active:scale-95"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={onSkipForward}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="Skip forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={onStop}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
            title="Stop playback"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Timeline Scrubber */}
        <div className="w-full flex items-center space-x-3 text-[11px] font-mono text-slate-400">
          <span>{formatSec(currentTime)}</span>

          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="flex-1 h-2 bg-slate-800 hover:h-2.5 rounded-full cursor-pointer relative transition-all group overflow-hidden"
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>

          <span>{formatSec(duration)}</span>
        </div>

        {/* Speed Pills */}
        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
          <span>Speed:</span>
          {speedOptions.map((spd) => (
            <button
              key={spd}
              onClick={() => onPlaybackSpeedChange(spd)}
              className={`px-1.5 py-0.2 rounded transition font-mono ${
                playbackSpeed === spd
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40'
                  : 'hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Right: Volume & Pop Out Mini Player */}
      <div className="w-1/4 min-w-[200px] flex items-center justify-end space-x-3">
        {/* Volume */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onVolumeChange(volume === 0 ? 80 : 0)}
            className="text-slate-400 hover:text-white"
          >
            {volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value))}
            className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Swift Read RSVP Toggle Button */}
        {onToggleSwiftRead && (
          <button
            onClick={onToggleSwiftRead}
            className={`flex items-center space-x-1 px-2 py-1.5 rounded-lg border transition text-xs font-medium ${
              isSwiftRead
                ? 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'bg-slate-900 border-slate-700 hover:border-slate-600 text-slate-400 hover:text-white'
            }`}
            title="Swift Reading RSVP mode (Single-word speed reading in mini-mode)"
          >
            <Zap className={`w-3.5 h-3.5 ${isSwiftRead ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span className="hidden xl:inline">Swift</span>
          </button>
        )}

        {/* Pop Out Mini Player Button */}
        <button
          onClick={onPopOutMini}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white transition text-xs font-medium"
          title="Scale down to floating mini-player bar"
        >
          <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden lg:inline">Mini Player</span>
        </button>
      </div>
    </div>
  );
};
