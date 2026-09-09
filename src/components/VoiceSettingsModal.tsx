import React, { useState } from 'react';
import { X, Search, Globe, Check, Play, Square, Mic, Sparkles } from 'lucide-react';
import { VoiceModel, VoiceTrackStatus } from '../types';
import { VOICES_CATALOG, AVAILABLE_LANGUAGES, filterVoices, getVoiceFolderSubpath } from '../services/voicesCatalog';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoice: VoiceModel;
  onSelectVoice: (voice: VoiceModel) => void;
  voiceStatuses?: Record<string, VoiceTrackStatus>;
  totalChunks?: number;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  selectedVoice,
  onSelectVoice,
  voiceStatuses = {},
  totalChunks = 0,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Female' | 'Male'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [audioPreviewObj, setAudioPreviewObj] = useState<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const voices = filterVoices(selectedLanguage, selectedGender, searchQuery);

  const handleTestPreview = (voice: VoiceModel, e: React.MouseEvent) => {
    e.stopPropagation();

    // Stop current audio if playing
    if (audioPreviewObj) {
      audioPreviewObj.pause();
      setAudioPreviewObj(null);
    }

    if (previewingVoiceId === voice.id) {
      setPreviewingVoiceId(null);
      return;
    }

    setPreviewingVoiceId(voice.id);

    // Test text sample in the voice's language
    let sampleText = `Hello, I am ${voice.name}, a natural neural voice from Microsoft Edge.`;
    if (voice.language === 'Vietnamese') {
      sampleText = `Xin chào, tôi là ${voice.name}, giọng đọc truyền cảm tự nhiên của Microsoft.`;
    } else if (voice.language === 'Spanish') {
      sampleText = `Hola, soy ${voice.name}, una voz neuronal de Microsoft Edge.`;
    } else if (voice.language === 'French') {
      sampleText = `Bonjour, je suis ${voice.name}, une voix neuronale naturelle.`;
    }

    // Use browser speech synthesis API for instant latency-free preview
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.lang = voice.locale;
      utterance.onend = () => setPreviewingVoiceId(null);
      utterance.onerror = () => setPreviewingVoiceId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setPreviewingVoiceId(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 select-none">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Select Speech Voice</h3>
              <p className="text-[11px] text-slate-400">
                Filter by language, dialect, and neural voice model
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 space-y-3 select-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Language Select Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400 flex items-center space-x-1">
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>Select Language:</span>
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-cyan-400 transition"
              >
                <option value="All">All Languages ({VOICES_CATALOG.length} voices)</option>
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter Pills */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-400">
                Gender:
              </label>
              <div className="flex items-center space-x-1.5 pt-0.5">
                {(['All', 'Female', 'Male'] as const).map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setSelectedGender(gender)}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition ${
                      selectedGender === gender
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by voice name (e.g. "Jenny", "Guy", "Sonia") or region...'
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-400 transition"
            />
          </div>
        </div>

        {/* Voices List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar">
          {voices.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No voices found matching filters.
            </div>
          ) : (
            voices.map((voice) => {
              const isSelected = selectedVoice.id === voice.id;
              const isPreviewing = previewingVoiceId === voice.id;
              const subpath = getVoiceFolderSubpath(voice);
              const status = voiceStatuses[subpath] || voiceStatuses[voice.id];

              return (
                <div
                  key={voice.id}
                  onClick={() => onSelectVoice(voice)}
                  className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <span className="text-xl shrink-0">{voice.flag}</span>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-semibold text-white text-xs">
                          {voice.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                          {voice.gender}
                        </span>
                        {/* Multi-Voice Status Tag */}
                        {status?.hasCombined ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center space-x-1 shadow-sm">
                            <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-400" />
                            <span>Generated</span>
                          </span>
                        ) : status && status.chunkCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-300 text-[10px] font-medium flex items-center space-x-1 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-400" />
                            <span>
                              {totalChunks > 0
                                ? `${Math.round((status.chunkCount / totalChunks) * 100)}% (${status.chunkCount}/${totalChunks})`
                                : `${status.chunkCount} chunks`}
                            </span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 text-[10px]">
                            Not Generated
                          </span>
                        )}
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 text-[10px] font-medium flex items-center space-x-1">
                            <Check className="w-2.5 h-2.5 mr-0.5" /> Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-cyan-400 truncate mt-0.5">
                        {voice.id}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {voice.personality || `${voice.language} (${voice.region})`}
                      </p>
                    </div>
                  </div>

                  {/* Preview Button */}
                  <button
                    onClick={(e) => handleTestPreview(voice, e)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center space-x-1 transition shrink-0 ${
                      isPreviewing
                        ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                    title="Play voice audio sample"
                  >
                    {isPreviewing ? (
                      <>
                        <Square className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-slate-300 text-slate-300" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between select-none">
          <div className="text-xs text-slate-400 truncate pr-2">
            Active: <strong className="text-cyan-400 font-medium">{selectedVoice.name}</strong> ({selectedVoice.id})
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-cyan-900/40 transition"
            >
              Apply Voice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
