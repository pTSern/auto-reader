import os
import sys
import shutil
import base64

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from desktop_launcher import DesktopApi

def run_test():
    api = DesktopApi()
    test_pid = "test_multi_voice_proj"
    base_dir = api.get_storage_dir()
    proj_dir = os.path.join(base_dir, "projects", test_pid)
    
    # Cleanup any old test artifacts
    if os.path.exists(proj_dir):
        shutil.rmtree(proj_dir, ignore_errors=True)
    
    print(f"[TEST] Target project dir: {proj_dir}")

    # 1. Test _resolve_voice_subpath
    subpath1 = api._resolve_voice_subpath(voice_locale="en-US", voice_gender="Female", voice_name="Jenny")
    assert subpath1 == "en-US/female_jenny", f"Expected en-US/female_jenny, got {subpath1}"
    print(f"[PASS] Subpath resolution with explicit metadata: {subpath1}")

    subpath2 = api._resolve_voice_subpath(voice_id="vi-VN-HoaiMyNeural", voice_gender="Female")
    assert subpath2 == "vi-VN/female_hoaimy", f"Expected vi-VN/female_hoaimy, got {subpath2}"
    print(f"[PASS] Subpath resolution with Edge-TTS identifier: {subpath2}")

    # 2. Test saving chunks under Jenny
    fake_audio_b64 = "data:audio/mp3;base64," + base64.b64encode(b"FAKE_AUDIO_DATA_FOR_TEST").decode("ascii")
    ok = api.save_chunk_audio(test_pid, 0, fake_audio_b64, voice_locale="en-US", voice_gender="Female", voice_name="Jenny")
    assert ok, "Failed to save chunk 0 for Jenny"
    ok = api.save_chunk_audio(test_pid, 1, fake_audio_b64, voice_locale="en-US", voice_gender="Female", voice_name="Jenny")
    assert ok, "Failed to save chunk 1 for Jenny"

    # Check cache
    assert api.check_chunk_cache(test_pid, 0, voice_locale="en-US", voice_gender="Female", voice_name="Jenny")
    assert api.check_chunk_cache(test_pid, 1, voice_locale="en-US", voice_gender="Female", voice_name="Jenny")
    assert not api.check_chunk_cache(test_pid, 2, voice_locale="en-US", voice_gender="Female", voice_name="Jenny")
    print("[PASS] Jenny chunks saved and cached correctly")

    # 3. Test saving chunk 0 and combined audio under Hoai My
    ok = api.save_chunk_audio(test_pid, 0, fake_audio_b64, voice_locale="vi-VN", voice_gender="Female", voice_name="HoaiMy")
    assert ok, "Failed to save chunk 0 for HoaiMy"
    ok = api.save_combined_audio(test_pid, fake_audio_b64, voice_locale="vi-VN", voice_gender="Female", voice_name="HoaiMy")
    assert ok, "Failed to save combined audio for HoaiMy"

    combined_url = api.get_combined_audio_url(test_pid, voice_locale="vi-VN", voice_gender="Female", voice_name="HoaiMy")
    assert combined_url is not None and "vi-VN/female_hoaimy/combined.mp3" in combined_url
    print(f"[PASS] Hoai My combined audio URL verified: {combined_url}")

    # 4. Test get_project_voice_statuses
    statuses = api.get_project_voice_statuses(test_pid)
    print(f"[INFO] Scanned statuses: {statuses}")
    assert "en-US/female_jenny" in statuses
    assert statuses["en-US/female_jenny"]["chunkCount"] == 2
    assert statuses["en-US/female_jenny"]["generatedChunkIndices"] == [0, 1]
    assert statuses["en-US/female_jenny"]["hasCombined"] == False

    assert "vi-VN/female_hoaimy" in statuses
    assert statuses["vi-VN/female_hoaimy"]["chunkCount"] == 1
    assert statuses["vi-VN/female_hoaimy"]["hasCombined"] == True

    print("[PASS] get_project_voice_statuses accurately detected all voice tracks & progress!")

    # 5. Cleanup
    api.delete_project_from_disk(test_pid)
    assert not os.path.exists(proj_dir)
    print("[PASS] Test project cleaned up successfully")

if __name__ == "__main__":
    run_test()
