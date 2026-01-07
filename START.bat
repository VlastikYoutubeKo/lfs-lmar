@echo off
title LFS Live Map + Radio Server

echo.
echo ============================================================
echo    LFS Live Map + Radio - Starting Server
echo ============================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo [INFO] Download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

REM Check dependencies
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo.
)

echo [OK] Dependencies installed
echo.

REM Check MPV/VLC
where mpv >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MPV player found
    goto :audio_ok
)

where vlc >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] VLC player found
    goto :audio_ok
)

echo [WARNING] Neither MPV nor VLC found!
echo [INFO] Radio will not work without a media player
echo [INFO] Install MPV: choco install mpv
echo [INFO] Or VLC from: https://www.videolan.org/
echo.

:audio_ok

REM Check if Spotify setup is needed
if not exist "radio_config.json" goto :ask_spotify

REM Check if Spotify is already configured
findstr /C:"\"clientId\"" radio_config.json >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    findstr /C:"YOUR_SPOTIFY_CLIENT_ID_HERE" radio_config.json >nul 2>nul
    if %ERRORLEVEL% NEQ 0 goto :skip_spotify_setup
)

:ask_spotify
echo.
echo ============================================================
echo    Spotify Integration (Optional)
echo ============================================================
echo.
echo Would you like to set up Spotify integration?
echo This allows you to control Spotify playback from the app.
echo.
echo Requirements:
echo   - Spotify Premium account
echo   - 5 minutes to set up
echo.
set /p SPOTIFY_SETUP="Set up Spotify now? (Y/N): "

if /I "%SPOTIFY_SETUP%"=="Y" (
    call setup_spotify.bat
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Spotify setup was cancelled or failed
        echo [INFO] You can run setup_spotify.bat later to set it up
        pause
    )
)

:skip_spotify_setup
echo.
echo ============================================================
echo [INFO] Starting server...
echo [INFO] Press Ctrl+C to stop
echo.
echo [WEB] After starting, open: http://localhost:3000
echo [LFS] In LFS, type: /insim 29999
echo ============================================================
echo.

REM Start server
node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server failed!
    echo [INFO] Check the error message above
    pause
    exit /b 1
)

pause
