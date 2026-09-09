export interface StorageInfo {
  storage_dir: string;
  exists: boolean;
  project_count: number;
  total_size_mb: number;
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        set_mini_mode: (mini: boolean) => Promise<boolean>;
        set_pinned: (pinned: boolean) => Promise<boolean>;
        drag_window: () => Promise<void>;
        minimize?: () => Promise<boolean>;
        toggle_maximize?: () => Promise<boolean>;
        close?: () => Promise<boolean>;
        write_log?: (level: string, message: string) => Promise<boolean>;
        get_storage_info?: () => Promise<StorageInfo>;
        set_storage_dir?: (newDir: string) => Promise<StorageInfo>;
        browse_storage_folder?: () => Promise<string | null>;
        open_storage_folder?: (subfolder?: string) => Promise<boolean>;
        save_project_to_disk?: (projectData: any) => Promise<boolean>;
        load_all_projects_from_disk?: () => Promise<any[]>;
        load_project_from_disk?: (projectId: string) => Promise<any | null>;
        save_chunk_audio?: (projectId: string, chunkId: number, base64Data: string) => Promise<boolean>;
        save_combined_audio?: (projectId: string, base64Data: string) => Promise<boolean>;
        check_chunk_cache?: (projectId: string, chunkId: number) => Promise<boolean>;
        get_chunk_audio?: (projectId: string, chunkId: number) => Promise<string | null>;
        delete_project_from_disk?: (projectId: string) => Promise<boolean>;
      };
    };
  }
}

export const DesktopBridge = {
  isDesktop(): boolean {
    return typeof window !== 'undefined' && !!window.pywebview;
  },

  async setMiniMode(isMini: boolean): Promise<boolean> {
    if (window.pywebview?.api?.set_mini_mode) {
      try {
        return await window.pywebview.api.set_mini_mode(isMini);
      } catch (e) {
        console.warn('Failed to call set_mini_mode', e);
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

  async saveChunkAudio(projectId: string, chunkId: number, blob: Blob): Promise<boolean> {
    if (window.pywebview?.api?.save_chunk_audio) {
      try {
        const base64 = await blobToBase64(blob);
        return await window.pywebview.api.save_chunk_audio(projectId, chunkId, base64);
      } catch (e) {
        console.warn(`Failed to save chunk ${chunkId} audio to disk`, e);
      }
    }
    return false;
  },

  async saveCombinedAudio(projectId: string, blob: Blob): Promise<boolean> {
    if (window.pywebview?.api?.save_combined_audio) {
      try {
        const base64 = await blobToBase64(blob);
        return await window.pywebview.api.save_combined_audio(projectId, base64);
      } catch (e) {
        console.warn('Failed to save combined audio to disk', e);
      }
    }
    return false;
  },

  async checkChunkCache(projectId: string, chunkId: number): Promise<boolean> {
    if (window.pywebview?.api?.check_chunk_cache) {
      try {
        return await window.pywebview.api.check_chunk_cache(projectId, chunkId);
      } catch (e) {
        console.warn('Failed to check chunk cache', e);
      }
    }
    return false;
  },

  async getChunkAudio(projectId: string, chunkId: number): Promise<Blob | null> {
    if (window.pywebview?.api?.get_chunk_audio) {
      try {
        const dataUri = await window.pywebview.api.get_chunk_audio(projectId, chunkId);
        if (dataUri) {
          return await dataUriToBlob(dataUri);
        }
      } catch (e) {
        console.warn('Failed to get chunk audio', e);
      }
    }
    return null;
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

  startWindowDrag(): void {
    if (window.pywebview?.api?.drag_window) {
      window.pywebview.api.drag_window();
    }
  },
};

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


