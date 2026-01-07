@echo off
title LFS Live Map + Radio - Build Script

echo.
echo ============================================================
echo    LFS Live Map + Radio - Build Script
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

REM Check pkg
echo [INFO] Checking pkg...
call npm list -g pkg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Installing pkg globally...
    call npm install -g pkg
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] pkg installation failed!
        pause
        exit /b 1
    )
)

echo [OK] pkg is installed
echo.

REM Clean old build
if exist "dist\" (
    echo [INFO] Cleaning old build...
    rmdir /S /Q dist
)

REM Build
echo ============================================================
echo [INFO] Starting build...
echo ============================================================
echo.

call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo [SUCCESS] Build completed!
echo ============================================================
echo.
echo [INFO] Find the result in 'dist\' directory
echo [INFO] To run: dist\lfs-live-map-radio.exe
echo.

pause
