import os
import re
import sys
import json
import base64
import shutil
import asyncio
import ctypes
import time
from ctypes import wintypes
from datetime import datetime
import webview
import edge_tts
from media_server import start_media_server, MEDIA_PORT

HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE_PATH = os.path.join(BASE_DIR, "app.log")
CONFIG_FILE_PATH = os.path.join(BASE_DIR, "config.json")
DEFAULT_STORAGE_DIR = os.path.join(BASE_DIR, "projects_data")

_MEDIA_SERVER_STARTED = False

class DesktopApi:
    def __init__(self, window=None):
        # Internal private attributes (prefixed with _ so pywebview ignores them during JS bridge introspection)
        # Prevents circular reference inspection and 'RecursionError: maximum recursion depth exceeded / queue.Empty' storms
        self._window = window
        self._is_maximized = False
        self._media_port = MEDIA_PORT
        self._init_logfile()
        self._init_config()
        self._init_media_server()

    def set_window(self, window):
        """Safely assigns window reference without exposing it as a public JS bridge property"""
        self._window = window

    @property
    def media_port(self) -> int:
        """Returns the media server port"""
        return self._media_port

    def get_media_port(self) -> int:
        """Returns the media server port for JS/IPC callers"""
        return self._media_port

    def _init_media_server(self):
        global _MEDIA_SERVER_STARTED
        if not _MEDIA_SERVER_STARTED:
            try:
                srv = start_media_server(self.get_storage_dir, port=self._media_port)
                if srv:
                    _MEDIA_SERVER_STARTED = True
                    self.write_log("info", f"Media streaming server listening on http://127.0.0.1:{self._media_port}")
                else:
                    self.write_log("warn", f"Media server could not bind to port {self._media_port} (may already be running)")
            except Exception as e:
                self.write_log("error", f"Could not start media server: {e}")

    def _init_logfile(self):
        try:
            with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
                f.write(f"\n--- [VoiceFlow Studio Desktop Session Started: {datetime.now().isoformat()}] ---\n")
        except Exception as e:
            print(f"Log init error: {e}")

    def _init_config(self):
        """Loads or initializes config.json with current storage directory"""
        try:
            if not os.path.exists(CONFIG_FILE_PATH):
                config = {"storage_dir": DEFAULT_STORAGE_DIR}
                with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                    json.dump(config, f, indent=2)
            os.makedirs(self.get_storage_dir(), exist_ok=True)
            os.makedirs(os.path.join(self.get_storage_dir(), "projects"), exist_ok=True)
        except Exception as e:
            print(f"Config init error: {e}")

    def write_log(self, level: str, message: str) -> bool:
        """Appends log entry directly to app.log file on disk"""
        try:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            line = f"[{ts}] [{level.upper()}] {message}\n"
            with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
                f.write(line)
            return True
        except Exception as e:
            print(f"File log error: {e}")
            return False

    # ------------------ DISK STORAGE & FOLDER CONFIG ------------------

    def get_storage_dir(self) -> str:
        """Returns the configured project storage directory path"""
        try:
            if os.path.exists(CONFIG_FILE_PATH):
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    return cfg.get("storage_dir", DEFAULT_STORAGE_DIR)
        except Exception as e:
            print(f"Read config error: {e}")
        return DEFAULT_STORAGE_DIR

    def get_storage_info(self) -> dict:
        """Returns storage folder status, disk path, project count and total size in MB"""
        s_dir = self.get_storage_dir()
        projects_dir = os.path.join(s_dir, "projects")
        os.makedirs(projects_dir, exist_ok=True)

        project_count = 0
        total_bytes = 0
        try:
            for root, dirs, files in os.walk(projects_dir):
                for f in files:
                    fp = os.path.join(root, f)
                    total_bytes += os.path.getsize(fp)
            project_count = len([d for d in os.listdir(projects_dir) if os.path.isdir(os.path.join(projects_dir, d))])
        except Exception as e:
            print(f"Storage info error: {e}")

        return {
            "storage_dir": s_dir,
            "exists": os.path.exists(s_dir),
            "project_count": project_count,
            "total_size_mb": round(total_bytes / (1024 * 1024), 2)
        }

    def set_storage_dir(self, new_dir: str) -> dict:
        """Updates storage directory in config.json and migrates or ensures folder exists"""
        try:
            if not new_dir or not os.path.isabs(new_dir):
                return self.get_storage_info()
            os.makedirs(new_dir, exist_ok=True)
            os.makedirs(os.path.join(new_dir, "projects"), exist_ok=True)

            config = {"storage_dir": new_dir}
            with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)

            self.write_log("info", f"Project storage directory changed to: {new_dir}")
            return self.get_storage_info()
        except Exception as e:
            self.write_log("error", f"Failed to set storage directory: {e}")
            return self.get_storage_info()

    def browse_storage_folder(self) -> str | None:
        """Opens native Windows folder picker dialog for user to select storage destination"""
        try:
            if not self._window:
                return None
            current = self.get_storage_dir()
            # Dialog returns list of chosen paths
            chosen = self._window.create_file_dialog(webview.FileDialog.FOLDER, directory=current)
            if chosen and len(chosen) > 0:
                selected_path = chosen[0]
                self.set_storage_dir(selected_path)
                return selected_path
        except Exception as e:
            self.write_log("error", f"Folder dialog error: {e}")
        return None

    def open_storage_folder(self, subfolder: str = "") -> bool:
        """Opens the storage folder (or a project subfolder) directly in Windows Explorer"""
        try:
            target = os.path.join(self.get_storage_dir(), subfolder)
            os.makedirs(target, exist_ok=True)
            os.startfile(target)
            return True
        except Exception as e:
            self.write_log("error", f"Open in explorer error: {e}")
            return False

    # ------------------ PROJECT & AUDIO DISK PERSISTENCE ------------------

    def save_project_to_disk(self, project_data) -> bool:
        """Saves project metadata and text to <storage_dir>/projects/<project_id>/project.json"""
        try:
            if isinstance(project_data, str):
                data = json.loads(project_data)
            else:
                data = project_data

            pid = data.get("id")
            if not pid:
                return False

            p_dir = os.path.join(self.get_storage_dir(), "projects", pid)
            os.makedirs(p_dir, exist_ok=True)
            os.makedirs(os.path.join(p_dir, "chunks"), exist_ok=True)

            # Strip bulky blob or large temp URLs from json file
            to_save = dict(data)
            to_save["audioBlob"] = None
            to_save["audioUrl"] = None

            json_path = os.path.join(p_dir, "project.json")
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(to_save, f, ensure_ascii=False, indent=2)

            self.write_log("info", f"Saved project '{to_save.get('title')}' ({pid}) to disk at {json_path}")
            return True
        except Exception as e:
            self.write_log("error", f"Error saving project to disk: {e}")
            return False

    def update_project_playback_memory(self, project_id: str, memory: dict) -> bool:
        """Lightweight and atomic: Updates only the playbackMemory field in project.json on disk"""
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id)
            json_path = os.path.join(p_dir, "project.json")
            if not os.path.exists(json_path):
                return False

            with open(json_path, "r", encoding="utf-8") as f:
                p_data = json.load(f)

            p_data["playbackMemory"] = memory
            p_data["updatedAt"] = int(time.time() * 1000)

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(p_data, f, ensure_ascii=False, indent=2)

            return True
        except Exception as e:
            self.write_log("error", f"Error updating playback memory on disk: {e}")
            return False

    def load_all_projects_from_disk(self) -> list:
        """Loads list of all projects found on disk"""
        projects = []
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects")
            if not os.path.exists(p_dir):
                return []

            for folder in os.listdir(p_dir):
                fp = os.path.join(p_dir, folder, "project.json")
                if os.path.isfile(fp):
                    try:
                        with open(fp, "r", encoding="utf-8") as f:
                            p_data = json.load(f)
                            proj_path = os.path.join(p_dir, folder)

                            # Check if combined audio exists directly
                            mp3_path = os.path.join(proj_path, "combined.mp3")
                            has_combined = os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0
                            if has_combined:
                                mtime = int(os.path.getmtime(mp3_path))
                                p_data["audioHttpUrl"] = f"http://127.0.0.1:{self._media_port}/projects/{folder}/combined.mp3?t={mtime}"

                            # Also check voice subpaths and chunk files
                            total_chunks = 0
                            for root, _, files in os.walk(proj_path):
                                for fl in files:
                                    if fl.endswith(".mp3"):
                                        total_chunks += 1
                                        if not has_combined and fl == "combined.mp3":
                                            rel = os.path.relpath(os.path.join(root, fl), proj_path).replace("\\", "/")
                                            mtime = int(os.path.getmtime(os.path.join(root, fl)))
                                            p_data["audioHttpUrl"] = f"http://127.0.0.1:{self._media_port}/projects/{folder}/{rel}?t={mtime}"
                                            has_combined = True

                            p_data["hasDiskAudio"] = has_combined or total_chunks > 0
                            p_data["diskChunkCount"] = total_chunks
                            projects.append(p_data)
                    except Exception as err:
                        print(f"Error loading {fp}: {err}")

            projects.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
        except Exception as e:
            self.write_log("error", f"Error loading projects from disk: {e}")
        return projects

    def load_project_from_disk(self, project_id: str):
        """Loads a single project from disk, including its combined MP3 streaming HTTP URL if available"""
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id)
            json_path = os.path.join(p_dir, "project.json")
            if not os.path.exists(json_path):
                return None

            with open(json_path, "r", encoding="utf-8") as f:
                p_data = json.load(f)

            # Check if combined.mp3 exists on disk (root or subpaths)
            mp3_path = os.path.join(p_dir, "combined.mp3")
            has_combined = os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0
            if has_combined:
                mtime = int(os.path.getmtime(mp3_path))
                p_data["hasDiskAudio"] = True
                p_data["audioHttpUrl"] = f"http://127.0.0.1:{self._media_port}/projects/{project_id}/combined.mp3?t={mtime}"
            else:
                total_chunks = 0
                for root, _, files in os.walk(p_dir):
                    for fl in files:
                        if fl.endswith(".mp3"):
                            total_chunks += 1
                            if not has_combined and fl == "combined.mp3":
                                rel = os.path.relpath(os.path.join(root, fl), p_dir).replace("\\", "/")
                                mtime = int(os.path.getmtime(os.path.join(root, fl)))
                                p_data["audioHttpUrl"] = f"http://127.0.0.1:{self._media_port}/projects/{project_id}/{rel}?t={mtime}"
                                has_combined = True
                p_data["hasDiskAudio"] = has_combined or total_chunks > 0
                p_data["diskChunkCount"] = total_chunks

            p_data["diskAudioBase64"] = None
            return p_data
        except Exception as e:
            self.write_log("error", f"Error loading single project {project_id}: {e}")
            return None

    # ------------------ MULTI-VOICE PERSISTENCE & SUBPATH RESOLUTION ------------------

    def _resolve_voice_subpath(self, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> str:
        """
        Resolves folder subpath formatted as: <locale>/<gender>_<name>
        e.g., 'en-US/female_jenny' or 'vi-VN/female_hoaimy'
        """
        if voice_locale and voice_name:
            gender = (voice_gender or "female").lower().strip()
            name = re.sub(r"[^\w\-]+", "_", voice_name.lower().strip())
            locale = voice_locale.strip()
            return f"{locale}/{gender}_{name}"

        if voice_id:
            if "/" in voice_id:
                return voice_id.strip()

            parts = voice_id.split("-")
            if len(parts) >= 3:
                locale = f"{parts[0]}-{parts[1]}"
                raw_name = parts[2].replace("Neural", "")
                gender = (voice_gender or "female").lower().strip()
                name = re.sub(r"[^\w\-]+", "_", raw_name.lower().strip())
                return f"{locale}/{gender}_{name}"

            return re.sub(r"[^\w\-]+", "_", voice_id.lower().strip())

        return ""

    def _read_mp3_duration(self, path: str) -> float:
        """Accurately calculates MP3 audio duration from file size and MPEG frame bitrate header"""
        if not os.path.exists(path):
            return 0.0
        try:
            size = os.path.getsize(path)
            with open(path, "rb") as f:
                data = f.read(4096)
            import struct
            idx = 0
            while idx < len(data) - 4:
                if data[idx] == 0xFF and (data[idx+1] & 0xE0) == 0xE0:
                    header = struct.unpack(">I", data[idx:idx+4])[0]
                    version = (header >> 19) & 3
                    bitrate_idx = (header >> 12) & 0xF
                    bitrates_v2_l3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
                    bitrates_v1_l3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
                    kbps = bitrates_v2_l3[bitrate_idx] if version != 3 else bitrates_v1_l3[bitrate_idx]
                    if kbps > 0:
                        bps = (kbps * 1000) / 8
                        return round(size / bps, 2)
                idx += 1
            return round(size / 6000.0, 2)
        except Exception:
            return 0.0

    def _get_voice_dir(self, project_id: str, voice_subpath: str = "") -> str:
        """Returns absolute path to project's voice directory"""
        if voice_subpath:
            return os.path.join(self.get_storage_dir(), "projects", project_id, voice_subpath)
        return os.path.join(self.get_storage_dir(), "projects", project_id)

    def save_chunk_audio(self, project_id: str, chunk_id: int, base64_data: str, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None, cues: list = None, duration: float = None) -> bool:
        """Saves a chunk's MP3 audio and synchronized cues to disk: <project_id>/<voice_subpath>/chunks/chunk_<id>.mp3"""
        try:
            subpath = self._resolve_voice_subpath(voice_id, voice_locale, voice_gender, voice_name)
            v_dir = self._get_voice_dir(project_id, subpath)
            chunks_dir = os.path.join(v_dir, "chunks")
            os.makedirs(chunks_dir, exist_ok=True)
            mp3_path = os.path.join(chunks_dir, f"chunk_{chunk_id}.mp3")

            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            binary_data = base64.b64decode(base64_data)
            with open(mp3_path, "wb") as f:
                f.write(binary_data)

            # Persist accurate Edge-TTS subtitle timing cues alongside audio
            exact_dur = duration or self._read_mp3_duration(mp3_path)
            cues_path = os.path.join(chunks_dir, f"chunk_{chunk_id}.cues.json")
            with open(cues_path, "w", encoding="utf-8") as f:
                json.dump({"cues": cues or [], "duration": exact_dur}, f, ensure_ascii=False)

            self.write_log("info", f"Saved Chunk {chunk_id} ({subpath or 'default'}) audio ({len(binary_data)} bytes, {exact_dur}s) with cues at {mp3_path}")
            return True
        except Exception as e:
            self.write_log("error", f"Error saving chunk audio: {e}")
            return False

    def save_combined_audio(self, project_id: str, base64_data: str, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> bool:
        """Saves combined project MP3 file to disk at <project_id>/<voice_subpath>/combined.mp3"""
        try:
            subpath = self._resolve_voice_subpath(voice_id, voice_locale, voice_gender, voice_name)
            v_dir = self._get_voice_dir(project_id, subpath)
            os.makedirs(v_dir, exist_ok=True)
            mp3_path = os.path.join(v_dir, "combined.mp3")

            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            binary_data = base64.b64decode(base64_data)
            with open(mp3_path, "wb") as f:
                f.write(binary_data)

            self.write_log("info", f"Saved combined MP3 ({subpath or 'default'}) to disk ({len(binary_data)} bytes) at {mp3_path}")
            return True
        except Exception as e:
            self.write_log("error", f"Error saving combined audio: {e}")
            return False

    def _find_chunk_file_path(self, project_id: str, chunk_id: int, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> tuple[str | None, str]:
        """
        Locates chunk MP3 path on disk, supporting exact subpaths, legacy root paths,
        and deep discovery across voice subdirectories.
        Returns (abs_path, relative_url_path).
        """
        p_base = os.path.join(self.get_storage_dir(), "projects", project_id)
        if not os.path.exists(p_base):
            return None, ""

        subpath = self._resolve_voice_subpath(voice_id, voice_locale, voice_gender, voice_name)
        # 1. Check exact subpath if provided
        if subpath:
            v_path = os.path.join(p_base, subpath, "chunks", f"chunk_{chunk_id}.mp3")
            if os.path.exists(v_path) and os.path.getsize(v_path) > 0:
                rel = os.path.relpath(v_path, p_base).replace("\\", "/")
                return v_path, rel

        # 2. Check root legacy chunks folder
        leg_path = os.path.join(p_base, "chunks", f"chunk_{chunk_id}.mp3")
        if os.path.exists(leg_path) and os.path.getsize(leg_path) > 0:
            rel = os.path.relpath(leg_path, p_base).replace("\\", "/")
            return leg_path, rel

        # 3. Deep discovery: scan any voice subpath folder under projects/<project_id>
        fname = f"chunk_{chunk_id}.mp3"
        for root, dirs, files in os.walk(p_base):
            if fname in files:
                full_path = os.path.join(root, fname)
                if os.path.getsize(full_path) > 0:
                    rel = os.path.relpath(full_path, p_base).replace("\\", "/")
                    return full_path, rel

        return None, ""

    def check_chunk_cache(self, project_id: str, chunk_id: int, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> bool:
        """Checks if a chunk MP3 file already exists on disk and is non-empty"""
        try:
            full_path, _ = self._find_chunk_file_path(project_id, chunk_id, voice_id, voice_locale, voice_gender, voice_name)
            return full_path is not None
        except Exception:
            return False

    def get_chunk_audio_url(self, project_id: str, chunk_id: int, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> str | None:
        """Returns HTTP streaming URL for a cached chunk"""
        try:
            full_path, rel = self._find_chunk_file_path(project_id, chunk_id, voice_id, voice_locale, voice_gender, voice_name)
            if full_path:
                mtime = int(os.path.getmtime(full_path))
                return f"http://127.0.0.1:{self._media_port}/projects/{project_id}/{rel}?t={mtime}"
        except Exception as e:
            print(f"Error getting chunk audio URL: {e}")
        return None

    def get_chunk_audio(self, project_id: str, chunk_id: int, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> str | None:
        """Loads a cached chunk's MP3 file from disk as base64 data URI (fallback)"""
        try:
            full_path, _ = self._find_chunk_file_path(project_id, chunk_id, voice_id, voice_locale, voice_gender, voice_name)
            if full_path:
                with open(full_path, "rb") as f:
                    data = f.read()
                b64 = base64.b64encode(data).decode("utf-8")
                return f"data:audio/mp3;base64,{b64}"
        except Exception as e:
            print(f"Error reading chunk audio: {e}")
        return None

    def get_chunk_cues(self, project_id: str, chunk_id: int, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> dict | None:
        """Loads accurate cached subtitle cues and exact audio duration for a chunk"""
        try:
            full_path, _ = self._find_chunk_file_path(project_id, chunk_id, voice_id, voice_locale, voice_gender, voice_name)
            if not full_path:
                return None

            cues_path = full_path.replace(".mp3", ".cues.json")
            if os.path.exists(cues_path) and os.path.getsize(cues_path) > 0:
                with open(cues_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return {
                        "cues": data.get("cues"),
                        "duration": data.get("duration", self._read_mp3_duration(full_path))
                    }

            # If no cues JSON, calculate exact audio duration from MP3 frame header
            exact_dur = self._read_mp3_duration(full_path)
            return {
                "cues": None,
                "duration": exact_dur
            }
        except Exception as e:
            print(f"Error reading chunk cues: {e}")
            return None

    def get_combined_audio_url(self, project_id: str, voice_id: str = None, voice_locale: str = None, voice_gender: str = None, voice_name: str = None) -> str | None:
        """Returns HTTP streaming URL for a project's combined MP3"""
        try:
            p_base = os.path.join(self.get_storage_dir(), "projects", project_id)
            if not os.path.exists(p_base):
                return None

            subpath = self._resolve_voice_subpath(voice_id, voice_locale, voice_gender, voice_name)
            if subpath:
                v_path = os.path.join(p_base, subpath, "combined.mp3")
                if os.path.exists(v_path) and os.path.getsize(v_path) > 0:
                    mtime = int(os.path.getmtime(v_path))
                    url_subpath = subpath.replace("\\", "/")
                    return f"http://127.0.0.1:{self._media_port}/projects/{project_id}/{url_subpath}/combined.mp3?t={mtime}"

            # Legacy fallback at project root
            leg_path = os.path.join(p_base, "combined.mp3")
            if os.path.exists(leg_path) and os.path.getsize(leg_path) > 0:
                mtime = int(os.path.getmtime(leg_path))
                return f"http://127.0.0.1:{self._media_port}/projects/{project_id}/combined.mp3?t={mtime}"

            # Deep search for any combined.mp3 under project folder
            for root, _, files in os.walk(p_base):
                if "combined.mp3" in files:
                    full_path = os.path.join(root, "combined.mp3")
                    if os.path.getsize(full_path) > 0:
                        rel = os.path.relpath(full_path, p_base).replace("\\", "/")
                        mtime = int(os.path.getmtime(full_path))
                        return f"http://127.0.0.1:{self._media_port}/projects/{project_id}/{rel}?t={mtime}"
        except Exception as e:
            print(f"Error getting combined audio URL: {e}")
        return None

    def get_project_voice_statuses(self, project_id: str) -> dict:
        """
        Scans project directory for all generated voice tracks and their chunk completion status.
        Returns a dictionary keyed by voice subpath (e.g. 'en-US/female_jenny'):
        {
            "en-US/female_jenny": {
                "voiceSubpath": "en-US/female_jenny",
                "locale": "en-US",
                "hasCombined": True,
                "combinedUrl": "http://127.0.0.1:5174/...",
                "chunkCount": 24,
                "generatedChunkIndices": [0, 1, 2, ...],
                "mtime": 1720000000
            }
        }
        """
        results = {}
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id)
            if not os.path.exists(p_dir):
                return {}

            def scan_voice_folder(folder_path: str, subpath: str, locale: str = ""):
                if not os.path.isdir(folder_path):
                    return
                combined_path = os.path.join(folder_path, "combined.mp3")
                has_combined = os.path.exists(combined_path) and os.path.getsize(combined_path) > 0
                combined_url = None
                mtime = 0
                if has_combined:
                    mtime = int(os.path.getmtime(combined_path))
                    url_subpath = subpath.replace("\\", "/").strip("/")
                    combined_url = f"http://127.0.0.1:{self._media_port}/projects/{project_id}/{url_subpath}/combined.mp3?t={mtime}" if url_subpath and url_subpath != "default" else f"http://127.0.0.1:{self._media_port}/projects/{project_id}/combined.mp3?t={mtime}"

                chunks_dir = os.path.join(folder_path, "chunks")
                indices = []
                if os.path.isdir(chunks_dir):
                    for fname in os.listdir(chunks_dir):
                        if fname.startswith("chunk_") and fname.endswith(".mp3"):
                            try:
                                c_idx = int(fname.replace("chunk_", "").replace(".mp3", ""))
                                c_path = os.path.join(chunks_dir, fname)
                                if os.path.getsize(c_path) > 0:
                                    indices.append(c_idx)
                                    if not mtime:
                                        mtime = int(os.path.getmtime(c_path))
                            except ValueError:
                                pass
                indices.sort()

                if has_combined or len(indices) > 0:
                    clean_sub = subpath.replace("\\", "/")
                    results[clean_sub] = {
                        "voiceSubpath": clean_sub,
                        "locale": locale,
                        "hasCombined": has_combined,
                        "combinedUrl": combined_url,
                        "chunkCount": len(indices),
                        "generatedChunkIndices": indices,
                        "mtime": mtime
                    }

            for item in os.listdir(p_dir):
                item_path = os.path.join(p_dir, item)
                if not os.path.isdir(item_path) or item in ["chunks", "logs", "__pycache__"]:
                    continue

                is_direct_voice = os.path.exists(os.path.join(item_path, "chunks")) or os.path.exists(os.path.join(item_path, "combined.mp3"))

                if is_direct_voice:
                    scan_voice_folder(item_path, item, "")
                else:
                    for sub in os.listdir(item_path):
                        sub_path = os.path.join(item_path, sub)
                        if os.path.isdir(sub_path):
                            scan_voice_folder(sub_path, f"{item}/{sub}", item)

            scan_voice_folder(p_dir, "default", "")

        except Exception as e:
            self.write_log("error", f"Error scanning project voice statuses: {e}")

        return results

    def delete_project_from_disk(self, project_id: str) -> bool:
        """Deletes the project folder and all its audio files from disk"""
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id)
            if os.path.exists(p_dir):
                shutil.rmtree(p_dir, ignore_errors=True)
                self.write_log("info", f"Deleted project folder from disk: {p_dir}")
                return True
        except Exception as e:
            self.write_log("error", f"Error deleting project: {e}")
        return False

    # ------------------ EDGE-TTS NEURAL SYNTHESIS ------------------

    async def _async_edge_tts(self, text: str, voice: str, rate: int, pitch: int, volume: int) -> dict:
        rate_str = f"{rate:+d}%" if rate != 0 else "+0%"
        pitch_str = f"{pitch:+d}Hz" if pitch != 0 else "+0Hz"
        vol_str = f"{volume - 100:+d}%" if volume != 100 else "+0%"

        communicate = edge_tts.Communicate(
            text=text,
            voice=voice,
            rate=rate_str,
            pitch=pitch_str,
            volume=vol_str
        )

        audio_data = bytearray()
        cues = []
        cue_idx = 0

        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data.extend(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                start_sec = round(chunk["offset"] / 10_000_000, 2)
                duration_sec = round(chunk["duration"] / 10_000_000, 2)
                end_sec = round(start_sec + duration_sec, 2)
                cues.append({
                    "id": cue_idx,
                    "start": start_sec,
                    "end": end_sec,
                    "text": chunk.get("text", "").strip()
                })
                cue_idx += 1

        b64_audio = "data:audio/mp3;base64," + base64.b64encode(audio_data).decode("ascii")
        total_duration = cues[-1]["end"] if cues else 3.0

        return {
            "success": True,
            "base64Audio": b64_audio,
            "cues": cues,
            "duration": total_duration,
            "byteLength": len(audio_data)
        }

    def synthesize_edge_tts(self, text: str, voice: str = "en-US-JennyNeural", rate: int = 0, pitch: int = 0, volume: int = 100) -> dict:
        """Synthesizes genuine Edge-TTS neural speech via official Python edge_tts engine"""
        try:
            self.write_log("info", f"Executing Python edge_tts neural synthesis for {len(text.split())} words with voice '{voice}'")
            loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(loop)
                return loop.run_until_complete(self._async_edge_tts(text, voice, rate, pitch, volume))
            finally:
                loop.close()
        except Exception as e:
            self.write_log("error", f"Python edge_tts synthesis error: {e}")
            return {"success": False, "error": str(e)}

    # ------------------ WINDOW CONTROLS ------------------

    def set_mini_mode(self, is_mini: bool, is_swift: bool = False) -> bool:
        """Scales down window to floating mini-player bar (760x168 or swift 460x130) or expands to full (1440x810)"""
        try:
            if not self._window:
                return False
            if is_mini:
                if is_swift:
                    self._window.resize(460, 130)
                else:
                    self._window.resize(760, 168)
                self.set_pinned(True)
            else:
                self._window.resize(1440, 810)
                self.set_pinned(False)
            return True
        except Exception as e:
            print(f"Mini mode error: {e}")
            return False

    def resize_window(self, width: int, height: int) -> bool:
        """Explicitly resizes native window to width x height"""
        try:
            if self._window:
                self._window.resize(width, height)
                return True
            return False
        except Exception as e:
            print(f"Resize window error: {e}")
            return False

    def set_pinned(self, is_pinned: bool) -> bool:
        """Sets Win32 Always On Top priority"""
        try:
            hwnd = ctypes.windll.user32.FindWindowW(None, "VoiceFlow Studio")
            if not hwnd:
                hwnd = ctypes.windll.user32.GetForegroundWindow()
            flag = HWND_TOPMOST if is_pinned else HWND_NOTOPMOST
            ctypes.windll.user32.SetWindowPos(hwnd, flag, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
            self.write_log("info", f"Window pin state toggled: {is_pinned}")
            return True
        except Exception as e:
            print(f"Pin error: {e}")
            return False

    def minimize(self) -> bool:
        """Minimizes the native window"""
        try:
            if self._window:
                self._window.minimize()
                return True
        except Exception as e:
            print(f"Minimize error: {e}")
            return False

    def toggle_maximize(self) -> bool:
        """Toggles between maximized and restored window size"""
        try:
            if self._window:
                if self._is_maximized:
                    self._window.restore()
                    self._is_maximized = False
                else:
                    self._window.maximize()
                    self._is_maximized = True
                return True
        except Exception as e:
            print(f"Toggle maximize error: {e}")
            return False

    def close(self) -> bool:
        """Terminates and destroys the native window"""
        try:
            if self._window:
                self.write_log("info", "Application exiting via UI close button.")
                self._window.destroy()
                return True
        except Exception as e:
            print(f"Close error: {e}")
            return False

    def drag_window(self):
        """Allows dragging the native window anywhere on the desktop screen"""
        try:
            WM_NCLBUTTONDOWN = 0xA1
            HTCAPTION = 0x2
            GA_ROOT = 2
            hwnd = ctypes.windll.user32.FindWindowW(None, "VoiceFlow Studio")
            if not hwnd:
                hwnd = ctypes.windll.user32.GetForegroundWindow()
            if hwnd:
                root_hwnd = ctypes.windll.user32.GetAncestor(hwnd, GA_ROOT)
                if root_hwnd:
                    hwnd = root_hwnd
                ctypes.windll.user32.ReleaseCapture()
                ctypes.windll.user32.SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0)
        except Exception as e:
            print(f"Drag window error: {e}")

def main():
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    else:
        dist_index = os.path.join(BASE_DIR, "dist", "index.html")
        if os.path.exists(dist_index):
            target_url = f"http://127.0.0.1:{MEDIA_PORT}/"
        else:
            target_url = "http://localhost:5173"
    
    # Create webview window with frameless=True for borderless desktop look.
    # easy_drag=False is CRITICAL so mouse-drag selection inside text editors works normally without dragging the window.
    # Window dragging is isolated to .pywebview-drag-region in the titlebar.
    api_instance = DesktopApi(None)
    window = webview.create_window(
        title="VoiceFlow Studio",
        url=target_url,
        width=1440,
        height=810,
        resizable=True,
        frameless=True,
        easy_drag=False,
        js_api=api_instance,
        background_color='#0b0f19'
    )
    api_instance.set_window(window)

    webview.start()

if __name__ == '__main__':
    main()
