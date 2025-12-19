# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LFS Live Map + Radio is a Live For Speed (LFS) InSim application that combines:
- Real-time map visualization of all players on a server
- Integrated internet radio with 30,000+ stations
- TC (City Driving) integration with mission tracking and GPS logging
- In-game GUI controls via InSim protocol

The application is packaged as a standalone Windows executable using Node.js SEA (Single Executable Application).

## Commands

### Development
```bash
npm start              # Start server
npm run dev            # Start with auto-reload (--watch)
npm run build          # Build standalone executable
```

### Command-Line Switches
```bash
node server.js --cop          # Force COP mode (hides suspects, shows cops)
node server.js --debug        # Enable verbose API logging
node server.js --map-logger   # Enable GPS location logger for TC API
```

### Testing
- Start server: `npm start`
- Connect LFS: `/insim 29999` in LFS chat
- Open browser: `http://localhost:3000`
- Radio web interface: `http://localhost:3000/radio.html`

### Build System
```bash
BUILD.bat              # Windows build launcher
npm run prebuild       # Pre-build validation
npm run build:pkg      # Package to executable
```

## Architecture

### Server-Side Architecture (server.js)

The main server file handles three concurrent systems:

1. **InSim Connection** (port 29999)
   - Uses `node-insim` library for LFS InSim protocol
   - Receives car position packets (IS_MCI, IS_NLP)
   - Manages InSim GUI buttons using `react-node-insim`
   - Tracks player states in `playerStates` Map

2. **Map WebSocket Server** (port 3000)
   - HTTP server serves static files from `public/`
   - WebSocket broadcasts car positions to web clients
   - Filters players by role (CIVILIAN/COP) based on TC API data
   - Updates at real-time based on InSim packets

3. **Radio WebSocket Server** (port 3001)
   - Separate WebSocket for radio control
   - Manages MPV player process for audio streaming
   - Uses IPC socket to communicate with MPV
   - Handles metadata fetching from Abradia.cz API

### TC API Integration (TC = City Driving)

**TC API** provides real-time game state for the TC (The Cops and Robbers) servers:
- Player roles (COP/ROBBER/CIVILIAN)
- Active missions and destinations
- GPS coordinates for locations
- Chase status and wanted levels

**Key Files:**
- `tc_locations.js` - Auto-generated location database (296 locations)
- `tc_locations_generated.js` - Generated output file
- `gps_logger.js` - Automatic location discovery system
- Uses `--map-logger` flag to automatically map new locations while playing

**How GPS Logger Works:**
When a player accepts a mission, the system:
1. Parses destination from InSim message
2. Fetches GPS coordinates from TC API
3. Stores location with emoji auto-detection
4. Builds comprehensive location database
5. Generates JavaScript module for frontend

### Frontend Architecture

**Map Interface** (`public/index.html`):
- HTML5 Canvas for rendering
- Loads track images from `public/tracks/` (9 tracks)
- Coordinate transformation using `track_configs.js`
- WebSocket client for real-time updates
- Search functionality for players and TC locations
- Mobile-optimized with touch controls

**Track Coordinate System:**
- LFS uses integer coordinates (65536 units per meter)
- Track configs define bounds and pixel mappings
- Format: `{ minX, maxX, minY, maxY, imgWidth, imgHeight }`
- Tracks: AS, AU, BL, FE, KY, LA, RO, SO, WE

**Radio Interface** (`public/radio.html`):
- Sony DSX-M80 inspired UI design
- Radio Browser API integration
- Abradia.cz Czech stations with metadata
- Favorites and recent stations stored in `radio_config.json`

### InSim GUI System

Uses `react-node-insim` for declarative button management:
- Button IDs defined as constants (e.g., `BTN_ICON`, `BTN_SEARCH`)
- State management via `playerStates` Map keyed by UCID
- Multi-page navigation with 7 stations per page
- Automatic GUI watchdog refreshes every 3 seconds
- Text encoding handles LFS special characters (CP1252, codepage switching)

### Audio Playback

**MPV Player Control:**
- Spawns MPV process with `--input-ipc-server` for control
- JSON IPC protocol over named pipe (Windows) or socket (Linux)
- Volume control via IPC commands
- Metadata extraction from stream (ICY tags)
- Fallback to VLC if MPV unavailable

**Metadata Providers** (`metadata_providers.js`):
- Abradia.cz API for Czech stations (real-time now playing)
- Generic ICY metadata for other streams
- Artist/title parsing and cleanup

### Build System

**Native Node.js SEA Build** (`build.js`):
1. Cleans `dist/` directory
2. Creates SEA configuration with all assets
3. Compiles to native executable with Node.js bundled
4. Copies public assets and config files
5. Generates launchers (START.bat, RUN.bat)

