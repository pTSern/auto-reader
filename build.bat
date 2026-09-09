@echo off
setlocal enabledelayedexpansion
title VoiceFlow Studio - Auto Build Pipeline
cd /d "%~dp0"

echo ======================================================================
echo   VoiceFlow Studio - Automated Build Pipeline
echo   Cross-Platform Neural Audio Reader [Windows Desktop + Android]
echo ======================================================================
echo.

:: ---------------------------------------------------------------------
:: 1. Check Prerequisites: Node.js, NPM, and Python
:: ---------------------------------------------------------------------
echo [Step 1/5] Checking development tools and runtime environments...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please install Node.js v18 or higher from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] NPM is not installed or not found in PATH!
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python 3 is not installed or not found in PATH!
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
echo   - Node.js version : !NODE_VER!
echo   - Python version  : !PY_VER!
echo   - Tool check passed.
echo.

:: ---------------------------------------------------------------------
:: 2. Verify and Install Python Runtime Dependencies
:: ---------------------------------------------------------------------
echo [Step 2/5] Verifying Python runtime dependencies pywebview and edge-tts...

python -c "import webview, edge_tts" >nul 2>nul
if %errorlevel% neq 0 (
    echo   - Missing required Python packages. Installing via pip...
    python -m pip install --upgrade pip
    python -m pip install pywebview edge-tts
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Python dependencies!
        pause
        exit /b 1
    )
    echo   - Python packages installed successfully.
) else (
    echo   - Python dependencies verified: pywebview and edge-tts are ready.
)
echo.

:: ---------------------------------------------------------------------
:: 3. Install NPM Node Dependencies
:: ---------------------------------------------------------------------
echo [Step 3/5] Verifying NPM dependencies...
if not exist "node_modules" (
    echo   - node_modules folder not found. Running npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
) else (
    echo   - node_modules found. Updating and verifying dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)
echo   - Node dependencies are up to date.
echo.

:: ---------------------------------------------------------------------
:: 4. Build Production Bundle (TypeScript + Vite)
:: ---------------------------------------------------------------------
echo [Step 4/5] Compiling production build with Vite and TypeScript...

call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Production build failed during TypeScript compilation or Vite bundling!
    pause
    exit /b 1
)

if not exist "dist\index.html" (
    echo.
    echo [ERROR] dist\index.html was not generated!
    pause
    exit /b 1
)
echo   - Production bundle successfully generated in 'dist\'.
echo.

:: ---------------------------------------------------------------------
:: 5. Run Automated Build Verification Tests
:: ---------------------------------------------------------------------
echo [Step 5/5] Running automated verification tests...
python scripts\test_media_server.py >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Media server test failed. Running diagnostics...
    python scripts\test_media_server.py
)

python scripts\test_disk_audio.py >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Disk audio test failed. Running diagnostics...
    python scripts\test_disk_audio.py
)

echo   - Verification tests passed!
echo.

:: ---------------------------------------------------------------------
:: Build Complete Summary
:: ---------------------------------------------------------------------
echo ======================================================================
echo   SUCCESS: VoiceFlow Studio build completed successfully!
echo   Output Directory: %~dp0dist\
echo ======================================================================
echo.
echo You can now:
echo   1. Launch the standalone desktop app directly:
echo      python desktop_launcher.py
echo.
echo   2. Run the development environment with hot-reload:
echo      run.bat
echo.

if /i "%1"=="--no-launch" (
    echo Done. Build completed in non-interactive mode.
    exit /b 0
)
if /i "%1"=="--ci" (
    echo Done. Build completed in CI mode.
    exit /b 0
)

set "LAUNCH=Y"
set /p LAUNCH="Would you like to launch the built app now? [Y/N, default Y]: "
if /i "!LAUNCH!"=="N" (
    echo Done. You can launch anytime by running 'python desktop_launcher.py'.
    exit /b 0
)

echo Launching VoiceFlow Studio Desktop...
start "" python desktop_launcher.py
exit /b 0
