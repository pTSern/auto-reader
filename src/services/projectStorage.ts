import { get, set, del, keys } from 'idb-keyval';
import { ProjectData, FileReference } from '../types';
import { DesktopBridge, dataUriToBlob } from './desktopBridge';
import { Logger } from './logger';

const LAST_ACTIVE_PROJECT_KEY = 'voiceflow_last_active_id';
const PROJECT_PREFIX = 'voiceflow_proj_';

export async function saveProject(project: ProjectData): Promise<void> {
  project.updatedAt = Date.now();
  
  // 1. Save to IndexedDB
  await set(`${PROJECT_PREFIX}${project.id}`, project);
  await set(LAST_ACTIVE_PROJECT_KEY, project.id);

  // 2. If running in native desktop, persist directly to disk JSON and MP3
  if (DesktopBridge.isDesktop()) {
    try {
      await DesktopBridge.saveProjectToDisk(project);

      // If audioBlob exists, save combined.mp3 to disk folder
      if (project.audioBlob) {
        await DesktopBridge.saveCombinedAudio(project.id, project.audioBlob);
      }
    } catch (e) {
      Logger.warn('Failed to persist project to disk:', e);
    }
  }
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  let data: ProjectData | null = null;

  // Try loading from native disk first if on desktop
  if (DesktopBridge.isDesktop()) {
    try {
      const diskProj = await DesktopBridge.loadProjectFromDisk(id);
      if (diskProj) {
        data = diskProj as ProjectData;
        // If disk has audio base64, restore Blob and object URL
        if (diskProj.diskAudioBase64) {
          const blob = await dataUriToBlob(diskProj.diskAudioBase64);
          data.audioBlob = blob;
          data.audioUrl = URL.createObjectURL(blob);
          Logger.info(`Restored cached MP3 audio from disk for project "${data.title}"`);
        }
      }
    } catch (e) {
      Logger.warn(`Disk load failed for ${id}, falling back to IndexedDB:`, e);
    }
  }

  // Fallback to IndexedDB
  if (!data) {
    data = await get<ProjectData>(`${PROJECT_PREFIX}${id}`) || null;
  }

  if (!data) return null;

  // Re-create object URL from audio Blob if available
  if (data.audioBlob && !data.audioUrl) {
    data.audioUrl = URL.createObjectURL(data.audioBlob);
  }

  // Validate file references existence flags
  if (data.fileRefs) {
    data.fileRefs = data.fileRefs.map((ref) => {
      return {
        ...ref,
        missing: ref.path ? false : (ref.missing ?? false),
      };
    });
  }

  // Ensure shadow settings exist
  if (!data.shadowSettings) {
    data.shadowSettings = {
      enabled: true,
      chunkSizeWords: 500,
      concurrencyMode: 'auto',
    };
  }

  return data;
}

export async function getLastActiveProject(): Promise<ProjectData | null> {
  const lastId = await get<string>(LAST_ACTIVE_PROJECT_KEY);
  if (lastId) {
    const proj = await loadProject(lastId);
    if (proj) return proj;
  }

  // If no last active id, try to get the most recently updated project
  const allProjects = await getAllProjects();
  if (allProjects.length > 0) {
    allProjects.sort((a, b) => b.updatedAt - a.updatedAt);
    return allProjects[0];
  }

  return null;
}

export async function getAllProjects(): Promise<ProjectData[]> {
  const projectMap = new Map<string, ProjectData>();

  // 1. Fetch from native disk if desktop
  if (DesktopBridge.isDesktop()) {
    try {
      const diskProjects = await DesktopBridge.loadAllProjectsFromDisk();
      for (const p of diskProjects) {
        if (!p.shadowSettings) {
          p.shadowSettings = {
            enabled: true,
            chunkSizeWords: 500,
            concurrencyMode: 'auto',
          };
        }
        projectMap.set(p.id, p);
      }
    } catch (e) {
      Logger.warn('Failed to load projects from disk:', e);
    }
  }

  // 2. Fetch from IndexedDB and merge
  const allKeys = await keys();
  const projectKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(PROJECT_PREFIX)
  );

  for (const k of projectKeys) {
    const p = await get<ProjectData>(k);
    if (p) {
      if (p.audioBlob && !p.audioUrl) {
        p.audioUrl = URL.createObjectURL(p.audioBlob);
      }
      if (!p.shadowSettings) {
        p.shadowSettings = {
          enabled: true,
          chunkSizeWords: 500,
          concurrencyMode: 'auto',
        };
      }
      // If not already in map from disk or newer, save
      if (!projectMap.has(p.id) || p.updatedAt > (projectMap.get(p.id)?.updatedAt || 0)) {
        projectMap.set(p.id, p);
      }
    }
  }

  const projects = Array.from(projectMap.values());
  projects.sort((a, b) => b.updatedAt - a.updatedAt);
  return projects;
}

export async function deleteProject(id: string): Promise<void> {
  await del(`${PROJECT_PREFIX}${id}`);
  const lastId = await get<string>(LAST_ACTIVE_PROJECT_KEY);
  if (lastId === id) {
    await del(LAST_ACTIVE_PROJECT_KEY);
  }

  if (DesktopBridge.isDesktop()) {
    try {
      await DesktopBridge.deleteProjectFromDisk(id);
    } catch (e) {
      Logger.warn('Failed to delete project from disk:', e);
    }
  }
}


export function createDefaultProject(): ProjectData {
  return {
    id: 'proj_' + Math.random().toString(36).substring(2, 9),
    title: 'Untitled Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    textContent: '',
    fileRefs: [],
    voiceSettings: {
      voiceId: 'en-US-JennyNeural',
      rate: 0,
      pitch: 0,
      volume: 100,
    },
    shadowSettings: {
      enabled: true,
      chunkSizeWords: 500,
      concurrencyMode: 'auto',
    },
    cues: [],
    playbackMemory: {
      currentTime: 0,
      duration: 0,
      activeCueIndex: 0,
      percentCompleted: 0,
    },
  };
}

