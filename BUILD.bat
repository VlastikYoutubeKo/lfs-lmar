@echo off
title LFS Live Map + Radio - Build Script

echo.
echo ============================================================
echo    LFS Live Map + Radio - Build Script
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

REM Kontrola pkg
echo [INFO] Kontroluji pkg...
call npm list -g pkg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Instaluji pkg globally...
    call npm install -g pkg
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Instalace pkg selhala!
        pause
        exit /b 1
    )
)

echo [OK] pkg je nainstalovan
echo.

REM Vyčištění starého build
if exist "dist\" (
    echo [INFO] Cistim stary build...
    rmdir /S /Q dist
)

REM Build
echo ============================================================
echo [INFO] Spoustim build...
echo ============================================================
echo.

call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build selhal!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo [SUCCESS] Build dokoncen!
echo ============================================================
echo.
echo [INFO] Vysledek najdes v adresari 'dist\'
echo [INFO] Pro spusteni pouzij: dist\lfs-live-map-radio.exe
echo.

pause
