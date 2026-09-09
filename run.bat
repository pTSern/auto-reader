@echo off
title VoiceFlow Studio
cd /d "%~dp0"

echo ===================================================
echo   VoiceFlow Studio - PDF & Text to Audio Reader
echo   1 Build Everywhere (Windows Desktop + Android)
echo ===================================================
echo.

if not exist "node_modules" (
    echo [1/3] Installing NPM dependencies...
    call npm install
    if errorlevel 1 (
        echo Error installing dependencies.
        pause
        exit /b 1
    )
)

echo [2/3] Starting VoiceFlow Studio server...
start /b cmd /c "npm run dev"

echo Waiting for local server to be ready...
timeout /t 3 /nobreak >nul

echo [3/3] Launching Windows Desktop Application...
where python >nul 2>nul
if %errorlevel% equ 0 (
    python desktop_launcher.py "http://localhost:5173"
) else (
    start http://localhost:5173
)

echo Done.
