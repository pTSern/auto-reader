import os
import sys
import json
import base64
import shutil
import ctypes
from ctypes import wintypes
from datetime import datetime
import webview

HWND_TOPMOST = -1
HWND_NOTOPMOST = -2
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE_PATH = os.path.join(BASE_DIR, "app.log")
CONFIG_FILE_PATH = os.path.join(BASE_DIR, "config.json")
DEFAULT_STORAGE_DIR = os.path.join(BASE_DIR, "projects_data")

class DesktopApi:
    def __init__(self, window=None):
        self.window = window
        self.is_maximized = False
        self._init_logfile()
        self._init_config()

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
            if not self.window:
                return None
            current = self.get_storage_dir()
            # Dialog returns list of chosen paths
            chosen = self.window.create_file_dialog(webview.FileDialog.FOLDER, directory=current)
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
                            # Check if audio exists on disk
                            mp3_path = os.path.join(p_dir, folder, "combined.mp3")
                            p_data["hasDiskAudio"] = os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0
                            projects.push(p_data) if hasattr(projects, 'push') else projects.append(p_data)
                    except Exception as err:
                        print(f"Error loading {fp}: {err}")

            projects.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
        except Exception as e:
            self.write_log("error", f"Error loading projects from disk: {e}")
        return projects

    def load_project_from_disk(self, project_id: str):
        """Loads a single project from disk, including its combined MP3 if available"""
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id)
            json_path = os.path.join(p_dir, "project.json")
            if not os.path.exists(json_path):
                return None

            with open(json_path, "r", encoding="utf-8") as f:
                p_data = json.load(f)

            # Check if combined.mp3 exists on disk
            mp3_path = os.path.join(p_dir, "combined.mp3")
            if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                with open(mp3_path, "rb") as af:
                    b64 = base64.b64encode(af.read()).decode("ascii")
                    p_data["diskAudioBase64"] = f"data:audio/mp3;base64,{b64}"
                    p_data["hasDiskAudio"] = True
            else:
                p_data["hasDiskAudio"] = False

            return p_data
        except Exception as e:
            self.write_log("error", f"Error loading single project {project_id}: {e}")
            return None

    def save_chunk_audio(self, project_id: str, chunk_id: int, base64_data: str) -> bool:
        """Saves a chunk's MP3 audio directly to disk <project_id>/chunks/chunk_<id>.mp3"""
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id, "chunks")
            os.makedirs(p_dir, exist_ok=True)
            mp3_path = os.path.join(p_dir, f"chunk_{chunk_id}.mp3")

            # Remove prefix if present (e.g. data:audio/mp3;base64,...)
            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            binary_data = base64.b64decode(base64_data)
            with open(mp3_path, "wb") as f:
                f.write(binary_data)

            self.write_log("info", f"Saved Chunk {chunk_id} audio to disk ({len(binary_data)} bytes) at {mp3_path}")
            return True
        except Exception as e:
            self.write_log("error", f"Error saving chunk audio: {e}")
            return False

    def save_combined_audio(self, project_id: str, base64_data: str) -> bool:
        """Saves combined project MP3 file to disk at <project_id>/combined.mp3"""
        try:
            p_dir = os.path.join(self.get_storage_dir(), "projects", project_id)
            os.makedirs(p_dir, exist_ok=True)
            mp3_path = os.path.join(p_dir, "combined.mp3")

            if "," in base64_data:
                base64_data = base64_data.split(",", 1)[1]

            binary_data = base64.b64decode(base64_data)
            with open(mp3_path, "wb") as f:
                f.write(binary_data)

            self.write_log("info", f"Saved combined MP3 audio to disk ({len(binary_data)} bytes) at {mp3_path}")
            return True
        except Exception as e:
            self.write_log("error", f"Error saving combined audio: {e}")
            return False

    def check_chunk_cache(self, project_id: str, chunk_id: int) -> bool:
        """Checks if a chunk MP3 file already exists on disk and is non-empty"""
        try:
            mp3_path = os.path.join(self.get_storage_dir(), "projects", project_id, "chunks", f"chunk_{chunk_id}.mp3")
            return os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0
        except Exception:
            return False

    def get_chunk_audio(self, project_id: str, chunk_id: int) -> str | None:
        """Loads a cached chunk's MP3 file from disk as base64 data URI"""
        try:
            mp3_path = os.path.join(self.get_storage_dir(), "projects", project_id, "chunks", f"chunk_{chunk_id}.mp3")
            if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                with open(mp3_path, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                    return f"data:audio/mp3;base64,{b64}"
        except Exception as e:
            print(f"Error reading chunk audio: {e}")
        return None

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

    # ------------------ WINDOW CONTROLS ------------------

    def set_mini_mode(self, is_mini: bool) -> bool:
        """Scales down window to floating mini-player bar (720x150) or expands to full (1440x810)"""
        try:
            if not self.window:
                return False
            if is_mini:
                self.window.resize(720, 150)
                self.set_pinned(True)
            else:
                self.window.resize(1440, 810)
                self.set_pinned(False)
            return True
        except Exception as e:
            print(f"Mini mode error: {e}")
            return False

    def set_pinned(self, is_pinned: bool) -> bool:
        """Sets Win32 Always On Top priority"""
        try:
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
            if self.window:
                self.window.minimize()
                return True
        except Exception as e:
            print(f"Minimize error: {e}")
        return False

    def toggle_maximize(self) -> bool:
        """Toggles between maximized and restored window size"""
        try:
            if self.window:
                if self.is_maximized:
                    self.window.restore()
                    self.is_maximized = False
                else:
                    self.window.maximize()
                    self.is_maximized = True
                return True
        except Exception as e:
            print(f"Toggle maximize error: {e}")
        return False

    def close(self) -> bool:
        """Terminates and destroys the native window"""
        try:
            if self.window:
                self.write_log("info", "Application exiting via UI close button.")
                self.window.destroy()
                return True
        except Exception as e:
            print(f"Close error: {e}")
        return False

    def drag_window(self):
        """Allows dragging the native window"""
        pass

def main():
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
    
    # Create webview window with frameless=True for borderless desktop look
    api_instance = DesktopApi(None)
    window = webview.create_window(
        title="VoiceFlow Studio",
        url=target_url,
        width=1440,
        height=810,
        resizable=True,
        frameless=True,
        easy_drag=True,
        js_api=api_instance,
        background_color='#0b0f19'
    )
    api_instance.window = window

    webview.start()

if __name__ == '__main__':
    main()


