import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, File, Trash2, Zap, AlertTriangle, CheckCircle2, Sliders, Clock, Hash } from 'lucide-react';
import { FileReference } from '../types';
import { extractTextFromPdf, extractTextFromTextFile } from '../services/pdfExtractor';

interface FileIngestPanelProps {
  files: FileReference[];
  onAddFiles: (newFiles: FileReference[]) => void;
  onRemoveFile: (id: string) => void;
  onExtractAll: () => void;
  isExtracting: boolean;
  wordCount: number;
  charCount: number;
  estDuration: string;
}

export const FileIngestPanel: React.FC<FileIngestPanelProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onExtractAll,
  isExtracting,
  wordCount,
  charCount,
  estDuration,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newRefs: FileReference[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      let text = '';
      let pages: number | undefined = undefined;

      try {
        if (ext === 'pdf') {
          const res = await extractTextFromPdf(file);
          text = res.text;
          pages = res.pageCount;
        } else {
          text = await extractTextFromTextFile(file);
        }
      } catch (err) {
        console.warn('Failed to pre-extract text for', file.name, err);
      }

      newRefs.push({
        id: 'file_' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        path: (file as any).path || file.name,
        size: file.size,
        type: ext,
        extractedText: text,
        pageCount: pages,
        missing: false,
      });
    }

    onAddFiles(newRefs);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-80 flex flex-col bg-slate-900 border-r border-slate-800/80 h-full p-4 space-y-4 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center space-x-2">
          <span>📁 Source Files</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {files.length}
          </span>
        </h2>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFiles(e.target.files)}
        multiple
        accept=".pdf,.txt,.md,.markdown,.log,.csv"
        className="hidden"
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/20'
            : 'border-slate-700/80 hover:border-cyan-500/60 bg-slate-950/40 hover:bg-slate-950/80'
        }`}
      >
        <UploadCloud className="w-7 h-7 mx-auto mb-2 text-cyan-400" />
        <p className="text-xs font-medium text-slate-200">
          Drop PDF, TXT or MD files
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          or <span className="text-cyan-400 hover:underline">browse files</span>
        </p>
      </div>

      {/* File List */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
        {files.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No files attached yet
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={`p-2.5 rounded-lg border text-xs transition flex items-center justify-between group ${
                file.missing
                  ? 'bg-amber-950/30 border-amber-500/50 text-amber-200'
                  : 'bg-slate-800/60 border-slate-750 hover:border-slate-600 text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div className="p-1.5 rounded bg-slate-700/50 text-cyan-400 shrink-0">
                  {file.type === 'pdf' ? (
                    <FileText className="w-4 h-4 text-rose-400" />
                  ) : (
                    <File className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate text-xs text-white" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatSize(file.size)}
                    {file.pageCount ? ` • ${file.pageCount} p.` : ''}
                    {file.missing && (
                      <span className="ml-1 text-amber-400 font-semibold inline-flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-0.5 inline" /> Missing file
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(file.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition p-1"
                title="Remove file"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Extract Button */}
      <button
        onClick={onExtractAll}
        disabled={isExtracting || files.length === 0}
        className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 shadow-lg transition ${
          isExtracting || files.length === 0
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-cyan-900/30'
        }`}
      >
        <Zap className="w-4 h-4" />
        <span>{isExtracting ? 'Extracting Text...' : 'Extract All to Editor'}</span>
      </button>

      {/* Document Stats & Ingestion Settings */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2 text-slate-400">
        <div className="flex items-center justify-between text-slate-300 font-medium text-[11px] pb-1 border-b border-slate-800">
          <span className="flex items-center space-x-1">
            <Sliders className="w-3 h-3 text-cyan-400" />
            <span>Document Overview</span>
          </span>
          <span className="text-emerald-400 flex items-center text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <Hash className="w-3 h-3 text-slate-500" />
            <span>Words: <strong className="text-white">{wordCount.toLocaleString()}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Est. Audio: <strong className="text-cyan-400">{estDuration}</strong></span>
          </div>
        </div>

        <div className="pt-2 text-[10px] text-slate-500 space-y-1">
          <p>✓ Strip headers & footers</p>
          <p>✓ Unhyphenate broken line wraps</p>
          <p>✓ Auto-detect document encoding</p>
        </div>
      </div>
    </div>
  );
};