**Pre-build Validation** (`prebuild.js`):
- Checks Node.js version >= 21
- Verifies all 9 track PNG files exist
- Ensures required source files present
- Creates default config if missing

**Post-build Packaging** (`postbuild.js`):
- Verifies executable exists and size
- Counts track files (must be 9)
- Generates BUILD_INFO.json metadata
- Creates portable launcher scripts

### GitHub Actions Workflow

**Automated Releases** (`.github/workflows/build-release.yml`):
- Triggers on version tags (`v*`) or manual dispatch
- Windows runner for native build
- Gemini API integration for AI-generated release notes
- Analyzes git commits and diff stats
- Creates GitHub Release with ZIP package
- **Important:** Uses secrets: `GEMINI_API_KEY`, `GITHUB_TOKEN`

## Critical Implementation Details

### LFS Text Encoding

LFS uses custom codepage switching with `^L`, `^G`, `^J` prefixes for Unicode characters. The `convertLFSText()` function handles:
- CP1252 to UTF-8 mapping
- Special character detection (bullets, stars, quotation marks)
- Automatic codepage insertion for proper display

### Coordinate Transformation

Converting LFS coordinates to map pixels requires:
1. Convert from integer units to meters: `x / 65536`
2. Apply track-specific bounds from `track_configs.js`
3. Map to pixel coordinates with proper scaling
4. Handle coordinate origin differences per track

### Player Role Detection

When `--cop` mode is active:
- Local player is treated as COP
- Map shows only CIVILIAN and COP players
- ROBBER/SUSPECT players are hidden
- Uses TC API `/player/{username}` endpoint for role data

### State Management

Multiple state stores:
- `cars` Map: InSim car data keyed by PLID
- `playerStates` Map: GUI state keyed by UCID
- `radio_config.json`: Persistent user preferences
- `discovered_locations.json`: GPS logger database

### WebSocket Protocol

**Map Updates:**
```json
{ "type": "track", "track": "BL1", "layout": "" }
{ "type": "positions", "cars": [{ "plid": 1, "name": "Player", "x": 100, "y": 200, "z": 5, "speed": 50, "heading": 90 }] }
```

**Radio Control:**
```json
{ "type": "play", "url": "...", "name": "Station" }
{ "type": "stop" }
{ "type": "volume", "level": 75 }
```

## Important Notes

### File Structure Assumptions
- Track images must be named `track_XX.png` where XX is track code
- `public/` directory must be preserved in builds (SEA assets)
- Config file created on first run if missing

### Platform-Specific Code
- MPV path detection searches common Windows locations
- Named pipes vs Unix sockets for IPC
- `taskkill` for Windows process management
- Path separators handled via `path.join()`

### Performance Considerations
- GUI watchdog runs every 3 seconds (reduce for performance)
- Position updates throttled by InSim packet rate
- WebSocket broadcasts only changed data
- GPS logger auto-saves every 10 seconds

### External Dependencies
- Requires MPV or VLC for audio (not bundled)
- TC API at `world.city-driving.co.uk/api/v2/json`
- Radio Browser API for station search
- Abradia.cz API for Czech station metadata

## Common Development Tasks

### Adding a New Track
1. Add PNG file to `public/tracks/track_XX.png`
2. Define bounds in `public/track_configs.js`:
   ```javascript
   XX: { minX: ..., maxX: ..., minY: ..., maxY: ..., imgWidth: ..., imgHeight: ... }
   ```
3. Update track count validation in `prebuild.js` (currently expects 9)
4. Add track name to `track_names.js`

### Adding a Radio Source
1. Create API client file (e.g., `newapi_api.js`)
2. Export async functions: `searchStations()`, `getNowPlaying()`
3. Add handler in `server.js` radio WebSocket message handler
4. Update InSim GUI categories if needed

### Debugging InSim Issues
- Enable debug mode: `node server.js --debug`
- Check InSim connection: Look for `[InSim] Connected` log
- GUI not showing: Use `/o gui` command in LFS
- Button overlaps: Check button ID constants are unique

### Working with TC API
- Enable GPS logger: `node server.js --map-logger`
- Location data saved to `discovered_locations.json`
- Run `node parse.js` to convert to `tc_locations_generated.js`
- Emoji icons auto-detected from location names

## Release Process

1. Commit all changes
2. Update version: `npm version patch|minor|major`
3. Push with tags: `git push origin main --tags`
4. GitHub Actions automatically builds and creates release
5. ZIP file uploaded to GitHub Releases with AI-generated notes

## Notes from Existing Documentation

From BUILD_SYSTEM.md: The build creates ~50MB executable with Node.js runtime bundled. No installation required - fully portable.

From CONTRIBUTING.md: Use ES modules (import/export), async/await patterns, and meaningful variable names. Keep commits focused on single changes.
