import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  File,
  Trash2,
  Zap,
  CheckCircle2,
  X,
  FileUp,
  Clock,
  Hash,
  BookOpen,
} from 'lucide-react';
import { FileReference } from '../types';
import { extractTextFromPdf, extractTextFromTextFile } from '../services/pdfExtractor';

interface MobileFileIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileReference[];
  onAddFiles: (newFiles: FileReference[]) => void;
  onRemoveFile: (id: string) => void;
  onExtractAll: () => void;
  isExtracting: boolean;
  wordCount: number;
  charCount: number;
  estDuration: string;
}

export const MobileFileIngestModal: React.FC<MobileFileIngestModalProps> = ({
  isOpen,
  onClose,
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
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  if (!isOpen) return null;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessingFiles(true);
    const newRefs: FileReference[] = [];

    try {
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
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>Source Files & Ingestion</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-cyan-300 font-mono">
                  {files.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Upload PDF / TXT documents to extract speech text
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

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
          multiple
          accept=".pdf,.txt,.md,.markdown,.log,.csv"
          className="hidden"
        />

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-300 overflow-y-auto flex-1 custom-scrollbar">
          {/* Upload Dropzone / Button */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-5 rounded-xl border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/10 hover:bg-cyan-950/25 flex flex-col items-center justify-center text-center cursor-pointer transition group shadow-inner"
          >
            <div className="p-3 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 group-hover:scale-110 group-hover:text-cyan-300 transition mb-2">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">
              {isProcessingFiles ? 'Reading Document Files...' : 'Tap to Upload PDF / TXT'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Select files from your device storage or Google Drive
            </p>
          </div>

          {/* Files List */}
          {files.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                <span>Attached Documents ({files.length})</span>
                <span>Ready for text extraction</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 flex items-center justify-between group transition"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 shrink-0">
                        {file.type === 'pdf' ? (
                          <FileText className="w-4 h-4 text-rose-400" />
                        ) : (
                          <File className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-xs truncate" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{formatSize(file.size)}</span>
                          {file.pageCount && <span>&bull; {file.pageCount} Pages</span>}
                          <span className="text-emerald-400 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-0.5 inline" />
                            Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveFile(file.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition shrink-0"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Extract Text Action Button */}
              <button
                onClick={() => {
                  onExtractAll();
                  onClose();
                }}
                disabled={isExtracting}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-950/40 transition active:scale-[0.99] disabled:opacity-50"
              >
                <Zap className="w-4 h-4 text-yellow-300" />
                <span>{isExtracting ? 'Extracting Text...' : '⚡ Extract All Text to Editor'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center text-slate-400 text-xs">
              <p className="font-medium text-slate-300 mb-1">No source files uploaded yet</p>
              <p className="text-[11px]">
                Upload PDF books, articles, or notes above to automatically extract and format their speech text.
              </p>
            </div>
          )}

          {/* Document Ingestion Stats */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
            <span className="text-[11px] font-semibold text-white flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Document Statistics</span>
            </span>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Words</span>
                <span className="font-bold text-white font-mono text-xs">{wordCount.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Characters</span>
                <span className="font-bold text-white font-mono text-xs">{charCount.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Est. Time</span>
                <span className="font-bold text-cyan-400 font-mono text-xs">{estDuration || '0m 00s'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/80 select-none shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition border border-slate-700"
          >
            + Add Another File
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
