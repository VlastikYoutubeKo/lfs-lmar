# 🚀 Quick Start Guide

## Download & Install (5 minutes)

### 1. Download
Get the latest release from [GitHub Releases](https://github.com/YOUR_USERNAME/lfs-live-map-radio/releases)

Download: `LFS-LiveMap-Radio-vX.X.X.zip`

### 2. Extract
Unzip to any folder (e.g., `C:\LFS-Radio\`)

### 3. (Optional) Install Audio Player
For radio functionality, install one of:

**MPV (Recommended):**
```bash
choco install mpv
```
Or download from: https://mpv.io/installation/

**VLC Alternative:**
Download from: https://www.videolan.org/

### 4. Run
Double-click `lfs-live-map-radio.exe` or `RUN.bat`

### 5. Connect LFS
In Live For Speed, type:
```
/insim 29999
```

### 6. Open Map
In your browser, go to:
```
http://localhost:3000
```

**That's it! 🎉**

---

## First Time Setup

### In LFS - Radio GUI:
1. Click the **[R]** icon in top-right corner
2. Choose your favorite stations
3. Adjust volume with +/- buttons
4. Click station name to play

### In Browser - Live Map:
1. Zoom with **mouse wheel** or +/- buttons
2. **Drag** to pan
3. Click **player name** to follow
4. Open **hamburger menu** (☰) for player list

---

## Common Commands

| Command | Action |
|---------|--------|
| `/insim 29999` | Connect to InSim |
| `/o gui` | Restore radio GUI |
| `/o np` | Show Now Playing overlay |

---

## Troubleshooting

### Radio doesn't play
- Check if MPV or VLC is installed
- Try: `mpv --version` in Command Prompt
- Restart the application

### GUI disappeared
- Type `/o gui` in LFS
- Or respawn your car (Shift+P, then drive again)

### Map not loading
- Check browser console (F12)
- Make sure `public/tracks/` folder exists
- Verify port 3000 is not blocked

### Can't connect InSim
- Check LFS is running
- Verify port 29999 is free
- Try `/insim 29999` again

---

## Next Steps

- 📖 Read full [README.md](README.md)
- 🎮 Try following different players on the map
- 🎵 Search for your favorite radio stations
- ⭐ Star us on GitHub if you like it!

---

**Need more help?**
- Open an issue: https://github.com/YOUR_USERNAME/lfs-live-map-radio/issues
- Check discussions: https://github.com/YOUR_USERNAME/lfs-live-map-radio/discussions
