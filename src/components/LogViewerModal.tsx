import React, { useState, useEffect } from 'react';
import { Terminal, X, Trash2, Download, AlertCircle, AlertTriangle, Info, Search } from 'lucide-react';
import { LogEntry } from '../types';
import { Logger } from '../services/logger';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = Logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchQuery.trim() && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleExport = () => {
    const content = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`)
      .reverse()
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voiceflow_debug_${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl h-[640px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Application Execution Logs</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {logs.length} entries
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Logged to in-app console and automatically appended to <code className="text-cyan-300">app.log</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition border border-slate-700 font-medium"
              title="Download full log file"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export .log</span>
            </button>

            <button
              onClick={() => Logger.clear()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs transition border border-rose-800/40 font-medium"
              title="Clear all in-memory logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-3 text-xs">
          {/* Level Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition text-xs ${
                  filterLevel === lvl
                    ? 'bg-slate-800 text-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search Query */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>

        {/* Logs Stream Container */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1.5 custom-scrollbar bg-slate-950/90">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-24 text-slate-500">
              No matching log records found.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isErr = log.level === 'error';
              const isWarn = log.level === 'warn';

              return (
                <div
                  key={log.id}
                  className={`p-2 rounded border flex items-start space-x-2.5 transition ${
                    isErr
                      ? 'bg-rose-950/30 border-rose-900/50 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isErr ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 shrink-0 select-none">
                    {log.timestamp}
                  </span>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 select-none ${
                      isErr
                        ? 'bg-rose-900/60 text-rose-300'
                        : isWarn
                        ? 'bg-amber-900/60 text-amber-300'
                        : 'bg-cyan-950 text-cyan-400'
                    }`}
                  >
                    {log.level}
                  </span>

                  <div className="flex-1 break-words">
                    <span className="leading-tight">{log.message}</span>
                    {log.details && (
                      <pre className="mt-1 p-1.5 rounded bg-black/40 text-[11px] text-slate-400 overflow-x-auto">
                        {typeof log.details === 'object'
                          ? JSON.stringify(log.details, null, 2)
                          : String(log.details)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
