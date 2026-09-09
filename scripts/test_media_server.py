"""
Automated unit test for local HTTP media server and Range requests.
"""

import os
import sys
import time
import urllib.request
import urllib.error

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from media_server import start_media_server

def main():
    print("=== Testing Media Server Streaming & Range Requests ===")
    storage_dir = os.path.join(ROOT_DIR, "projects_data")
    os.makedirs(os.path.join(storage_dir, "projects", "test_stream"), exist_ok=True)
    
    test_mp3_path = os.path.join(storage_dir, "projects", "test_stream", "sample.mp3")
    # Write 1024 dummy bytes
    dummy_data = b"AUDIO_HEADER_" + (b"X" * 1000)
    with open(test_mp3_path, "wb") as f:
        f.write(dummy_data)
    
    server = start_media_server(lambda: storage_dir, port=5174)
    time.sleep(0.3)
    
    # 1. Full GET test
    url = "http://127.0.0.1:5174/projects/test_stream/sample.mp3"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        data = resp.read()
        assert len(data) == len(dummy_data), f"Expected {len(dummy_data)} bytes, got {len(data)}"
        assert resp.headers.get("Content-Type") == "audio/mpeg"
        assert resp.headers.get("Accept-Ranges") == "bytes"
        print("1. Standard GET 200 test: PASSED")
    
    # 2. Range request test (HTTP 206)
    range_req = urllib.request.Request(url, headers={"Range": "bytes=0-11"})
    with urllib.request.urlopen(range_req) as resp:
        assert resp.status == 206, f"Expected 206, got {resp.status}"
        chunk = resp.read()
        assert chunk == b"AUDIO_HEADER", f"Expected b'AUDIO_HEADER', got {chunk}"
        assert resp.headers.get("Content-Range") == f"bytes 0-11/{len(dummy_data)}"
        print("2. Range request 206 Partial Content test: PASSED")

    # 3. 404 test
    not_found_url = "http://127.0.0.1:5174/projects/test_stream/nonexistent.mp3"
    try:
        urllib.request.urlopen(not_found_url)
        assert False, "Should have returned 404"
    except urllib.error.HTTPError as e:
        assert e.code == 404
        print("3. 404 Not Found test: PASSED")

    # 4. Traversal test
    traversal_url = "http://127.0.0.1:5174/../config.json"
    try:
        urllib.request.urlopen(traversal_url)
        assert False, "Should have blocked traversal"
    except urllib.error.HTTPError as e:
        assert e.code in (403, 404)
        print("4. Traversal protection test: PASSED")

    # Clean up test file
    try:
        os.remove(test_mp3_path)
    except Exception:
        pass
    
    print("\n=== ALL MEDIA SERVER TESTS PASSED! ===")

if __name__ == "__main__":
    main()
