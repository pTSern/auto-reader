@echo off
setlocal enabledelayedexpansion
title VoiceFlow Studio - Release Packaging Pipeline
cd /d "%~dp0"

echo ======================================================================
echo   VoiceFlow Studio - Release Packaging Pipeline
echo   Creates Standalone Windows Executable ^& Distributable Zip
echo ======================================================================
echo.

:: 1. Check Node.js and Python
echo [1/5] Checking build dependencies...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required to compile frontend assets!
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python 3 is required to package release!
    pause
    exit /b 1
)

:: 2. Ensure PyInstaller is installed
echo [2/5] Checking PyInstaller...
python -m PyInstaller --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] PyInstaller not found. Installing via pip...
    python -m pip install pyinstaller
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install PyInstaller.
        pause
        exit /b 1
    )
)

:: 3. Build production web frontend
echo.
echo [3/5] Compiling production frontend (dist/)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend compilation failed!
    pause
    exit /b 1
)

:: 4. Build standalone Windows application with PyInstaller
echo.
echo [4/5] Packaging standalone Windows executable with PyInstaller...
python -m PyInstaller VoiceFlowStudio.spec --distpath release --workpath build_pyinstaller --noconfirm --clean
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller packaging failed!
    pause
    exit /b 1
)

:: 5. Create distributable ZIP archive
echo.
echo [5/5] Creating distributable ZIP package...
if exist "release\VoiceFlow-Studio-Windows-x64.zip" del /f /q "release\VoiceFlow-Studio-Windows-x64.zip"
powershell -NoProfile -Command "Compress-Archive -Path 'release\VoiceFlow Studio\*' -DestinationPath 'release\VoiceFlow-Studio-Windows-x64.zip' -Force"

echo.
echo ======================================================================
echo   SUCCESS: Release package created successfully!
echo ======================================================================
echo   Executable directory: release\VoiceFlow Studio\
echo   Executable file:      release\VoiceFlow Studio\VoiceFlow Studio.exe
echo   Distributable Zip:    release\VoiceFlow-Studio-Windows-x64.zip
echo.
echo   Users can unzip 'VoiceFlow-Studio-Windows-x64.zip' anywhere and run
echo   'VoiceFlow Studio.exe' directly without installing Node or Python!
echo ======================================================================
pause
