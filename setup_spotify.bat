@echo off
setlocal enabledelayedexpansion
title Spotify Integration Setup Wizard

echo.
echo ============================================================
echo    Spotify Integration Setup Wizard
echo ============================================================
echo.
echo This wizard will help you set up Spotify integration.
echo.
echo Requirements:
echo   - Spotify Premium account
echo   - Spotify Developer account (free)
echo.
pause

echo.
echo ============================================================
echo    Step 1: Create Spotify Developer App
echo ============================================================
echo.
echo 1. Open: https://developer.spotify.com/dashboard
echo 2. Log in with your Spotify account
echo 3. Click "Create app"
echo 4. Fill in:
echo    - App name: LFS Radio (or any name)
echo    - App description: Live For Speed radio integration
echo    - Redirect URI: http://127.0.0.1:3000/spotify/callback
echo    - Select "Web API"
echo 5. Check Terms of Service and click "Save"
echo 6. Click "Settings" to view your credentials
echo.
echo Opening Spotify Developer Dashboard...
start https://developer.spotify.com/dashboard
echo.
pause

echo.
echo ============================================================
echo    Step 2: Enter Your Spotify Credentials
echo ============================================================
echo.
echo Please enter your Spotify app credentials:
echo.

set /p CLIENT_ID="Spotify Client ID: "
if "!CLIENT_ID!"=="" (
    echo [ERROR] Client ID cannot be empty!
    pause
    exit /b 1
)

echo.
set /p CLIENT_SECRET="Spotify Client Secret: "
if "!CLIENT_SECRET!"=="" (
    echo [ERROR] Client Secret cannot be empty!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo    Step 3: Updating Configuration
echo ============================================================
echo.

REM Check if radio_config.json exists
if not exist "radio_config.json" (
    echo [INFO] Creating radio_config.json from example...
    if exist "radio_config.example.json" (
        copy radio_config.example.json radio_config.json >nul
    ) else (
        echo [ERROR] radio_config.example.json not found!
        pause
        exit /b 1
    )
)

REM Create a temporary Node.js script to update the JSON (using .cjs for CommonJS)
echo const fs = require('fs'); > update_config_temp.cjs
echo const config = JSON.parse(fs.readFileSync('radio_config.json', 'utf8')); >> update_config_temp.cjs
echo if (!config.spotify) config.spotify = {}; >> update_config_temp.cjs
echo config.spotify.enabled = true; >> update_config_temp.cjs
echo config.spotify.clientId = process.argv[2]; >> update_config_temp.cjs
echo config.spotify.clientSecret = process.argv[3]; >> update_config_temp.cjs
echo config.spotify.accessToken = null; >> update_config_temp.cjs
echo config.spotify.refreshToken = null; >> update_config_temp.cjs
echo config.spotify.tokenExpiry = null; >> update_config_temp.cjs
echo fs.writeFileSync('radio_config.json', JSON.stringify(config, null, 2)); >> update_config_temp.cjs
echo console.log('[OK] Configuration updated successfully!'); >> update_config_temp.cjs

node update_config_temp.cjs "!CLIENT_ID!" "!CLIENT_SECRET!"
del update_config_temp.cjs

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to update configuration!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo    Step 4: Authentication
echo ============================================================
echo.
echo Spotify integration is now configured!
echo.
echo To complete setup:
echo 1. Start the server (it will start after this wizard)
echo 2. Open: http://127.0.0.1:3000/radio.html
echo 3. Scroll down to the Spotify panel
echo 4. Click "Connect to Spotify"
echo 5. Authorize the app in the popup window
echo.
echo Once authenticated, you can control Spotify from:
echo   - Web interface: http://127.0.0.1:3000/radio.html
echo   - In-game: Radio GUI ^> Page 2 (Spotify)
echo.
echo ============================================================
echo    Setup Complete!
echo ============================================================
echo.
echo Spotify integration is now enabled and configured.
echo The server will start automatically...
echo.
pause

exit /b 0
