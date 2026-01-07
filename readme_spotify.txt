================================================================================
  SPOTIFY INTEGRATION - SETUP GUIDE
  LFS Live Map + Radio
================================================================================

The Spotify integration allows you to control your Spotify playback directly
from the radio interface and in-game InSim GUI. You can play/pause, skip
tracks, adjust volume, and see what's currently playing.

================================================================================
  PREREQUISITES
================================================================================

1. A Spotify Premium account (required for Spotify Web API playback control)
2. A Spotify Developer application (free to create)

================================================================================
  STEP 1: CREATE A SPOTIFY DEVELOPER APPLICATION
================================================================================

1. Go to https://developer.spotify.com/dashboard

2. Log in with your Spotify account

3. Click "Create app" button

4. Fill in the app details:
   - App name: "LFS Radio" (or any name you like)
   - App description: "Live For Speed radio integration"
   - Redirect URI: http://127.0.0.1:3000/spotify/callback
   - Which API/SDKs are you planning to use: Select "Web API"

5. Check the Terms of Service agreement box

6. Click "Save"

7. You'll see your new app's dashboard. Click "Settings" button

8. Copy your "Client ID" and "Client Secret" (click "View client secret")
   - Keep these safe - you'll need them in the next step

================================================================================
  STEP 2: CONFIGURE LFS RADIO
================================================================================

1. Open the file: radio_config.json

2. Find the "spotify" section (or add it if it doesn't exist):

   "spotify": {
     "enabled": false,
     "clientId": "YOUR_SPOTIFY_CLIENT_ID_HERE",
     "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET_HERE",
     "accessToken": null,
     "refreshToken": null,
     "tokenExpiry": null
   }

3. Replace YOUR_SPOTIFY_CLIENT_ID_HERE with your Client ID from Step 1

4. Replace YOUR_SPOTIFY_CLIENT_SECRET_HERE with your Client Secret from Step 1

5. Change "enabled" from false to true:

   "enabled": true,

6. Save the file

================================================================================
  STEP 3: AUTHENTICATE WITH SPOTIFY
================================================================================

1. Start the LFS Radio server:
   - Run: START.bat (or RUN.bat if using the portable version)
   - Or run: node server.js

2. Open your web browser and go to:
   http://localhost:3000/radio.html

3. You should see a Spotify section with a "Connect Spotify" button

4. Click "Connect Spotify"

5. You'll be redirected to Spotify's login page

6. Log in and authorize the app

7. You'll be redirected back to a success page

8. Close that page and return to the radio interface

9. The Spotify controls should now be active!

================================================================================
  STEP 4: VERIFY IT'S WORKING
================================================================================

1. Start playing something on Spotify (desktop app, phone, web player, etc.)

2. In the radio interface, you should see:
   - Current track name
   - Artist name
   - Album artwork (if available)

3. Try the controls:
   - Play/Pause button
   - Next/Previous track buttons
   - Volume slider (controls Spotify volume)

4. In-game controls:
   - Open the radio GUI in LFS
   - You should see Spotify controls there too

================================================================================
  TROUBLESHOOTING
================================================================================

Q: I get "Authentication Failed" when trying to connect
A: Make sure your Client ID and Client Secret are correct in radio_config.json
   Also ensure the Redirect URI in your Spotify app settings is exactly:
   http://127.0.0.1:3000/spotify/callback

Q: Spotify controls don't work
A: You need a Spotify Premium account. The Free tier doesn't support
   Web API playback control.

Q: I see "No active device"
A: Start playing something on any Spotify client first (desktop app, phone,
   web player, etc.). The Web API can only control active devices.

Q: The connection expired
A: The access token is automatically refreshed. If you keep getting this
   error, try disconnecting and re-authenticating (Steps 3-4).

Q: Can I disable Spotify integration?
A: Yes! Either:
   - Set "enabled": false in radio_config.json, OR
   - Use the toggle switch in the radio interface

================================================================================
  USING SPOTIFY WITH LFS RADIO
================================================================================

RADIO WEB INTERFACE (http://localhost:3000/radio.html):
- Spotify section shows current track info
- Play/Pause button
- Previous/Next track buttons
- Volume slider (0-100%)
- Enable/Disable toggle

IN-GAME INSIM GUI:
- Access via InSim buttons in LFS
- Basic playback controls (Play, Pause, Next, Previous)
- Now playing info ticker

TIPS:
- You can use both internet radio AND Spotify controls simultaneously
- Radio volume and Spotify volume are independent
- The app remembers your auth tokens - you only need to authenticate once
- Tokens are automatically refreshed when needed

================================================================================
  SECURITY & PRIVACY
================================================================================

- Your Spotify credentials are stored locally in radio_config.json
- Access tokens are encrypted by Spotify and automatically refreshed
- No data is sent to any third-party servers except Spotify's official API
- The Client Secret should be kept private (don't share your config file)

================================================================================
  ADDITIONAL RESOURCES
================================================================================

Spotify Web API Documentation:
https://developer.spotify.com/documentation/web-api

Spotify Developer Dashboard:
https://developer.spotify.com/dashboard

LFS Radio GitHub Issues:
https://github.com/VlastikYoutubeKo/lfs-lmar/issues

================================================================================
  CREDITS
================================================================================

Spotify integration built using Spotify Web API
Live For Speed: www.lfs.net

Enjoy your music while racing!
================================================================================
