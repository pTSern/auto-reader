import React, { useEffect, useRef, useState } from 'react';
import { Edit3, Mic, Wand2, Copy, Check, Trash2, Play } from 'lucide-react';
import { TimedCue } from '../types';
import { unwrapLines } from '../services/pdfExtractor';

interface WorkspacePanelProps {
  textContent: string;
  onTextChange: (text: string) => void;
  cues: TimedCue[];
  activeCueIndex: number;
  onSeekToCue: (cue: TimedCue) => void;
  isPlaying: boolean;
  isReadonly?: boolean;
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  textContent,
  onTextChange,
  cues,
  activeCueIndex,
  onSeekToCue,
  isPlaying,
  isReadonly = false,
}) => {
  const [tab, setTab] = useState<'karaoke' | 'edit'>('karaoke');
  const [copied, setCopied] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(700);
  const activeSentenceRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerHeight(scrollContainerRef.current.clientHeight || 700);
    }
  }, []);

  // Auto-scroll to active sentence in karaoke mode
  useEffect(() => {
    if (tab === 'karaoke' && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeCueIndex, tab]);

  // Virtualized window calculation for large projects
  const ITEM_HEIGHT = 80;
  const BUFFER = 25;
  const isVirtualized = cues.length > 60;

  let startIndex = 0;
  let endIndex = cues.length;
  let topSpacer = 0;
  let bottomSpacer = 0;

  if (isVirtualized) {
    const rawStart = Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER;
    const rawEnd = Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER;
    startIndex = Math.max(0, rawStart);
    endIndex = Math.min(cues.length, rawEnd);

    // Guarantee the active cue is ALWAYS in the DOM so it can be scrolled and highlighted
    if (activeCueIndex >= 0) {
      if (activeCueIndex < startIndex) {
        startIndex = Math.max(0, activeCueIndex - 10);
      } else if (activeCueIndex >= endIndex) {
        endIndex = Math.min(cues.length, activeCueIndex + 10);
      }
    }

    topSpacer = startIndex * ITEM_HEIGHT;
    bottomSpacer = Math.max(0, (cues.length - endIndex) * ITEM_HEIGHT);
  }

  const visibleCues = isVirtualized ? cues.slice(startIndex, endIndex) : cues;

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCleanLines = () => {
    onTextChange(unwrapLines(textContent));
  };

  const formatSec = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900/60 h-full overflow-hidden">
      {/* Workspace Toolbar */}
      <div className="h-12 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-950/70 select-none">
        {/* Left Tabs */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          <button
            onClick={() => setTab('karaoke')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              tab === 'karaoke'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>🎤 Karaoke View</span>
          </button>

          <button
            onClick={() => setTab('edit')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              tab === 'edit'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>✏️ Edit Text</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center space-x-2 text-xs">
          {isReadonly && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
              🔒 Locked (Generating)
            </span>
          )}

          <button
            onClick={handleCleanLines}
            disabled={isReadonly}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-slate-300 border border-slate-800 transition ${
              isReadonly ? 'opacity-40 cursor-not-allowed bg-slate-900' : 'bg-slate-900 hover:bg-slate-850 hover:text-white'
            }`}
            title="Merge broken linebreaks into continuous paragraphs"
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Clean Linebreaks</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 transition"
            title="Copy all text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => !isReadonly && onTextChange('')}
            disabled={isReadonly}
            className={`p-1 rounded-md transition ${
              isReadonly ? 'opacity-30 cursor-not-allowed text-slate-600' : 'hover:bg-rose-950/40 text-slate-400 hover:text-rose-400'
            }`}
            title="Clear all text"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col no-drag select-text"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {isReadonly && tab === 'edit' && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center space-x-2 animate-pulse">
            <span>🔒</span>
            <span className="font-semibold">Text Editor is Locked:</span>
            <span>Audio synthesis is active. Editing is disabled to protect sentence timestamp synchronization.</span>
          </div>
        )}

        {tab === 'edit' ? (
          <textarea
            value={textContent}
            readOnly={isReadonly}
            onChange={(e) => !isReadonly && onTextChange(e.target.value)}
            placeholder="Type, paste text, or extract from PDF/TXT files on the left panel..."
            style={{ WebkitAppRegion: 'no-drag', userSelect: 'text' } as any}
            className={`w-full flex-1 min-h-[400px] bg-transparent text-sm leading-relaxed outline-none resize-none font-mono selection:bg-cyan-500/30 transition-opacity no-drag select-text cursor-text ${
              isReadonly ? 'cursor-not-allowed text-slate-400 select-all' : 'text-slate-200'
            }`}
          />
        ) : (
          /* Karaoke Synchronized View */
          <div className="max-w-3xl mx-auto space-y-3 w-full">
            {cues.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-sm space-y-3">
                <Mic className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p>No audio generated yet.</p>
                <p className="text-xs text-slate-600">
                  Click <strong className="text-cyan-400">"Generate Audio"</strong> on the right to synthesize speech with real-time sentence timestamps.
                </p>
              </div>
            ) : (
              <>
                {topSpacer > 0 && <div style={{ height: topSpacer }} aria-hidden="true" />}
                {visibleCues.map((cue, offsetIdx) => {
                  const idx = startIndex + offsetIdx;
                  const isActive = idx === activeCueIndex;
                  const isPast = idx < activeCueIndex;

                  return (
                    <div
                      key={cue.id}
                      ref={isActive ? activeSentenceRef : null}
                      onClick={() => onSeekToCue(cue)}
                      className={`p-3.5 rounded-xl transition-all duration-300 cursor-pointer text-sm leading-relaxed border select-text ${
                        isActive
                          ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.25)] scale-[1.01]'
                          : isPast
                          ? 'bg-slate-950/20 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                          : 'bg-slate-950/30 border-transparent text-slate-300 hover:bg-slate-800/40 hover:text-white'
                      }`}
                    >
                      {/* Timestamp & Active Indicator Badge */}
                      <div className="flex items-center justify-between text-[11px] mb-1.5 select-none font-mono">
                        <span className={`inline-flex items-center space-x-1.5 ${isActive ? 'text-cyan-400 font-semibold' : 'text-slate-500'}`}>
                          {isActive && <Play className="w-3 h-3 fill-cyan-400 animate-pulse" />}
                          <span>{formatTime(cue.start)}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 text-[10px] ml-1">
                              NOW PLAYING • LINE {idx + 1}/{cues.length}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-600 hover:text-slate-400">
                          Jump here
                        </span>
                      </div>

                      <p className={isActive ? 'font-medium text-slate-50' : ''}>
                        {cue.text}
                      </p>
                    </div>
                  );
                })}
                {bottomSpacer > 0 && <div style={{ height: bottomSpacer }} aria-hidden="true" />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
