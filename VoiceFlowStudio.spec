# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

BASE_DIR = os.path.abspath(SPECPATH)

# Data files to bundle:
# 1. Frontend dist/ directory (compiled HTML/JS/CSS)
# 2. certifi SSL root certificates (required for secure edge-tts WSS connections)
# 3. pywebview internal assets (EdgeChromium/MSHTML interop scripts)
datas = [
    (os.path.join(BASE_DIR, 'dist'), 'dist'),
]
datas += collect_data_files('certifi')
datas += collect_data_files('webview')

# Hidden imports to ensure runtime imports are fully packaged
hiddenimports = [
    'edge_tts',
    'webview',
    'webview.platforms.winforms',
    'webview.platforms.edgechromium',
    'clr',
    'pythonnet',
    'aiohttp',
    'aiosignal',
    'certifi',
    'media_server',
]
hiddenimports += collect_submodules('edge_tts')
hiddenimports += collect_submodules('aiohttp')
hiddenimports += collect_submodules('webview')

a = Analysis(
    ['desktop_launcher.py'],
    pathex=[BASE_DIR],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='VoiceFlow Studio',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,  # Windowed desktop application (no console prompt)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='VoiceFlow Studio',
)
