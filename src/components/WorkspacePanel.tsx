import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit3, Subtitles, Wand2, Copy, Check, Trash2, Play, Search, X, FastForward } from 'lucide-react';
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
  totalChunks?: number;
  currentChunkIndex?: number;
  onJumpToChunk?: (chunkNumber: number) => void;
  onOpenSettings?: () => void;
}

export const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  textContent,
  onTextChange,
  cues,
  activeCueIndex,
  onSeekToCue,
  isPlaying,
  isReadonly = false,
  totalChunks = 0,
  currentChunkIndex = 0,
  onJumpToChunk,
  onOpenSettings,
}) => {
  const [tab, setTab] = useState<'subtitle' | 'edit'>('subtitle');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetChunkInput, setTargetChunkInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(700);
  const activeSentenceRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const handleJumpChunkSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!targetChunkInput.trim() || !onJumpToChunk) return;
    const num = parseInt(targetChunkInput.trim(), 10);
    if (!isNaN(num) && num >= 1) {
      onJumpToChunk(num);
      setTargetChunkInput('');
    }
  };

  useEffect(() => {
    if (scrollContainerRef.current) {
      setContainerHeight(scrollContainerRef.current.clientHeight || 700);
    }
  }, []);

  // Global Ctrl+F to focus search input in subtitle mode
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && tab === 'subtitle') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [tab]);

  // Auto-scroll to active sentence in subtitle mode (only if not searching)
  useEffect(() => {
    if (tab === 'subtitle' && !searchQuery.trim() && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeCueIndex, tab, searchQuery]);

  // Real-time subtitle search filter
  const isSearching = searchQuery.trim().length > 0;
  const lowerQuery = searchQuery.trim().toLowerCase();

  const items = useMemo(() => {
    return cues
      .map((cue, originalIndex) => ({ cue, originalIndex }))
      .filter(({ cue }) => !isSearching || cue.text.toLowerCase().includes(lowerQuery));
  }, [cues, isSearching, lowerQuery]);

  // Virtualized window calculation for large projects
  const ITEM_HEIGHT = 80;
  const BUFFER = 25;
  const isVirtualized = items.length > 60;

  let startIndex = 0;
  let endIndex = items.length;
  let topSpacer = 0;
  let bottomSpacer = 0;

  if (isVirtualized) {
    const rawStart = Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER;
    const rawEnd = Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER;
    startIndex = Math.max(0, rawStart);
    endIndex = Math.min(items.length, rawEnd);

    // Guarantee the active cue is in DOM if present in current filtered items
    const activeItemIndex = items.findIndex((it) => it.originalIndex === activeCueIndex);
    if (activeItemIndex >= 0) {
      if (activeItemIndex < startIndex) {
        startIndex = Math.max(0, activeItemIndex - 10);
      } else if (activeItemIndex >= endIndex) {
        endIndex = Math.min(items.length, activeItemIndex + 10);
      }
    }

    topSpacer = startIndex * ITEM_HEIGHT;
    bottomSpacer = Math.max(0, (items.length - endIndex) * ITEM_HEIGHT);
  }

  const visibleItems = isVirtualized ? items.slice(startIndex, endIndex) : items;

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
        <div className="flex items-center space-x-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => setTab('subtitle')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              tab === 'subtitle'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>💬 Subtitle View</span>
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

        {/* Center: Search Subtitle Lines (Active in Subtitle View) */}
        {tab === 'subtitle' && cues.length > 0 && (
          <div className="flex-1 max-w-sm mx-3 relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Search subtitle lines... (Ctrl+F)"
              className="w-full bg-slate-900/90 border border-slate-800 hover:border-slate-700 focus:border-cyan-500/70 rounded-lg pl-8 pr-20 py-1 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition select-text"
            />
            {searchQuery && (
              <div className="absolute right-2 flex items-center space-x-1.5">
                <span className="text-[10px] text-cyan-400 font-mono font-semibold">
                  {items.length} {items.length === 1 ? 'match' : 'matches'}
                </span>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Clear search (Esc)"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Fast-travel Jump to Chunk ID */}
        {totalChunks > 1 && onJumpToChunk && (
          <form
            onSubmit={handleJumpChunkSubmit}
            className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2 py-1 text-xs shrink-0 select-none transition"
          >
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Chunk</span>
            <input
              type="number"
              min={1}
              max={totalChunks}
              value={targetChunkInput}
              onChange={(e) => setTargetChunkInput(e.target.value)}
              placeholder={String((currentChunkIndex || 0) + 1)}
              className="w-12 bg-slate-950 border border-slate-700/80 focus:border-cyan-400 rounded px-1 py-0.5 text-center text-xs font-mono text-cyan-300 outline-none select-text"
              title={`Enter chunk number to jump (1 to ${totalChunks})`}
            />
            <span className="text-[10px] text-slate-500 font-mono">/ {totalChunks}</span>
            <button
              type="submit"
              className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-medium transition active:scale-95"
              title="Fast-travel to this chunk"
            >
              Go
            </button>
          </form>
        )}

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
          /* Subtitle Synchronized View */
          <div className="max-w-3xl mx-auto space-y-3 w-full">
            {cues.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-sm space-y-3">
                <Subtitles className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p>No audio generated yet.</p>
                <p className="text-xs text-slate-600">
                  {onOpenSettings ? (
                    <>
                      Click or tap{' '}
                      <button
                        onClick={onOpenSettings}
                        className="text-cyan-400 font-semibold underline hover:text-cyan-300 transition cursor-pointer"
                      >
                        &ldquo;Generate Audio&rdquo;
                      </button>{' '}
                      to synthesize speech with real-time sentence timestamps.
                    </>
                  ) : (
                    <>
                      Click <strong className="text-cyan-400">&ldquo;Generate Audio&rdquo;</strong> to synthesize speech with real-time sentence timestamps.
                    </>
                  )}
                </p>
              </div>
            ) : isSearching && items.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-sm space-y-3">
                <Search className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p>
                  No subtitle lines match &ldquo;<span className="text-cyan-400 font-semibold">{searchQuery}</span>&rdquo;
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <>
                {isSearching && items.length > 0 && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 mb-1">
                    <span className="flex items-center space-x-1.5">
                      <Search className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        Found <strong>{items.length}</strong> matching lines for &ldquo;<strong>{searchQuery}</strong>&rdquo;
                      </span>
                    </span>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-200 underline"
                    >
                      Show all {cues.length} lines
                    </button>
                  </div>
                )}

                {topSpacer > 0 && <div style={{ height: topSpacer }} aria-hidden="true" />}
                {visibleItems.map(({ cue, originalIndex: idx }) => {
                  const isActive = idx === activeCueIndex;
                  const isPast = idx < activeCueIndex;
                  // Only allow selecting subtitle line that is done generated
                  const isLineReady = cue.isReady !== false && (!isReadonly || cue.isReady === true);

                  return (
                    <div
                      key={cue.id}
                      ref={isActive ? activeSentenceRef : null}
                      onClick={isLineReady ? () => onSeekToCue(cue) : undefined}
                      className={`group p-3.5 rounded-xl transition-all duration-300 text-sm leading-relaxed border select-text ${
                        !isLineReady
                          ? 'bg-slate-950/20 border-dashed border-slate-800/60 opacity-40 grayscale cursor-not-allowed select-none'
                          : isActive
                          ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.25)] scale-[1.01] cursor-pointer'
                          : isPast
                          ? 'bg-slate-950/20 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 cursor-pointer'
                          : 'bg-slate-950/30 border-transparent text-slate-300 hover:bg-slate-800/40 hover:text-white cursor-pointer'
                      }`}
                    >
                      {/* Timestamp & Active Indicator Badge */}
                      <div className="flex items-center justify-between text-[11px] mb-1.5 select-none font-mono">
                        <span className={`inline-flex items-center space-x-1.5 ${
                          !isLineReady ? 'text-slate-600' : isActive ? 'text-cyan-400 font-semibold' : 'text-slate-500'
                        }`}>
                          {isActive && <Play className="w-3 h-3 fill-cyan-400 animate-pulse" />}
                          <span>{formatTime(cue.start)}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 text-[10px] ml-1">
                              NOW PLAYING • LINE {idx + 1}/{cues.length}
                            </span>
                          )}
                          {!isActive && isSearching && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px] ml-1">
                              LINE {idx + 1}/{cues.length}
                            </span>
                          )}
                        </span>

                        {!isLineReady ? (
                          <span className="text-[10px] text-slate-500 flex items-center space-x-1.5 font-sans bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" />
                            <span>Not loaded yet</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 transition-colors">
                            Jump here
                          </span>
                        )}
                      </div>

                      <p className={!isLineReady ? 'text-slate-500 italic' : isActive ? 'font-medium text-slate-50' : ''}>
                        {highlightMatch(cue.text, searchQuery)}
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

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark
            key={i}
            className="bg-cyan-500/35 text-cyan-200 font-semibold px-0.5 rounded border border-cyan-400/40"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
