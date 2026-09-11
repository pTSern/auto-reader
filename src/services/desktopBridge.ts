import { TimedCue, VoiceModel, VoiceTrackStatus } from '../types';

export interface StorageInfo {
  storage_dir: string;
  exists: boolean;
  project_count: number;
  total_size_mb: number;
  projects?: any[];
}

export interface VoiceTrackParams {
  voiceId?: string;
  voiceLocale?: string;
  voiceGender?: string;
  voiceName?: string;
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        set_mini_mode: (mini: boolean, is_swift?: boolean) => Promise<boolean>;
        resize_window?: (width: number, height: number) => Promise<boolean>;
        set_pinned: (pinned: boolean) => Promise<boolean>;
        drag_window: () => Promise<void>;
        minimize?: () => Promise<boolean>;
        toggle_maximize?: () => Promise<boolean>;
        close?: () => Promise<boolean>;
        write_log?: (level: string, message: string) => Promise<boolean>;
        get_storage_info?: () => Promise<StorageInfo>;
        set_storage_dir?: (newDir: string) => Promise<StorageInfo>;
        scan_storage_projects?: (path?: string) => Promise<any[]>;
        browse_storage_folder?: () => Promise<string | null>;
        open_storage_folder?: (subfolder?: string) => Promise<boolean>;
        save_project_to_disk?: (projectData: any) => Promise<boolean>;
        update_project_playback_memory?: (projectId: string, memory: any) => Promise<boolean>;
        load_all_projects_from_disk?: () => Promise<any[]>;
        load_project_from_disk?: (projectId: string) => Promise<any | null>;
        save_chunk_audio?: (
          projectId: string,
          chunkId: number,
          base64Data: string,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string,
          cues?: any[],
          duration?: number
        ) => Promise<boolean>;
        save_combined_audio?: (
          projectId: string,
          base64Data: string,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string
        ) => Promise<boolean>;
        check_chunk_cache?: (
          projectId: string,
          chunkId: number,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string
        ) => Promise<boolean>;
        get_chunk_audio?: (
          projectId: string,
          chunkId: number,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string
        ) => Promise<string | null>;
        get_chunk_audio_url?: (
          projectId: string,
          chunkId: number,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string
        ) => Promise<string | null>;
        get_chunk_cues?: (
          projectId: string,
          chunkId: number,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string
        ) => Promise<{ cues: any[] | null; duration: number } | null>;
        get_combined_audio_url?: (
          projectId: string,
          voiceId?: string,
          voiceLocale?: string,
          voiceGender?: string,
          voiceName?: string
        ) => Promise<string | null>;
        get_project_voice_statuses?: (projectId: string) => Promise<Record<string, VoiceTrackStatus>>;
        delete_project_from_disk?: (projectId: string) => Promise<boolean>;
        synthesize_edge_tts?: (
          text: string,
          voice: string,
          rate: number,
          pitch: number,
          volume: number
        ) => Promise<{
          success: boolean;
          base64Audio?: string;
          cues?: any[];
          duration?: number;
          byteLength?: number;
          error?: string;
        }>;
        cleanup_project_audio?: (projectId: string, voiceSubpath?: string) => Promise<{ success: boolean; freed_mb: number; deleted_count: number }>;
        get_project_audio_size?: (projectId: string, voiceSubpath?: string) => Promise<{ size_mb: number; file_count: number }>;
      };
    };
  }
}

