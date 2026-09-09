import React, { useState } from 'react';
import { X, FolderKanban, Plus, Play, Trash2, Clock, FileText, AlertTriangle, Check, Save, HardDrive, FolderOpen } from 'lucide-react';
import { ProjectData } from '../types';
import { DesktopBridge } from '../services/desktopBridge';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: ProjectData;
  projectsList: ProjectData[];
  onSelectProject: (project: ProjectData) => void;
  onNewProject: () => void;
  onSaveCurrentAs: (newTitle: string) => void;
  onDeleteProject: (id: string) => void;
  onResumePlayback: () => void;
  onOpenStorageSettings: () => void;
}


export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  projectsList,
  onSelectProject,
  onNewProject,
  onSaveCurrentAs,
  onDeleteProject,
  onResumePlayback,
  onOpenStorageSettings,
}) => {
  const [saveAsName, setSaveAsName] = useState('');
  const [isSavingAs, setIsSavingAs] = useState(false);

  if (!isOpen) return null;

  const handleSaveAsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saveAsName.trim()) {
      onSaveCurrentAs(saveAsName.trim());
      setSaveAsName('');
      setIsSavingAs(false);
    }
  };

  const formatSec = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none">
          <div className="flex items-center space-x-2">
            <FolderKanban className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Projects & Reading Memory</h3>
              <p className="text-[11px] text-slate-400">
                Auto-saved sessions • Resume listening exactly where you stopped
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenStorageSettings}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
              title="Change disk storage folder & inspect files"
            >
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Storage Folder</span>
            </button>

            <button
              onClick={onNewProject}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
          {/* Active Session Card */}
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-400/80 shadow-[0_0_15px_rgba(56,189,248,0.15)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white truncate max-w-xs">
                  CURRENT: {currentProject.title}
                </span>
                {DesktopBridge.isDesktop() && (
                  <button
                    onClick={() => DesktopBridge.openStorageFolder(`projects/${currentProject.id}`)}
                    className="p-1 rounded hover:bg-cyan-900/60 text-cyan-300 transition"
                    title="Open this project's folder in Windows File Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {currentProject.playbackMemory.currentTime > 0 && (
                <button
                  onClick={() => {
                    onResumePlayback();
                    onClose();
                  }}
                  className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 text-xs font-semibold flex items-center space-x-1 shadow transition"
                >
                  <Play className="w-3 h-3 fill-slate-950" />
                  <span>Resume ({formatSec(currentProject.playbackMemory.currentTime)})</span>
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>
                  Progress: {Math.round(currentProject.playbackMemory.percentCompleted || 0)}%
                  {currentProject.playbackMemory.activeCueIndex
                    ? ` • Line ${currentProject.playbackMemory.activeCueIndex + 1}/${currentProject.cues.length}`
                    : ''}
                </span>
                <span>
                  {formatSec(currentProject.playbackMemory.currentTime)} / {formatSec(currentProject.playbackMemory.duration)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${currentProject.playbackMemory.percentCompleted || 0}%` }}
                />
              </div>
            </div>

            {/* Sources files & Disk status */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">
                Sources: {currentProject.fileRefs.length > 0
                  ? currentProject.fileRefs.map((f) => f.name).join(', ')
                  : 'Pasted / Direct Input'}
              </span>
              {currentProject.audioUrl && (
                <span className="text-emerald-400 font-medium text-[10px] shrink-0 ml-2">
                  ✓ MP3 Ready (Disk Saved)
                </span>
              )}
            </div>
          </div>

          {/* Section Divider */}
          <div className="text-[11px] font-semibold text-slate-400 px-1 pt-2 flex items-center justify-between">
            <span>Saved Projects Library</span>
            <span className="text-[10px] text-slate-500 font-mono">
              {projectsList.length} saved
            </span>
          </div>

          {/* Saved Projects List */}
          {projectsList.map((project) => {
            const isCurrent = project.id === currentProject.id;
            const hasMissingFiles = project.fileRefs.some((f) => f.missing);
            const hasDiskAudio = (project as any).hasDiskAudio || !!project.audioUrl;

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between group ${
                  isCurrent
                    ? 'bg-slate-900 border-cyan-500/50'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0 pr-3 space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white text-xs truncate">
                      {project.title}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 text-[10px]">
                        Active
                      </span>
                    )}
                    {hasDiskAudio && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                        MP3 on Disk
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-[10px] text-slate-400">
                    <span>
                      Progress: {Math.round(project.playbackMemory.percentCompleted || 0)}% (
                      {formatSec(project.playbackMemory.currentTime)} / {formatSec(project.playbackMemory.duration)})
                    </span>
                    <span>•</span>
                    <span>{project.voiceSettings.voiceId.split('-')[2] || 'Voice'}</span>
                    <span>•</span>
                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Sources info */}
                  <div className="text-[10px] text-slate-500 truncate">
                    {hasMissingFiles ? (
                      <span className="text-amber-400 flex items-center font-medium">
                        <AlertTriangle className="w-3 h-3 mr-1 inline shrink-0" />
                        Source file moved or missing — text & audio preserved on disk
                      </span>
                    ) : (
                      <span>
                        Files: {project.fileRefs.length > 0 ? project.fileRefs.map((f) => f.name).join(', ') : 'Direct input'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {DesktopBridge.isDesktop() && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        DesktopBridge.openStorageFolder(`projects/${project.id}`);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                      title="Open project folder and MP3 files in Windows Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(project);
                      onClose();
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition text-xs font-medium"
                  >
                    Open
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(project.id);
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition opacity-0 group-hover:opacity-100"
                    title="Delete project from disk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-2 select-none">
          {isSavingAs ? (
            <form onSubmit={handleSaveAsSubmit} className="flex items-center space-x-2">
              <input
                type="text"
                autoFocus
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                placeholder="Enter project name..."
                className="flex-1 px-3 py-1.5 bg-slate-900 border border-cyan-400/80 rounded-lg text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-semibold"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSavingAs(false)}
                className="px-2 py-1.5 text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Auto-Save Active (Local Memory)</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsSavingAs(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Save Project As...</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
