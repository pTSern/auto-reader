"""
Local HTTP Media Server for VoiceFlow Studio.
Provides zero-overhead streaming of MP3 audio files directly from disk to the WebView2 browser.
Supports HTTP 206 Partial Content (Range requests) for native scrubbing and instant playback.
"""

import os
import sys
import re
import urllib.parse
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import threading

MEDIA_PORT = 5174

def get_dist_dir() -> str:
    """Returns the production frontend dist/ directory, accounting for PyInstaller frozen execution"""
    if getattr(sys, 'frozen', False):
        # 1. Bundled inside PyInstaller archive (_MEIPASS)
        mei_dist = os.path.join(getattr(sys, '_MEIPASS', ''), "dist")
        if os.path.exists(mei_dist):
            return mei_dist
        # 2. Alongside executable in release package
        exe_dist = os.path.join(os.path.dirname(sys.executable), "dist")
        if os.path.exists(exe_dist):
            return exe_dist
    # 3. Development mode (relative to source file)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class MediaServerHandler(BaseHTTPRequestHandler):
    storage_dir_provider = None

    def log_message(self, format, *args):
        # Suppress noisy HTTP request logging in terminal
        pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type")
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

    def do_HEAD(self):
        self.handle_file_request(send_body=False)

    def do_GET(self):
        self.handle_file_request(send_body=True)

    def handle_file_request(self, send_body: bool = True):
        # 1. Parse and validate URL path
        parsed_url = urllib.parse.urlparse(self.path)
        clean_path = urllib.parse.unquote(parsed_url.path).lstrip("/")

        # Security check against directory traversal
        if ".." in clean_path:
            self.send_error(403, "Access Denied")
            return

        base_storage = self.storage_dir_provider() if callable(self.storage_dir_provider) else ""
        dist_dir = get_dist_dir()

        if clean_path.startswith("projects/") or clean_path.startswith("projects\\"):
            if not base_storage or not os.path.exists(base_storage):
                self.send_error(500, "Storage Directory Not Initialized")
                return
            # 1. Standard: base_storage/projects/...
            file_path = os.path.abspath(os.path.join(base_storage, clean_path))

            # 2. Fallback: base_storage/<clean_path without 'projects/'> (if user selected project root directly)
            if not os.path.isfile(file_path):
                sub_rel = re.sub(r'^projects[\\/]', '', clean_path)
                alt_path = os.path.abspath(os.path.join(base_storage, sub_rel))
                if os.path.isfile(alt_path) and alt_path.startswith(os.path.abspath(base_storage)):
                    file_path = alt_path

            # 3. Fallback: deep search for target project_id folder within base_storage
            if not os.path.isfile(file_path):
                sub_rel = re.sub(r'^projects[\\/]', '', clean_path)
                parts = [p for p in sub_rel.replace("\\", "/").split("/") if p]
                if len(parts) >= 2:
                    target_pid = parts[0]
                    rest = os.sep.join(parts[1:])
                    for root, dirs, _ in os.walk(base_storage):
                        depth = len(os.path.relpath(root, base_storage).split(os.sep))
                        if depth > 3:
                            del dirs[:]
                            continue
                        if os.path.basename(root) == target_pid:
                            candidate = os.path.abspath(os.path.join(root, rest))
                            if os.path.isfile(candidate) and candidate.startswith(os.path.abspath(base_storage)):
                                file_path = candidate
                                break

            if not file_path.startswith(os.path.abspath(base_storage)):
                self.send_error(403, "Forbidden Path")
                return
        else:
            # Serve from compiled production dist/ folder
            if clean_path == "" or clean_path == "index.html":
                file_path = os.path.join(dist_dir, "index.html")
            else:
                file_path = os.path.abspath(os.path.join(dist_dir, clean_path))

            if not os.path.exists(dist_dir) or not file_path.startswith(os.path.abspath(dist_dir)):
                # Fallback to storage directory if not in dist
                file_path = os.path.abspath(os.path.join(base_storage, clean_path))

        if not os.path.isfile(file_path):
            self.send_error(404, "File Not Found")
            return

        file_size = os.path.getsize(file_path)

        # Precise MIME types to resolve Windows registry issues with .js
        if file_path.endswith(".js") or file_path.endswith(".mjs"):
            content_type = "text/javascript"
        elif file_path.endswith(".css"):
            content_type = "text/css"
        elif file_path.endswith(".html"):
            content_type = "text/html; charset=utf-8"
        elif file_path.endswith(".mp3"):
            content_type = "audio/mpeg"
        elif file_path.endswith(".json"):
            content_type = "application/json"
        elif file_path.endswith(".svg"):
            content_type = "image/svg+xml"
        elif file_path.endswith(".png"):
            content_type = "image/png"
        elif file_path.endswith(".ico"):
            content_type = "image/x-icon"
        elif file_path.endswith(".woff2"):
            content_type = "font/woff2"
        else:
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = "application/octet-stream"

        range_header = self.headers.get("Range")

        if range_header:
            # Handle HTTP Range request (206 Partial Content)
            match = re.search(r"bytes=(\d+)-(\d*)", range_header)
            if match:
                start = int(match.group(1))
                end = int(match.group(2)) if match.group(2) else file_size - 1
                end = min(end, file_size - 1)

                if start > end or start >= file_size:
                    self.send_error(416, "Requested Range Not Satisfiable")
                    return

                length = end - start + 1

                self.send_response(206)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()

                if send_body:
                    try:
                        with open(file_path, "rb") as f:
                            f.seek(start)
                            remaining = length
                            chunk_size = 64 * 1024
                            while remaining > 0:
                                to_read = min(chunk_size, remaining)
                                chunk = f.read(to_read)
                                if not chunk:
                                    break
                                self.wfile.write(chunk)
                                remaining -= len(chunk)
                    except (ConnectionResetError, BrokenPipeError):
                        # Client stopped audio / scrubbed
                        pass
                return

        # Normal 200 OK request
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        if send_body:
            try:
                with open(file_path, "rb") as f:
                    chunk_size = 64 * 1024
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except (ConnectionResetError, BrokenPipeError):
                pass


def start_media_server(storage_dir_provider, port: int = MEDIA_PORT) -> ThreadingHTTPServer:
    """Starts the media streaming server in a background daemon thread"""
    handler = MediaServerHandler
    handler.storage_dir_provider = staticmethod(storage_dir_provider)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True, name="MediaStreamingServer")
    thread.start()
    return server