export const DesktopBridge = {
  isDesktop(): boolean {
    return typeof window !== 'undefined' && !!window.pywebview;
  },

  async ensureReady(timeoutMs: number = 2500): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (window.pywebview?.api) return true;

    return new Promise((resolve) => {
      let resolved = false;

      const finish = (ready: boolean) => {
        if (resolved) return;
        resolved = true;
        window.removeEventListener('pywebviewready', onReady);
        clearInterval(interval);
        clearTimeout(timer);
        resolve(ready);
      };

      const onReady = () => finish(true);
      window.addEventListener('pywebviewready', onReady);

      const interval = setInterval(() => {
        if (window.pywebview?.api) {
          finish(true);
        }
      }, 25);

      const timer = setTimeout(() => {
        finish(!!window.pywebview?.api);
      }, timeoutMs);
    });
  },

  async setMiniMode(isMini: boolean, isSwift: boolean = false): Promise<boolean> {
    if (window.pywebview?.api?.set_mini_mode) {
      try {
        return await window.pywebview.api.set_mini_mode(isMini, isSwift);
      } catch (e) {
        console.warn('Failed to call set_mini_mode', e);
      }
    }
    return false;
  },

  async resizeWindow(width: number, height: number): Promise<boolean> {
    if (window.pywebview?.api?.resize_window) {
      try {
        return await window.pywebview.api.resize_window(width, height);
      } catch (e) {
        console.warn('Failed to call resize_window', e);
      }
    }
    return false;
  },

  async setAlwaysOnTop(isPinned: boolean): Promise<boolean> {
    if (window.pywebview?.api?.set_pinned) {
      try {
        return await window.pywebview.api.set_pinned(isPinned);
      } catch (e) {
        console.warn('Failed to call set_pinned', e);
      }
    }
    return false;
  },

  async minimize(): Promise<boolean> {
    if (window.pywebview?.api?.minimize) {
      try {
        return await window.pywebview.api.minimize();
      } catch (e) {
        console.warn('Failed to minimize', e);
      }
    }
    return false;
  },

  async toggleMaximize(): Promise<boolean> {
    if (window.pywebview?.api?.toggle_maximize) {
      try {
        return await window.pywebview.api.toggle_maximize();
      } catch (e) {
        console.warn('Failed to toggle maximize', e);
      }
    }
    return false;
  },

  async close(): Promise<boolean> {
    if (window.pywebview?.api?.close) {
      try {
        return await window.pywebview.api.close();
      } catch (e) {
        console.warn('Failed to close', e);
      }
    }
    return false;
  },

  // Storage and Disk APIs
  async getStorageInfo(): Promise<StorageInfo | null> {
    if (window.pywebview?.api?.get_storage_info) {
      try {
        return await window.pywebview.api.get_storage_info();
      } catch (e) {
        console.warn('Failed to get storage info', e);
      }
    }
    return null;
  },

  async setStorageDir(newDir: string): Promise<StorageInfo | null> {
    if (window.pywebview?.api?.set_storage_dir) {
      try {
        return await window.pywebview.api.set_storage_dir(newDir);
      } catch (e) {
        console.warn('Failed to set storage dir', e);
      }
    }
    return null;
  },

  async scanStorageProjects(path?: string): Promise<any[]> {
    if (window.pywebview?.api?.scan_storage_projects) {
      try {
        return await window.pywebview.api.scan_storage_projects(path);
      } catch (e) {
        console.warn('Failed to scan storage projects', e);
      }
    }
    return [];
  },

  async browseStorageFolder(): Promise<string | null> {
    if (window.pywebview?.api?.browse_storage_folder) {
      try {
        return await window.pywebview.api.browse_storage_folder();
      } catch (e) {
        console.warn('Failed to browse storage folder', e);
      }
    }
    return null;
  },

  async openStorageFolder(subfolder: string = ''): Promise<boolean> {
    if (window.pywebview?.api?.open_storage_folder) {
      try {
        return await window.pywebview.api.open_storage_folder(subfolder);
      } catch (e) {
        console.warn('Failed to open storage folder', e);
      }
    }
    return false;
  },

  async saveProjectToDisk(projectData: any): Promise<boolean> {
    if (window.pywebview?.api?.save_project_to_disk) {
      try {
        return await window.pywebview.api.save_project_to_disk(projectData);
      } catch (e) {
        console.warn('Failed to save project to disk', e);
      }
    }
    return false;
  },

  async updatePlaybackMemory(projectId: string, memory: any): Promise<boolean> {
    if (window.pywebview?.api?.update_project_playback_memory) {
      try {
        return await window.pywebview.api.update_project_playback_memory(projectId, memory);
      } catch (e) {
        console.warn('Failed to update playback memory on disk', e);
      }
    }
    return false;
  },

  async loadAllProjectsFromDisk(): Promise<any[]> {
    if (window.pywebview?.api?.load_all_projects_from_disk) {
      try {
        return await window.pywebview.api.load_all_projects_from_disk();
      } catch (e) {
        console.warn('Failed to load projects from disk', e);
      }
    }
    return [];
  },

  async loadProjectFromDisk(projectId: string): Promise<any | null> {
    if (window.pywebview?.api?.load_project_from_disk) {
      try {
        return await window.pywebview.api.load_project_from_disk(projectId);
      } catch (e) {
        console.warn('Failed to load project from disk', e);
      }
    }
    return null;
  },

  async saveChunkAudio(
    projectId: string,
    chunkId: number,
    blob: Blob,
    voice?: VoiceModel | VoiceTrackParams,
    cues?: TimedCue[],
    duration?: number
  ): Promise<boolean> {
    if (window.pywebview?.api?.save_chunk_audio) {
      try {
        const base64 = await blobToBase64(blob);
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        return await window.pywebview.api.save_chunk_audio(
          projectId,
          chunkId,
          base64,
          vId,
          vLoc,
          vGen,
          vName,
          cues,
          duration
        );
      } catch (e) {
        console.warn(`Failed to save chunk ${chunkId} audio to disk`, e);
      }
    }
    return false;
  },

  async getChunkCues(
    projectId: string,
    chunkId: number,
    voice?: VoiceModel | VoiceTrackParams
  ): Promise<{ cues: TimedCue[] | null; duration: number } | null> {
    if (window.pywebview?.api?.get_chunk_cues) {
      try {
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        return await window.pywebview.api.get_chunk_cues(projectId, chunkId, vId, vLoc, vGen, vName);
      } catch (e) {
        console.warn(`Failed to get chunk ${chunkId} cues from disk`, e);
      }
    }
    return null;
  },

  async saveCombinedAudio(projectId: string, blob: Blob, voice?: VoiceModel | VoiceTrackParams): Promise<boolean> {
    if (window.pywebview?.api?.save_combined_audio) {
      try {
        const base64 = await blobToBase64(blob);
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        return await window.pywebview.api.save_combined_audio(projectId, base64, vId, vLoc, vGen, vName);
      } catch (e) {
        console.warn('Failed to save combined audio to disk', e);
      }
    }
    return false;
  },

  async checkChunkCache(projectId: string, chunkId: number, voice?: VoiceModel | VoiceTrackParams): Promise<boolean> {
    if (window.pywebview?.api?.check_chunk_cache) {
      try {
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        return await window.pywebview.api.check_chunk_cache(projectId, chunkId, vId, vLoc, vGen, vName);
      } catch (e) {
        console.warn('Failed to check chunk cache', e);
      }
    }
    return false;
  },

  async getChunkAudio(projectId: string, chunkId: number, voice?: VoiceModel | VoiceTrackParams): Promise<Blob | null> {
    if (window.pywebview?.api?.get_chunk_audio) {
      try {
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        const dataUri = await window.pywebview.api.get_chunk_audio(projectId, chunkId, vId, vLoc, vGen, vName);
        if (dataUri) {
          return await dataUriToBlob(dataUri);
        }
      } catch (e) {
        console.warn('Failed to get chunk audio', e);
      }
    }
    return null;
  },

  async getChunkAudioUrl(projectId: string, chunkId: number, voice?: VoiceModel | VoiceTrackParams): Promise<string | null> {
    if (window.pywebview?.api?.get_chunk_audio_url) {
      try {
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        return await window.pywebview.api.get_chunk_audio_url(projectId, chunkId, vId, vLoc, vGen, vName);
      } catch (e) {
        console.warn('Failed to get chunk audio URL', e);
      }
    }
    return null;
  },

  async getCombinedAudioUrl(projectId: string, voice?: VoiceModel | VoiceTrackParams): Promise<string | null> {
    if (window.pywebview?.api?.get_combined_audio_url) {
      try {
        const [vId, vLoc, vGen, vName] = extractVoiceArgs(voice);
        return await window.pywebview.api.get_combined_audio_url(projectId, vId, vLoc, vGen, vName);
      } catch (e) {
        console.warn('Failed to get combined audio URL', e);
      }
    }
    return null;
  },

  async getProjectVoiceStatuses(projectId: string): Promise<Record<string, VoiceTrackStatus>> {
    if (window.pywebview?.api?.get_project_voice_statuses) {
      try {
        return (await window.pywebview.api.get_project_voice_statuses(projectId)) || {};
      } catch (e) {
        console.warn('Failed to get project voice statuses', e);
      }
    }
    return {};
  },

  async deleteProjectFromDisk(projectId: string): Promise<boolean> {
    if (window.pywebview?.api?.delete_project_from_disk) {
      try {
        return await window.pywebview.api.delete_project_from_disk(projectId);
      } catch (e) {
        console.warn('Failed to delete project from disk', e);
      }
    }
    return false;
  },

  async cleanupProjectAudio(
    projectId: string,
    voiceSubpath?: string
  ): Promise<{ success: boolean; freed_mb: number; deleted_count: number }> {
    if (window.pywebview?.api?.cleanup_project_audio) {
      try {
        return await window.pywebview.api.cleanup_project_audio(projectId, voiceSubpath);
      } catch (e) {
        console.warn('Failed to cleanup project audio via desktop bridge', e);
      }
    }
    return { success: false, freed_mb: 0, deleted_count: 0 };
  },

  async getProjectAudioSize(
    projectId: string,
    voiceSubpath?: string
  ): Promise<{ size_mb: number; file_count: number }> {
    if (window.pywebview?.api?.get_project_audio_size) {
      try {
        return await window.pywebview.api.get_project_audio_size(projectId, voiceSubpath);
      } catch (e) {
        console.warn('Failed to get project audio size via desktop bridge', e);
      }
    }
    return { size_mb: 0, file_count: 0 };
  },

  async synthesizeSpeech(
    text: string,
    voice: string = 'en-US-JennyNeural',
    rate: number = 0,
    pitch: number = 0,
    volume: number = 100
  ): Promise<{
    success: boolean;
    audioBlob?: Blob;
    audioUrl?: string;
    cues?: any[];
    duration?: number;
    error?: string;
  } | null> {
    if (window.pywebview?.api?.synthesize_edge_tts) {
      try {
        const res = await window.pywebview.api.synthesize_edge_tts(text, voice, rate, pitch, volume);
        if (res && res.success && res.base64Audio) {
          const blob = await dataUriToBlob(res.base64Audio);
          const audioUrl = URL.createObjectURL(blob);
          return {
            success: true,
            audioBlob: blob,
            audioUrl,
            cues: res.cues || [],
            duration: res.duration || 0,
          };
        } else if (res && !res.success) {
          return { success: false, error: res.error || 'Desktop synthesis failed' };
        }
      } catch (e: any) {
        console.warn('Failed to synthesize speech via desktop bridge', e);
        return { success: false, error: e.message || String(e) };
      }
    }
    return null;
  },

  startWindowDrag(): void {
    if (window.pywebview?.api?.drag_window) {
      window.pywebview.api.drag_window();
    }
  },
};

function extractVoiceArgs(
  voice?: VoiceModel | VoiceTrackParams
): [string | undefined, string | undefined, string | undefined, string | undefined] {
  if (!voice) return [undefined, undefined, undefined, undefined];
  if ('locale' in voice && 'name' in voice && 'gender' in voice) {
    return [voice.id, voice.locale, voice.gender, voice.name];
  }
  const vt = voice as VoiceTrackParams;
  return [vt.voiceId, vt.voiceLocale, vt.voiceGender, vt.voiceName];
}

/** Helper to convert Blob to base64 string */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Helper to convert base64 data URI to Blob */
export async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const res = await fetch(dataUri);
  return await res.blob();
}


