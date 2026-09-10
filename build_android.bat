@echo off
setlocal enabledelayedexpansion
title VoiceFlow Studio - Android Build Pipeline
cd /d "%~dp0"

echo ======================================================================
echo   VoiceFlow Studio - Android Build Pipeline (Capacitor)
echo ======================================================================
echo.

:: 1. Compile web frontend
echo [1/3] Compiling web frontend (dist/)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

:: 2. Sync to native Android project
echo.
echo [2/3] Syncing web assets to Android project...
call npx cap sync android
if %errorlevel% neq 0 (
    echo [ERROR] Capacitor sync failed!
    pause
    exit /b 1
)

:: 3. Instructions & Build
echo.
echo [3/3] Android project is synced and ready!
echo.
echo ----------------------------------------------------------------------
echo  Ways to generate your installable APK:
echo ----------------------------------------------------------------------
echo  1. Android Studio (Recommended):
echo     Run: npx cap open android
echo     Then select: Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo.
echo  2. Automated Cloud Build (GitHub Actions - Zero local SDK needed!):
echo     Push to GitHub. The '.github/workflows/build-android.yml' workflow
echo     will compile the APK and provide a direct download artifact.
echo.
echo  3. Command-Line (Requires JDK 17+ and ANDROID_HOME set):
echo     cd android ^&^& gradlew.bat assembleDebug
echo ======================================================================
pause
