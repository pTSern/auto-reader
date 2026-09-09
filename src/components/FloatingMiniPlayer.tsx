import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Pin, Maximize2, X, Move, Volume2, VolumeX } from 'lucide-react';
import { TimedCue } from '../types';

interface FloatingMiniPlayerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
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
  isPinned: boolean;
  onTogglePin: () => void;
  onExpand: () => void;
}

export const FloatingMiniPlayer: React.FC<FloatingMiniPlayerProps> = ({
  isPlaying,
  onTogglePlay,
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
  isPinned,
  onTogglePin,
  onExpand,
}) => {
  const [position, setPosition] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const progressBarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking the drag handle area
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 730, dragStartRef.current.startX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 160, dragStartRef.current.startY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={`fixed z-50 w-[720px] rounded-2xl bg-slate-950/95 border-2 shadow-2xl backdrop-blur-md select-none transition-shadow ${
        isPinned
          ? 'border-cyan-400 shadow-[0_0_25px_rgba(56,189,248,0.35)]'
          : 'border-slate-700/80 shadow-black/80'
      }`}
    >
      {/* Top Drag Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="h-8 px-3.5 bg-slate-900/80 rounded-t-2xl border-b border-slate-800/80 flex items-center justify-between cursor-move text-xs text-slate-300"
      >
        <div className="flex items-center space-x-2 truncate">
          <Move className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-semibold text-white text-[11px] truncate">
            {trackTitle || 'VoiceFlow Mini Player'}
          </span>
          <span className="text-slate-600 text-[10px]">•</span>
          <span className="text-[10px] text-slate-400 truncate">Drag anywhere</span>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-1.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          {/* Pin Toggle */}
          <button
            onClick={onTogglePin}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-1 transition border ${
              isPinned
                ? 'bg-cyan-950 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.3)]'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title={isPinned ? 'Always on Top active' : 'Click to pin Always on Top'}
          >
            <Pin className={`w-3 h-3 ${isPinned ? 'rotate-45 fill-cyan-400 text-cyan-400' : ''}`} />
            <span>{isPinned ? 'PINNED ON TOP' : 'PIN ON TOP'}</span>
          </button>

          {/* Expand to Full App */}
          <button
            onClick={onExpand}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Expand to full window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtitle Karaoke Line Box */}
      <div className="px-4 pt-3 pb-2">
        <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 min-h-[46px] flex items-center">
          <p className="text-xs text-slate-100 font-medium leading-relaxed truncate-2-lines">
            <span className="font-mono text-cyan-400 font-bold mr-1.5 inline-flex items-center">
              ▶ {formatSec(currentTime)} •
            </span>
            {activeCue ? (
              <span>"{activeCue.text}"</span>
            ) : (
              <span className="text-slate-500">Audio ready. Press play to start listening...</span>
            )}
          </p>
        </div>
      </div>

      {/* Bottom Transport Controls Bar */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between space-x-4">
        {/* Timeline Scrubber */}
        <div className="flex-1 flex items-center space-x-2 text-[11px] font-mono text-slate-400">
          <span className="w-10 text-right">{formatSec(currentTime)}</span>
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="flex-1 h-2 bg-slate-800 hover:h-2.5 rounded-full cursor-pointer relative transition-all group overflow-hidden"
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full relative"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-10">{formatSec(duration)}</span>
        </div>

        {/* Mini Buttons Row */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onSkipBack}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="-10s"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow transition"
            title="Play / Pause"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-slate-950" />
            ) : (
              <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
            )}
          </button>

          <button
            onClick={onSkipForward}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title="+10s"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Toggle */}
          <button
            onClick={() => {
              const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
              const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
              onPlaybackSpeedChange(speeds[nextIdx]);
            }}
            className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300 hover:text-white"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
};
