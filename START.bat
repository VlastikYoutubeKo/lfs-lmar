@echo off
title LFS Live Map + Radio Server

echo.
echo ============================================================
echo    LFS Live Map + Radio - Spousteni serveru
echo ============================================================
echo.

REM Kontrola Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js neni nainstalovany!
    echo [INFO] Stahni z: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js nalezen
node --version
echo.

REM Kontrola dependencies
if not exist "node_modules\" (
    echo [INFO] Instaluji dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install selhal!
        pause
        exit /b 1
    )
    echo.
)

echo [OK] Dependencies nainstalovany
echo.

REM Kontrola MPV/VLC
where mpv >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] MPV prehravac nalezen
    goto :audio_ok
)

where vlc >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] VLC prehravac nalezen
    goto :audio_ok
)

echo [WARNING] MPV ani VLC nenalezeny!
echo [INFO] Radio nebude fungovat bez prehravace
echo [INFO] Nainstaluj MPV: choco install mpv
echo [INFO] Nebo VLC z: https://www.videolan.org/
echo.

:audio_ok
echo.
echo ============================================================
echo [INFO] Spoustim server...
echo [INFO] Pro ukonceni stiskni Ctrl+C
echo.
echo [WEB] Po spusteni otevri: http://localhost:3000
echo [LFS] V LFS zadej: /insim 29999
echo ============================================================
echo.

REM Spust server
node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server selhal!
    echo [INFO] Zkontroluj chybovou hlasku vyse
    pause
    exit /b 1
)

pause
