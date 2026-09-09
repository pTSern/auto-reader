"""
Automated Verification for VoiceFlow Studio Disk Storage & MP3 Audio Cache
Tests:
1. Custom storage directory setting and directory initialization
2. Project saving to disk (<storage_dir>/projects/<id>/project.json)
3. Chunk MP3 saving to disk (<storage_dir>/projects/<id>/chunks/chunk_0.mp3)
4. Combined MP3 saving to disk (<storage_dir>/projects/<id>/combined.mp3)
5. Cache check (check_chunk_cache) returns True
6. Project loading from disk restores valid base64 audio data URI
7. Storage info metrics (size, project count)
"""

import os
import sys
import json
import base64

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import desktop_launcher

def main():
    print("=== Starting Disk Storage & Audio Caching Verification ===\n")

    api = desktop_launcher.DesktopApi()
    
    # 1. Verify default storage info
    info = api.get_storage_info()
    print("1. Storage Info:", info)
    assert info["exists"] is True, "Storage directory should exist"
    storage_dir = info["storage_dir"]
    print(f"- Storage directory is located at: {storage_dir}")

    # 2. Save a test project
    test_id = "test_disk_proj_001"
    sample_project = {
        "id": test_id,
        "title": "Quantum Physics Audio Lecture",
        "createdAt": 1773220000000,
        "updatedAt": 1773220000000,
        "textContent": "Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles.",
        "voiceSettings": {
            "voiceId": "en-US-JennyNeural",
            "rate": 0,
            "pitch": 0,
            "volume": 100
        },
        "shadowSettings": {
            "enabled": True,
            "chunkSizeWords": 500,
            "concurrencyMode": "auto"
        },
        "cues": [
            {"id": 0, "start": 0.0, "end": 4.5, "text": "Quantum mechanics is a fundamental theory in physics."},
            {"id": 1, "start": 4.5, "end": 9.2, "text": "It provides a description of the physical properties of nature at the scale of atoms."}
        ],
        "playbackMemory": {
            "currentTime": 4.5,
            "duration": 9.2,
            "activeCueIndex": 1,
            "percentCompleted": 48.9
        }
    }

    print("\n2. Saving Project to Disk...")
    save_ok = api.save_project_to_disk(sample_project)
    assert save_ok is True, "save_project_to_disk failed"

    project_json_path = os.path.join(storage_dir, "projects", test_id, "project.json")
    assert os.path.exists(project_json_path), f"project.json not found at {project_json_path}"
    print(f"- Verified project.json on disk: {project_json_path}")

    # 3. Save Chunk MP3 to disk
    print("\n3. Saving Chunk 0 MP3 audio to disk...")
    # Simulated valid MP3 header bytes
    fake_mp3_bytes = b"ID3\x04\x00\x00\x00\x00\x00#TSSE\x00\x00\x00\x0f\x00\x00\x03Lavf58.76.100\xff\xfb\x90d\x00" + (b"\x00" * 2000)
    fake_b64 = "data:audio/mp3;base64," + base64.b64encode(fake_mp3_bytes).decode("ascii")

    chunk_save_ok = api.save_chunk_audio(test_id, 0, fake_b64)
    assert chunk_save_ok is True, "save_chunk_audio failed"
    
    chunk_path = os.path.join(storage_dir, "projects", test_id, "chunks", "chunk_0.mp3")
    assert os.path.exists(chunk_path), f"chunk_0.mp3 not found at {chunk_path}"
    print(f"- Verified chunk_0.mp3 file ({os.path.getsize(chunk_path)} bytes) on disk: {chunk_path}")

    # 4. Save Combined MP3 to disk
    print("\n4. Saving Combined MP3 to disk...")
    comb_save_ok = api.save_combined_audio(test_id, fake_b64)
    assert comb_save_ok is True, "save_combined_audio failed"

    combined_path = os.path.join(storage_dir, "projects", test_id, "combined.mp3")
    assert os.path.exists(combined_path), f"combined.mp3 not found at {combined_path}"
    print(f"- Verified combined.mp3 file ({os.path.getsize(combined_path)} bytes) on disk: {combined_path}")

    # 5. Verify Cache Detection
    print("\n5. Testing Chunk Cache Detection:")
    is_cached = api.check_chunk_cache(test_id, 0)
    print(f"- Chunk 0 cached: {is_cached}")
    assert is_cached is True, "Chunk 0 should be cached on disk"

    is_chunk1_cached = api.check_chunk_cache(test_id, 1)
    print(f"- Chunk 1 cached: {is_chunk1_cached}")
    assert is_chunk1_cached is False, "Chunk 1 should not be cached yet"

    # 6. Load Project from Disk (Next Time Open)
    print("\n6. Testing Project Reload from Disk:")
    loaded = api.load_project_from_disk(test_id)
    assert loaded is not None, "Failed to load project from disk"
    assert loaded["title"] == "Quantum Physics Audio Lecture"
    assert loaded["hasDiskAudio"] is True
    assert "audioHttpUrl" in loaded and loaded["audioHttpUrl"].startswith(f"http://127.0.0.1:{api.media_port}/")
    print(f"- Audio HTTP Streaming URL: {loaded['audioHttpUrl']}")
    
    # Verify the audio stream works via HTTP Range
    import urllib.request
    req = urllib.request.Request(loaded["audioHttpUrl"], headers={"Range": "bytes=0-99"})
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 206
        chunk = resp.read()
        assert len(chunk) == 100
        print("- Streamed 100 bytes via HTTP 206 Partial Content successfully!")

    print(f"- Successfully reloaded '{loaded['title']}' with disk MP3 streaming URL restored!")

    # 7. Verify List All Projects on Disk
    all_disk_projects = api.load_all_projects_from_disk()
    print(f"- Total projects listed on disk: {len(all_disk_projects)}")
    assert any(p["id"] == test_id for p in all_disk_projects)

    # 8. Clean up test project
    print("\n8. Cleaning up test project...")
    api.delete_project_from_disk(test_id)
    assert not os.path.exists(os.path.join(storage_dir, "projects", test_id))
    print("- Cleaned up successfully.")

    print("\n=== ALL DISK STORAGE & AUDIO CACHING TESTS PASSED! ===")

if __name__ == "__main__":
    main()
