import React, { useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Download } from 'lucide-react';
import { TimedCue } from '../types';

interface MobilePlayerSheetProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  trackTitle: string;
  activeCue: TimedCue | null;
  onExportMp3: () => void;
  hasAudio: boolean;
}

export const MobilePlayerSheet: React.FC<MobilePlayerSheetProps> = ({
  isPlaying,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  currentTime,
  duration,
  onSeek,
  playbackSpeed,
  onPlaybackSpeedChange,
  trackTitle,
  activeCue,
  onExportMp3,
  hasAudio,
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

  return (
    <div className="bg-slate-950 border-t border-slate-800/90 px-4 pt-2.5 pb-4 select-none shadow-2xl">
      {/* Track info & mini karaoke snippet */}
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span className="text-white font-medium truncate max-w-[200px]">
          🎵 {trackTitle || 'VoiceFlow Audio'}
        </span>
        <span className="font-mono text-cyan-400">
          {formatSec(currentTime)} / {formatSec(duration)}
        </span>
      </div>

      {/* Progress Seeker */}
      <div
        ref={progressBarRef}
        onClick={handleProgressClick}
        className="w-full h-2 bg-slate-800 rounded-full cursor-pointer relative mb-3 overflow-hidden"
      >
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between">
        {/* Speed Toggle */}
        <button
          onClick={() => {
            const speeds = [0.75, 1.0, 1.25, 1.5];
            const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
            onPlaybackSpeedChange(speeds[nextIdx]);
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300"
        >
          {playbackSpeed}x
        </button>

        {/* Center Buttons */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onSkipBack}
            className="p-2 rounded-full text-slate-300 hover:text-white"
            title="-10s"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={onSkipForward}
            className="p-2 rounded-full text-slate-300 hover:text-white"
            title="+10s"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* Export audio button */}
        <button
          onClick={onExportMp3}
          disabled={!hasAudio}
          className={`p-2 rounded-lg border transition ${
            hasAudio
              ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:text-white'
              : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
          }`}
          title="Save MP3"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
