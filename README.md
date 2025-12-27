# 🏁 LFS Live Map + Radio v0.0.7_ML

Live For Speed InSim application combining a real-time server map with an integrated internet radio player.

## 📦 Releases

Download the latest version from the [Releases page](https://github.com/VlastikYoutubeKo/lfs-lmar/releases).

## ✨ Features

- **Live Map** - Real-time positioning of all players on the server
- **9 Supported Tracks** - Blackwood, South City, Fern Bay, Aston, Kyoto, Westhill, Autocross, Rockingham, Layout Square
- **Internet Radio** - 30,000+ international stations + Czech stations (Abradia.cz)
- **InSim GUI** - Control the radio directly inside LFS
- **Metadata** - "Now Playing" overlay with song info
- **Multilingual** - English / Czech support
- **Player Tracking** - Click on a player in the list to auto-follow camera

## 🚀 Quick Start

This application runs on Node.js.

### Prerequisites
- **Node.js** (Version 18 or newer): [Download Here](https://nodejs.org/)
- **MPV Player** (Recommended for Radio): `choco install mpv` (or add to PATH)

### Installation
1. **Download the latest ZIP** from [Releases](https://github.com/VlastikYoutubeKo/lfs-lmar/releases)
2. **Extract** the ZIP content to a folder.
3. **Double-click `START.bat`** to launch the server.
4. **In LFS chat, type:** `/insim 29999`
5. **Open browser:** `http://localhost:3000`

## 🛠️ Development Setup

```bash
# 1. Clone repo
git clone https://github.com/VlastikYoutubeKo/lfs-lmar.git
cd lfs-live-map-radio

# 2. Install dependencies
npm install

# 3. Run dev server
npm start

```

## 📖 Usage Guide

### InSim GUI Commands:

* `/o gui` - Reset GUI if it disappears
* `/o np` - Show "Now Playing" overlay manually

### Radio GUI:

1. **Click the [R] icon** in the top-right corner of LFS screen
2. **Select Category:** Favorites, Recent, Abradia.cz, or Search.
3. **Volume Control:** +/- buttons
4. **Language:** Switch between EN/CZ

### Web Map:

* **Zoom:** Mouse wheel or +/- buttons
* **Pan:** Click and drag
* **Reset View:** Home button (⌂)
* **Follow Player:** Click player name in the sidebar list

## 🎮 LFS Configuration

### Manual Connection:

If the app doesn't connect automatically, type this in LFS:

```
/insim 29999

```

## 📁 Project Structure

```
lfs-live-map-radio/
├── server.js              # Main server logic
├── START.bat              # Launcher script
├── public/                # Web interface files
├── radio_browser.js       # Radio API
├── abradia_api.js         # Czech Radio API
└── .github/workflows/     # CI/CD

```

## 🔧 Tech Stack

* **Node.js** - Runtime
* **node-insim** - LFS InSim protocol
* **WebSocket** - Real-time communication
* **Canvas API** - Map rendering
* **MPV** - Audio playback

## 📝 Configuration

The `radio_config.json` file is generated automatically on the first run.

```json
{
  "favorites": [],
  "recent": [],
  "lang": "en"
}

```

## 🐛 Troubleshooting

### "Node is not recognized"

* Ensure you have installed Node.js from [nodejs.org](https://nodejs.org/).
* Restart your computer after installation.

### Radio not playing

* Install MPV player and ensure it is in your system PATH.
* - Use choco `choco install mpv`

### Map not loading

* Check the browser console (F12) for errors.
* Ensure port 3000 is not used by another application.

## 📜 License

MIT License - Vlastimil © 2025

## 📧 Contact

* GitHub Issues: [Report Bug](https://github.com/VlastikYoutubeKo/lfs-lmar/issues)

---

**Made with ❤️ for the Live For Speed Community**







