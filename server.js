// LFS InSim Live Map + Radio Server - PRODUCTION VERSION
// Usage: node server.js [--cop] [--debug]

import { InSim } from 'node-insim';
import { WebSocketServer } from 'ws';
import { PacketType, InSimFlags, ButtonStyle, IS_BTN, IS_BFN, IS_TINY, IS_MSO, TinyType, UserType, IS_ISI_ReqI } from 'node-insim/packets';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';
import net from 'net'; 
import { getTrackName } from './track_names.js';
import { 
  initRadioBrowser, 
  searchStationsByName, 
  voteForStation 
} from './radio_browser.js';
import { 
  getAbradiaStations, 
  prepareAbradiaStation,
  getAbradiaNowPlaying
} from './abradia_api.js';
import {
  parseMissionDestination,
  getDestinationCoords,
  calculateDistance,
  calculateETA,
  formatTime
} from './tc_locations.js';
import {
  loadExistingLocations,
  processApiData,
  setupGracefulShutdown,
  printStats
} from './gps_logger.js';
import {
  initLocalMusic,
  getLocalMusicFiles,
  getPlaylists,
  refreshLocalMusic
} from './local_music_addon.js';
  await initLocalMusic(); // přidej await
// === SWITCHES ===
const FORCE_COP_MODE = process.argv.includes('--cop');   // Forces local player to be COP (sees cops, hides suspects)
const ENABLE_DEBUG = process.argv.includes('--debug');   // Shows verbose API logs
const ENABLE_GPS_LOGGER = process.argv.includes('--map-logger');   // GPS location logger

// === ANSI COLORS ===
const colors = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

// === TC API CONFIG ===
const TC_API_BASE = 'https://world.city-driving.co.uk/api/v2/json';

// === GPS LOGGER INITIALIZATION ===
if (ENABLE_GPS_LOGGER) {
  console.log(`${colors.green}[GPS Logger]${colors.reset} Active! Mapping locations automatically...`);
  loadExistingLocations();
  setupGracefulShutdown();
  setInterval(printStats, 60000);
}

// === LFS CODEPAGE SUPPORT ===
const CP1252_UTF8_MAP = { '\u0095': '•', '\u008B': '‹', '\u009B': '›', '\u0099': '™' };
const SPECIAL_CHARS_MAP = {
  '•': { char: '•', codepoint: 0x2022, codepage: 'G', name: 'BULLET' },
  '○': { char: '○', codepoint: 0x25CB, codepage: 'J', name: 'WHITE CIRCLE' },
  '●': { char: '●', codepoint: 0x25CF, codepage: 'J', name: 'BLACK CIRCLE' },
  '★': { char: '★', codepoint: 0x2605, codepage: 'J', name: 'BLACK STAR' },
  '☆': { char: '☆', codepoint: 0x2606, codepage: 'J', name: 'WHITE STAR' },
  '›': { char: '›', codepoint: 0x203A, codepage: 'L', name: 'SINGLE RIGHT ANGLE QUOTATION' },
  '‹': { char: '‹', codepoint: 0x2039, codepage: 'L', name: 'SINGLE LEFT ANGLE QUOTATION' }
};

function fixCP1252Encoding(text) {
  let fixed = text;
  for (const [wrongChar, correctChar] of Object.entries(CP1252_UTF8_MAP)) {
    fixed = fixed.replace(new RegExp(wrongChar, 'g'), correctChar);
  }
  return fixed;
}

function convertLFSText(text) {
  if (!text) return text;
  text = fixCP1252Encoding(text);
  let result = '';
  let currentCodepage = 'L';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charCode = char.charCodeAt(0);
    if (charCode < 128) { result += char; continue; }
    if (char === '^' && i + 1 < text.length) { result += char + text[i + 1]; i++; continue; }
    
    const specialChar = SPECIAL_CHARS_MAP[char];
    if (specialChar) {
      if (specialChar.codepage !== currentCodepage) { result += '^' + specialChar.codepage; currentCodepage = specialChar.codepage; }
      result += char; continue;
    }
    
    if (charCode >= 128 && charCode <= 255) {
      if (currentCodepage !== 'L') { result += '^L'; currentCodepage = 'L'; }
      result += char;
    } else {
      if (currentCodepage !== 'G') { result += '^G'; currentCodepage = 'G'; }
      result += char;
    }
  }
  return result;
}

// === TRANSLATIONS ===
const TRANSLATIONS = {
    en: {
        GUI_TITLE: "^5 RADIO PLAYER",
        BTN_FAVORITES: "FAVORITES",
        BTN_RECENT: "RECENTLY PLAYED",
        BTN_ABRADIA: "ABRADIA.CZ",
        BTN_SEARCH: "SEARCH",
        BTN_LOCAL_MUSIC: "LOCAL MUSIC",
        BTN_PLAYLISTS: "PLAYLISTS",
        BTN_LANG: "LANG: ENGLISH",
        STATUS_STOPPED: "^1Stopped",
        BTN_STOP: "STOP",
        BTN_CLOSE: "CLOSE",
        BTN_BACK: "<< BACK",
        SEARCH_PLACEHOLDER: "^8Click to type name...",
        NO_ITEMS: "^1No items found",
        TITLE_FAV: "^3 FAVORITES",
        TITLE_RECENT: "^6 RECENT",
        TITLE_ABRADIA: "^4 ABRADIA.CZ",
        TITLE_RESULTS: "^2 RESULTS",
        TITLE_SEARCH: "^3 SEARCH",
        TITLE_LOCAL_MUSIC: "^2 LOCAL MUSIC",
        TITLE_PLAYLISTS: "^6 PLAYLISTS",
        OVERLAY_HEADER: "^5 NOW PLAYING",
        OVERLAY_PROGRAM: "^6Program: ^7",
        MSG_GUI_RESET: "/o gui - GUI Reset",
        MSG_NP_SHOW: "/o np - Overlay shown",
        MSG_NP_EMPTY: "/o np - Nothing playing"
    },
    cz: {
        GUI_TITLE: "^5 RADIO PREHRAVAC",
        BTN_FAVORITES: "OBLÍBENÉ",
        BTN_RECENT: "NEDÁVNÉ",
        BTN_ABRADIA: "ABRADIA.CZ",
        BTN_SEARCH: "HLEDAT",
        BTN_LOCAL_MUSIC: "LOKÁLNÍ HUDBA",
        BTN_PLAYLISTS: "PLAYLISTY",
        BTN_LANG: "JAZYK: ČEŠTINA",
        STATUS_STOPPED: "^1Zastaveno",
        BTN_STOP: "STOP",
        BTN_CLOSE: "ZAVŘÍT",
        BTN_BACK: "<< ZPĚT",
        SEARCH_PLACEHOLDER: "^8Klikni a napiš název...",
        NO_ITEMS: "^1Žádné položky",
        TITLE_FAV: "^3 OBLÍBENÉ",
        TITLE_RECENT: "^6 NEDÁVNÉ",
        TITLE_ABRADIA: "^4 ABRADIA.CZ",
        TITLE_RESULTS: "^2 VÝSLEDKY",
        TITLE_SEARCH: "^3 VYHLEDÁVÁNÍ",
        TITLE_LOCAL_MUSIC: "^2 LOKÁLNÍ HUDBA",
        TITLE_PLAYLISTS: "^6 PLAYLISTY",
        OVERLAY_HEADER: "^5 NYNÍ HRAJE",
        OVERLAY_PROGRAM: "^6Pořad: ^7",
        MSG_GUI_RESET: "/o gui - GUI Obnoveno",
        MSG_NP_SHOW: "/o np - Overlay zobrazen",
        MSG_NP_EMPTY: "/o np - Nic nehraje"
    }
};

// === CONFIGURATION ===
const UI_LEFT = 165;
const UI_TOP = 100;
const ICON_TOP = 100;
const ITEMS_PER_PAGE = 5;
const MPV_PIPE = '\\\\.\\pipe\\lfs_mpv_socket';
const CONFIG_FILE = './radio_config.json';
let MY_UCID = 255;

// PORTS
const MAP_WS_PORT = 3000;
const RADIO_WS_PORT = 3001;

// ID RANGES
const OVERLAY_BG = 190;
const OVERLAY_HEADER = 191;
const OVERLAY_ARTIST = 192;
const OVERLAY_SONG = 193;
const OVERLAY_PROGRAM = 194;
const OVERLAY_CLOSE = 195; 

// === STATE ===
const playerStates = new Map(); 
let isManualStop = false; // <--- PŘIDAT TUTO ŘÁDKU

// === CHASE MANAGEMENT ===
const activeChases = new Map();
let currentServerApiUrl = null;
let apiUpdateTimer = null;

// === GPS NAVIGATION DATA ===
// PLID -> { destination, coords, distance, eta, missionText, icon }
const playerMissions = new Map(); 

let currentVolume = 50;
let currentStation = null;
let currentStationConfig = null;
let currentMetadata = "";
let currentDisplayParts = [];
let tickerIndex = 0;
let tickerTimer = null;
let metadataFetchTimer = null;
let currentProgram = null;
let isInSimConnected = false;
let lastNowPlayingInfo = { artist: "", song: "", fullTitle: "" }; 
let isOverlayVisible = false;
let currentLang = 'en';
let overlayTickerTimer = null;
let overlayTickerIndex = 0;
let overlayArtistParts = [];
let overlaySongParts = [];

let radioConfig = { favorites: [], recent: [], lang: 'en' };

function t(key) { return TRANSLATIONS[currentLang][key] || key; }

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      radioConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (radioConfig.lang) currentLang = radioConfig.lang;
      console.log(`${colors.green}[Config]${colors.reset} Loaded.`);
    }
  } catch (e) { console.error(`${colors.red}[Config] Error:${colors.reset}`, e.message); }
}

function saveConfig() {
  try { 
      radioConfig.lang = currentLang;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(radioConfig, null, 2), 'utf8'); 
  } 
  catch (e) { console.error(`${colors.red}[Config] Save Error:${colors.reset}`, e.message); }
}

function addToRecent(station) {
  radioConfig.recent = radioConfig.recent.filter(s => {
    return station.provider === 'abradia' ? s.slug !== station.slug : s.url !== station.url;
  });
  const entry = { name: station.name, playedAt: new Date().toISOString(), ...station };
  delete entry.programs; 
  radioConfig.recent.unshift(entry);
  if (radioConfig.recent.length > 20) radioConfig.recent = radioConfig.recent.slice(0, 20);
  saveConfig();
}

// === TC API LOGIC ===
function detectTcServer(serverName) {
    if (!serverName) return null;
    const lower = serverName.toLowerCase();
    if (lower.includes("one")) return `${TC_API_BASE}/status_one.json`;
    if (lower.includes("two")) return `${TC_API_BASE}/status_two.json`;
    if (lower.includes("three")) return `${TC_API_BASE}/status_three.json`;
    if (lower.includes("four")) return `${TC_API_BASE}/status_four.json`;
    return null;
}

// ... (začátek souboru zůstává stejný)

async function updateChaseData() {
    if (!currentServerApiUrl) return;

    try {
        const response = await fetch(currentServerApiUrl);
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data) return;

        if (ENABLE_GPS_LOGGER) processApiData(data, MY_UCID);

        // 1. ZPRACOVÁNÍ HONIČEK (stávající kód)
        activeChases.clear();
        if (data.cs && Array.isArray(data.cs)) {
            data.cs.forEach(chase => {
                if (chase.su?.u) {
                    const sUcid = Number(chase.su.u);
                    if (!activeChases.has(sUcid)) activeChases.set(sUcid, new Set());
                    if (chase.co) chase.co.forEach(c => c.u && activeChases.get(sUcid).add(Number(c.u)));
                }
            });
        }

        // 2. DETEKCE NEBEZPEČÍ NA SILNICI (NOVÉ)
        const hazards = [];
        if (data.ms && Array.isArray(data.ms)) {
            data.ms.forEach(m => {
                const text = m.lt || "";
                // Hledáme klíčová slova opravářů
                if (text.includes("Barrier Fixing") || text.includes("Pothole Fixing") || text.includes("Traffic Light")) {
                    const locName = parseMissionDestination(text);
                    const coords = getDestinationCoords(locName);
                    
                    if (coords) {
                        let type = "Road Work";
                        if (text.includes("Barrier")) type = "Barrier Repair";
                        if (text.includes("Pothole")) type = "Pothole Repair";
                        if (text.includes("Traffic Light")) type = "Traffic Light Repair";

                        hazards.push({
                            type: type,
                            location: locName,
                            coords: coords, // Přibližná poloha (střed silnice)
                            id: m.s // ID mise pro unikátnost
                        });
                    }
                }
            });
        }

        // 3. ZPRACOVÁNÍ HRÁČE A NAVIGACE (upraveno)
        playerMissions.clear();
        if (data.ps && typeof data.ps === 'object') {
            Object.values(data.ps).forEach(player => {
                if (!player.p || Number(player.u) !== MY_UCID) return;

                const plid = player.p;
                let missionData = null;

                // Priority 1: LO (Souřadnice)
                if (player.lo && player.lo.d) {
                    missionData = {
                        destination: "Target Location",
                        coords: { x: player.lo.d.x, y: player.lo.d.y },
                        icon: '📍',
                        missionText: 'Active Mission'
                    };
                    if (player.lo.t === 'STOP') missionData.icon = '🚏';
                    else if (player.lo.t === 'UNLOAD') missionData.icon = '🔽';
                }

                // Priority 2: Text mise
                if (data.ms) {
                    const mission = data.ms.find(m => m.ps && m.ps.includes(player.u));
                    if (mission) {
                        if (missionData) {
                            missionData.missionText = mission.lt;
                            const parsed = parseMissionDestination(mission.lt);
                            if (parsed) missionData.destination = parsed;
                        } else {
                            const parsedDest = parseMissionDestination(mission.lt);
                            const coords = getDestinationCoords(parsedDest);
                            if (coords) {
                                missionData = {
                                    destination: parsedDest,
                                    coords: coords,
                                    missionText: mission.lt,
                                    icon: coords.icon || '📍'
                                };
                            }
                        }
                    }
                }

                if (missionData) {
                    const dist = calculateDistance(player.x, player.y, missionData.coords.x, missionData.coords.y);
                    const eta = calculateETA(dist, player.s || 0);
                    playerMissions.set(plid, { ...missionData, distance: dist, eta });
                }
            });
        }

        // 4. ODESLÁNÍ DAT (včetně hazards)
        const gpsData = Array.from(playerMissions.entries()).map(([plid, d]) => ({
            plid, ...d
        }));
        
        // Posíláme i když je prázdné, abychom případně smazali starou navigaci
        wssMap.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({ 
                    type: 'gps_update', 
                    missions: gpsData,
                    hazards: hazards // <--- NOVÉ POLE NEBEZPEČÍ
                }));
            }
        });

    } catch (e) { console.error(`[TC API] Error: ${e.message}`); }
}

// ... (zbytek souboru server.js zůstává stejný)

function getPlayerRole(plid) {
    const numericPlid = Number(plid); 
    const car = cars.get(numericPlid);
    if (!car) return 'CIVILIAN';
    
    const ucid = Number(car.ucid);
    if (activeChases.has(ucid)) return 'SUSPECT';
    for (const cops of activeChases.values()) {
        if (cops.has(ucid)) return 'COP';
    }
    return 'CIVILIAN';
}

// === MPV & AUDIO ===
let MPV_PATH = null;
let currentAudioProcess = null;
let currentPlaylist = [];
let currentTrackIndex = 0;
let isPaused = false;
let isShuffled = false;
let originalPlaylist = [];
let localMusicSearchQuery = '';
let localMusicSearchResults = [];
let ipcClient = null;

function isCommandAvailable(command) {
  try { execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${command}`, { stdio: 'ignore' }); return true; } catch (e) { return false; }
}

MPV_PATH = (function() {
    const paths = ['C:\\Program Files\\mpv\\mpv.exe', 'C:\\Program Files (x86)\\mpv\\mpv.exe', 'C:\\mpv\\mpv.exe'];
    for (const p of paths) if (fs.existsSync(p)) return p;
    return isCommandAvailable('mpv') ? 'mpv' : null;
})();
console.log(`${colors.cyan}[Audio]${colors.reset}`, MPV_PATH ? `${colors.green}OK${colors.reset}` : `${colors.red}ERROR MPV MISSING${colors.reset}`);

if (FORCE_COP_MODE) console.log(`${colors.magenta}[INFO]${colors.reset} Forced COP mode active (--cop)`);
if (ENABLE_DEBUG) console.log(`${colors.magenta}[INFO]${colors.reset} Debug logs active (--debug)`);

loadConfig();

// === SERVERS ===
const server = http.createServer((req, res) => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  let filePath = req.url === '/' ? '/index.html' : req.url;
  if (req.url === '/radio' || req.url === '/radio.html') filePath = '/radio.html';
  
  const fullPath = join(__dirname, 'public', filePath);
  const ext = String(filePath).toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }[ext] || 'application/octet-stream';
  
  fs.readFile(fullPath, (err, data) => {
    if(err) { res.writeHead(404); res.end(); }
    else { res.writeHead(200, {'Content-Type': mime}); res.end(data); }
  });
});

server.listen(MAP_WS_PORT, () => console.log(`${colors.cyan}[Web]${colors.reset} Running on port ${MAP_WS_PORT}`));

const wssMap = new WebSocketServer({ server });

wssMap.on('connection', (ws) => {
  if (ENABLE_DEBUG) console.log(`${colors.cyan}[Map WS]${colors.reset} Client connected`);
  const trackToSend = currentTrack || 'BL1';
  ws.send(JSON.stringify({ type: 'track', track: trackToSend, layout: currentLayout }));
  
  const mapData = Array.from(cars.values())
      .filter(c => getPlayerRole(c.plid) === 'CIVILIAN') 
      .map(c => ({
          plid: c.plid, name: c.pname, x: c.x, y: c.y, z: c.z, speed: c.speed, heading: c.heading
      }));
      
  if (mapData.length > 0) ws.send(JSON.stringify({ type: 'positions', cars: mapData }));
});

const radioServer = http.createServer();
const wssRadio = new WebSocketServer({ server: radioServer });
radioServer.listen(RADIO_WS_PORT, () => console.log(`${colors.magenta}[Radio WS]${colors.reset} Port ${RADIO_WS_PORT}`));

// === INSIM ===
const inSim = new InSim();
const cars = new Map();
let currentTrack = '';
let currentLayout = '';

function startGuiWatchdog() {
    setInterval(() => {
        if (!isInSimConnected) return;
        
        const state = playerStates.get(MY_UCID);
        if (state) {
            // NEVOLEJ renderUI pro main a icon - ničí to tlačítka!
            // Watchdog má jen refresh overlay a update status buttons
            if (state.state === 'main') {
                updateStatusButtons();
            } else if (state.state !== 'icon') {
                renderUI(MY_UCID, state.state, state.searchResults, state.page);
            }
        } else if (MY_UCID === 255) {
            playerStates.set(255, { state: 'icon', searchResults: [], page: 0 });
            renderUI(255, 'icon');
        }
        
        // Refresh Overlay (keep buttons alive)
        if (isOverlayVisible && currentStation) {
            const isLocal = currentStationConfig?.provider === 'local' || currentStationConfig?.provider === 'playlist';
            const L = 90; const T = 160; const W = 40;
            const totalHeight = isLocal ? 12 : (currentProgram ? 20 : 14);
            
            sendBtn(MY_UCID, OVERLAY_BG, L, T, W, totalHeight, '', ButtonStyle.ISB_DARK);
            sendBtn(MY_UCID, OVERLAY_CLOSE, L + W - 6, T+1, 5, 4, '^1X', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            
            if (isLocal) {
                // Header s názvem (ticker se obnovuje automaticky)
                if (overlayArtistParts.length > 0) {
                    const titlePart = overlayArtistParts[overlayTickerIndex % overlayArtistParts.length];
                    sendBtn(MY_UCID, OVERLAY_HEADER, L, T+1, W-6, 4, `^2${titlePart}`, ButtonStyle.ISB_DARK);
                }
                
                // Track info - ukaž původní číslo i když je shuffle
                const displayIndex = getCurrentTrackOriginalIndex();
                const trackInfo = `^7${displayIndex}^8/^7${originalPlaylist.length || currentPlaylist.length}`;
                sendBtn(MY_UCID, OVERLAY_ARTIST, L, T+5, W, 3, trackInfo, ButtonStyle.ISB_DARK);
                
                // Controls
                sendBtn(MY_UCID, 227, L+1, T+8, 8, 4, '^3|<', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
                sendBtn(MY_UCID, 226, L+10, T+8, 10, 4, isPaused ? '^2▶' : '^3||', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
                sendBtn(MY_UCID, 228, L+21, T+8, 8, 4, '^3>|', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
                sendBtn(MY_UCID, 229, L+30, T+8, 9, 4, isShuffled ? '^2🔀' : '^8🔀', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            }
            else {
                sendBtn(MY_UCID, OVERLAY_HEADER, L, T+1, W-6, 4, t('OVERLAY_HEADER'), ButtonStyle.ISB_DARK);
                updateOverlayText();
                
                if (currentProgram) {
                    let prog = currentProgram.name.substring(0, 40);
                    sendBtn(MY_UCID, OVERLAY_PROGRAM, L, T+14, W, 5, `${t('OVERLAY_PROGRAM')}^7${prog}`, ButtonStyle.ISB_DARK);
                }
            }
        }
    }, 3000); 
}

function forceKillMpv() {
    if (metadataFetchTimer) { clearInterval(metadataFetchTimer); metadataFetchTimer = null; }
    if (ipcClient) { try { ipcClient.destroy(); } catch(e){} ipcClient = null; }
    try { execSync('taskkill /F /IM mpv.exe /T', { stdio: 'ignore' }); } catch (e) {}
}

async function playRadioStream(url, name, stationConfig = null) {
  // Nastavíme true, aby zabití předchozího procesu (pokud běží) nespustilo "next track"
  isManualStop = true; 
  forceKillMpv();
  
  currentStation = name;
  currentStationConfig = stationConfig;
  currentProgram = stationConfig?.programs?.[0] || null;
  updateMetadata(name, false); 
  addToRecent({ name, url: stationConfig?.originalUrl || url, ...stationConfig });

  if (MPV_PATH) {
      if (ENABLE_DEBUG) console.log(`[PLAY] URL: ${url}`);
      if (ENABLE_DEBUG) console.log(`[PLAY] Name: ${name}`);
      if (ENABLE_DEBUG) console.log(`[PLAY] Provider: ${stationConfig?.provider}`);
      
      const args = ['--no-video', `--volume=${currentVolume}`, '--really-quiet', `--input-ipc-server=${MPV_PIPE}`, url];
      
      if (ENABLE_DEBUG) console.log(`[MPV] Args: ${JSON.stringify(args)}`);
      
      setTimeout(() => {
          // Nyní resetujeme flag, protože nový proces má běžet
          isManualStop = false; 
          
          currentAudioProcess = spawn(MPV_PATH, args);
          if (ENABLE_DEBUG) console.log(`[MPV] Process started, PID: ${currentAudioProcess?.pid}`);
          
          // === FIX: DETEKCE KONCE SKLADBY ===
          currentAudioProcess.on('close', (code) => {
              // Pokud to nebylo manuální zastavení (Stop) a hrajeme lokální hudbu/playlist
              if (!isManualStop && (currentStationConfig?.provider === 'local' || currentStationConfig?.provider === 'playlist')) {
                  if (ENABLE_DEBUG) console.log(`${colors.green}[AUTOPLAY]${colors.reset} Track finished, playing next...`);
                  playNextTrack();
              }
          });
          // ==================================

          tryConnectIpc();
      }, 100);
      
      if (stationConfig?.provider === 'abradia' && stationConfig?.slug) startAbradiaMetadataFetch();
      
      if (stationConfig?.provider === 'local' || stationConfig?.provider === 'playlist') {
            setTimeout(() => {
        // POUŽIJ METADATA pokud existují
            let artist = stationConfig.artist || 'Local Music';
            let song = stationConfig.title || name;
        
            showNowPlayingOverlay({ artist, song, fullTitle: `${artist} - ${song}` });
        }, 500);
}
      
      broadcastRadioStatus(name, 'playing', { metadata: name });
      updateStatusButtons();
  }
}

function stopRadio() {
  isManualStop = true; // <--- PŘIDAT: Uživatel chtěl zastavit, nehraj další
  forceKillMpv();
  if (tickerTimer) { clearInterval(tickerTimer); tickerTimer = null; }
  currentStation = null;
  currentMetadata = "";
  currentDisplayParts = [];
  clearNowPlayingOverlay();
  broadcastRadioStatus('Stopped', 'stopped');
  updateStatusButtons();
}

function changeVolume(delta) {
    currentVolume = Math.min(100, Math.max(0, currentVolume + delta));
    if (ipcClient && !ipcClient.destroyed) ipcClient.write(JSON.stringify({ command: ["set_property", "volume", currentVolume] }) + '\n');
    updateVolumeButtonsOnly();
    broadcastRadioStatus(currentStation || 'Stopped', 'volume_change', { volume: currentVolume });
}

async function startAbradiaMetadataFetch() {
  await fetchAbradiaMetadata();
  metadataFetchTimer = setInterval(fetchAbradiaMetadata, 10000);
}

async function fetchAbradiaMetadata() {
  if (!currentStationConfig?.slug) return;
  try {
    const nowPlaying = await getAbradiaNowPlaying(currentStationConfig.slug);
    if (nowPlaying && nowPlaying.fullTitle !== currentMetadata) {
      updateMetadata(nowPlaying.fullTitle, false); 
      lastNowPlayingInfo = nowPlaying;
      showNowPlayingOverlay(nowPlaying); 
      broadcastRadioStatus(currentStation, 'metadata', { artist: nowPlaying.artist, song: nowPlaying.song, fullTitle: nowPlaying.fullTitle });
    }
  } catch (e) {}
}

function tryConnectIpc(attempts = 0) {
    if (attempts > 20) return;
    setTimeout(() => {
        if (!currentAudioProcess) return;
        const client = net.createConnection(MPV_PIPE);
        client.on('connect', () => {
            ipcClient = client;
            client.write(JSON.stringify({ command: ["observe_property", 1, "media-title"] }) + '\n');
        });
        client.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(l => {
                if(!l) return;
                try {
                    const msg = JSON.parse(l);
                    if (msg.event === 'property-change' && msg.name === 'media-title' && msg.data) {
                        if (!currentStationConfig?.provider) updateMetadata(msg.data, true);
                    }
                } catch(e){}
            });
        });
        client.on('error', () => { client.destroy(); tryConnectIpc(attempts + 1); });
    }, 300);
}


// === PLAYBACK CONTROLS ===
function pausePlayback() {
    if (!ipcClient || ipcClient.destroyed) return;
    ipcClient.write(JSON.stringify({ command: ["set_property", "pause", true] }) + '\n');
    isPaused = true;
    if (ENABLE_DEBUG) console.log('[PLAYBACK] Paused');
}

function resumePlayback() {
    if (!ipcClient || ipcClient.destroyed) return;
    ipcClient.write(JSON.stringify({ command: ["set_property", "pause", false] }) + '\n');
    isPaused = false;
    if (ENABLE_DEBUG) console.log('[PLAYBACK] Resumed');
}

function togglePause() {
    if (isPaused) resumePlayback();
    else pausePlayback();
}

function playNextTrack() {
    if (currentPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    const track = currentPlaylist[currentTrackIndex];
    if (ENABLE_DEBUG) console.log(`[PLAYBACK] Next: ${track.name}`);
    playTrackFromList(track);
}

function playPrevTrack() {
    if (currentPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    const track = currentPlaylist[currentTrackIndex];
    if (ENABLE_DEBUG) console.log(`[PLAYBACK] Prev: ${track.name}`);
    playTrackFromList(track);
}

function playTrackFromList(track) {
    // Preferuj path (filesystem) před url
    const url = track.path || track.url;
    if (ENABLE_DEBUG) console.log(`[PLAY_TRACK] Using: ${url}`);
    playRadioStream(url, track.name, { provider: 'local', ...track });
}

function setPlaylist(tracks, startIndex = 0) {
    originalPlaylist = [...tracks];
    currentPlaylist = isShuffled ? shuffleArray([...tracks]) : [...tracks];
    currentTrackIndex = startIndex;
    if (ENABLE_DEBUG) console.log(`[PLAYBACK] Playlist set: ${tracks.length} tracks, starting at ${startIndex}`);
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    const currentTrack = currentPlaylist[currentTrackIndex];
    
    if (isShuffled) {
        currentPlaylist = shuffleArray([...originalPlaylist]);
    } else {
        currentPlaylist = [...originalPlaylist];
    }
    
    // Najdi current track v novém pořadí
    currentTrackIndex = currentPlaylist.findIndex(t => t.id === currentTrack?.id) || 0;
    if (ENABLE_DEBUG) console.log(`[PLAYBACK] Shuffle ${isShuffled ? 'ON' : 'OFF'}`);
}

function getCurrentTrackOriginalIndex() {
    if (!currentPlaylist[currentTrackIndex]) return 0;
    const currentTrack = currentPlaylist[currentTrackIndex];
    const origIndex = originalPlaylist.findIndex(t => t.id === currentTrack.id);
    return origIndex >= 0 ? origIndex + 1 : currentTrackIndex + 1;
}

function searchLocalMusic(query) {
    const allTracks = getLocalMusicFiles();
    if (!query || query.trim() === '') {
        localMusicSearchResults = [];
        return allTracks;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    const results = allTracks.filter(track => 
        track.name.toLowerCase().includes(lowerQuery)
    );
    
    if (ENABLE_DEBUG) console.log(`[SEARCH] Query: "${query}" - Found: ${results.length} tracks`);
    localMusicSearchResults = results;
    return results;
}

function stripColors(text) {
    if (!text) return "";
    return text.replace(/\^[0-9a-zA-Z]/g, '');
}

function updateOverlayText() {
    const L = 90; const T = 160; const W = 40;
    const artistPart = overlayArtistParts[overlayTickerIndex % overlayArtistParts.length] || "";
    const songPart = overlaySongParts[overlayTickerIndex % overlaySongParts.length] || "";
    
    sendBtn(MY_UCID, OVERLAY_ARTIST, L, T+5, W, 4, `^2${artistPart}`, ButtonStyle.ISB_DARK);
    sendBtn(MY_UCID, OVERLAY_SONG, L, T+9, W, 5, `^7${songPart}`, ButtonStyle.ISB_DARK);
}

function updateMetadata(raw, shouldBroadcast = false) {
    if (!raw || raw.includes('Now Playing')) return;
    const hasChanged = currentMetadata !== raw;
    currentMetadata = raw;
    
    let cleanRaw = stripColors(raw);
    let parts = [];

    if (cleanRaw.includes(" - ")) {
        const splitArr = cleanRaw.split(" - ");
        const artist = splitArr[0];
        const song = splitArr.slice(1).join(" - ");
        parts = [...createTickerParts(artist, 20), ...createTickerParts(song, 20)];
    } else {
        parts = createTickerParts(cleanRaw, 20);
    }

    currentDisplayParts = parts;

    let artistOverlay = "Radio", songOverlay = raw;
    if (raw.includes(" - ")) {
        const parts = raw.split(" - ");
        artistOverlay = parts[0];
        songOverlay = parts.slice(1).join(" - ");
    }
    lastNowPlayingInfo = { artist: artistOverlay, song: songOverlay, fullTitle: raw };

    if (tickerTimer) clearInterval(tickerTimer);
    tickerIndex = 0;
    updateStatusButtons();
    
    tickerTimer = setInterval(() => {
        tickerIndex = (tickerIndex + 1) % currentDisplayParts.length;
        updateStatusButtons();
    }, 3000);
    
    if (hasChanged && shouldBroadcast) {
        broadcastRadioStatus(currentStation, 'metadata', { fullTitle: raw });
        showNowPlayingOverlay(lastNowPlayingInfo);
    }
}

function createTickerParts(text, maxLength) {
    if (!text || text.length <= maxLength) return [text || ""];
    const parts = [];
    for (let i = 0; i < text.length; i += maxLength) {
        parts.push(text.substring(i, i + maxLength));
    }
    return parts;
}

function showNowPlayingOverlay(nowPlaying) {
    isOverlayVisible = true;
    const isLocal = currentStationConfig?.provider === 'local' || currentStationConfig?.provider === 'playlist';
    
    const W = 40; const L = 90; const T = 160;
    const totalHeight = isLocal ? 12 : (currentProgram ? 20 : 14);
    
    sendBtn(MY_UCID, OVERLAY_BG, L, T, W, totalHeight, '', ButtonStyle.ISB_DARK);
    
    let artist = stripColors(nowPlaying.artist || "");
    let song = stripColors(nowPlaying.song || nowPlaying.fullTitle || "");
    let fullTitle = artist && song ? `${artist} - ${song}` : (song || artist);
    
    if (isLocal) {
        // LOCAL MUSIC / PLAYLIST LAYOUT
        
        // Pro playlist: zobraz název playlistu + název skladby
        if (currentStationConfig?.provider === 'playlist') {
            const track = currentPlaylist[currentTrackIndex];
            const playlistName = currentStationConfig.playlistName || "Playlist";
    
            // POUŽIJ METADATA
            const artist = track?.artist || '';
            const title = track?.title || song;
            fullTitle = artist ? `${playlistName}: ${artist} - ${title}` : `${playlistName}: ${title}`;
        }
        
        overlayArtistParts = createTickerParts(fullTitle, 30);
        overlaySongParts = [];
        
        if (overlayTickerTimer) {
            clearInterval(overlayTickerTimer);
            overlayTickerTimer = null;
        }
        overlayTickerIndex = 0;
        
        // Header s plným názvem
        const titlePart = overlayArtistParts[0] || fullTitle;
        sendBtn(MY_UCID, OVERLAY_HEADER, L, T+1, W-6, 4, `^2${titlePart}`, ButtonStyle.ISB_DARK);
        sendBtn(MY_UCID, OVERLAY_CLOSE, L + W - 6, T+1, 5, 4, '^1X', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        
        // Ticker pro dlouhé názvy
        if (overlayArtistParts.length > 1) {
            overlayTickerTimer = setInterval(() => {
                overlayTickerIndex = (overlayTickerIndex + 1) % overlayArtistParts.length;
                const part = overlayArtistParts[overlayTickerIndex];
                sendBtn(MY_UCID, OVERLAY_HEADER, L, T+1, W-6, 4, `^2${part}`, ButtonStyle.ISB_DARK);
            }, 3000);
        }
        
        // Track info - zobraz index z ORIGINÁLNÍHO playlistu
        const displayIndex = getCurrentTrackOriginalIndex();
        const trackInfo = `^7${displayIndex}^8/^7${originalPlaylist.length || currentPlaylist.length}`;
        sendBtn(MY_UCID, OVERLAY_ARTIST, L, T+5, W, 3, trackInfo, ButtonStyle.ISB_DARK);
        
        // CONTROLS
        sendBtn(MY_UCID, 227, L+1, T+8, 8, 4, '^3|<', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(MY_UCID, 226, L+10, T+8, 10, 4, isPaused ? '^2▶' : '^3||', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(MY_UCID, 228, L+21, T+8, 8, 4, '^3>|', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(MY_UCID, 229, L+30, T+8, 9, 4, isShuffled ? '^2🔀' : '^8🔀', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
    }
    else {
        // Normální overlay pro streamy (nezměněno)
        sendBtn(MY_UCID, OVERLAY_HEADER, L, T+1, W-6, 4, t('OVERLAY_HEADER'), ButtonStyle.ISB_DARK);
        sendBtn(MY_UCID, OVERLAY_CLOSE, L + W - 6, T+1, 5, 4, '^1X', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        
        overlayArtistParts = createTickerParts(artist, 20);
        overlaySongParts = createTickerParts(song, 20);
        
        if (overlayTickerTimer) {
            clearInterval(overlayTickerTimer);
            overlayTickerTimer = null;
        }
        overlayTickerIndex = 0;
        
        updateOverlayText();
        
        const maxParts = Math.max(overlayArtistParts.length, overlaySongParts.length);
        if (maxParts > 1) {
            overlayTickerTimer = setInterval(() => {
                overlayTickerIndex++;
                if (overlayTickerIndex >= maxParts) overlayTickerIndex = 0;
                updateOverlayText();
            }, 3000);
        }
        
        if (currentProgram) {
            let prog = currentProgram.name.substring(0, 40);
            sendBtn(MY_UCID, OVERLAY_PROGRAM, L, T+14, W, 5, `${t('OVERLAY_PROGRAM')}^7${prog}`, ButtonStyle.ISB_DARK);
        }
    }
}

function clearNowPlayingOverlay() {
    isOverlayVisible = false;
    if (overlayTickerTimer) { clearInterval(overlayTickerTimer); overlayTickerTimer = null; }
    for (let i = OVERLAY_BG; i <= OVERLAY_CLOSE; i++) {
        inSim.send(new IS_BFN({ReqI: 1, SubT: 1, UCID: MY_UCID, ClickID: i}));
    }
}

function sendBtn(ucid, id, l, t, w, h, text, style, typeIn = 0) {
    if (ucid !== MY_UCID && ucid !== 255) return;
    let finalStyle = style;
    if (typeIn > 0) finalStyle = style | ButtonStyle.ISB_CLICK;
    try { inSim.send(new IS_BTN({ ReqI: 1, UCID: ucid, ClickID: id, Inst: 0, BStyle: finalStyle, TypeIn: typeIn, L: l, T: t, W: w, H: h, Text: text })); } catch (e) {}
}

function clearGuiButtons(ucid) {
    for(let i=200; i<=245; i++) {
        try { inSim.send(new IS_BFN({ReqI: 1, SubT: 1, UCID: ucid, ClickID: i})); } catch (e) {}
    }
}

function updateStatusButtons() {
    const state = playerStates.get(MY_UCID);
    if (state && state.state === 'main') {
        let txtPart = currentDisplayParts[tickerIndex] || currentStation || t('STATUS_STOPPED');
        let txt = `^2${txtPart}`; 
        sendBtn(MY_UCID, 225, UI_LEFT+1, UI_TOP+36, 28, 4, txt.substring(0,27), ButtonStyle.ISB_DARK);
    }
}

function updateVolumeButtonsOnly() {
    const state = playerStates.get(MY_UCID);
    if (state && state.state === 'main') {
        sendBtn(MY_UCID, 218, UI_LEFT+7, UI_TOP+41, 16, 5, `^7VOL: ^3${currentVolume}%`, ButtonStyle.ISB_LIGHT);
    }
}

function renderUI(ucid, requestedState, extraData = null, page = 0) {
    if (ucid !== MY_UCID && ucid !== 255) return;
    
    const oldState = playerStates.get(ucid);
    let searchResults = extraData || (oldState ? oldState.searchResults : []);
    playerStates.set(ucid, { state: requestedState, searchResults, page });

    clearGuiButtons(ucid); 

    if (requestedState === 'icon') {
        sendBtn(ucid, 239, UI_LEFT + 24, ICON_TOP, 5, 5, '^5[ ^7R ^5]', ButtonStyle.ISB_DARK | ButtonStyle.ISB_CLICK);
        return;
    }

    const L = UI_LEFT; const T = UI_TOP;
    let height = 68; 
    let title = t('GUI_TITLE');
    
    if (requestedState === 'main') {
        height = 61;
        sendBtn(ucid, 201, L, T, 30, 4, title, ButtonStyle.ISB_DARK);
        
        if (ENABLE_DEBUG) console.log(`[DEBUG] renderUI main menu - page: ${page} (type: ${typeof page}), ucid: ${ucid}`);
        
        // Page 0 - hlavní funkce
        if (page === 0) {
            sendBtn(ucid, 210, L+1, T+5, 28, 5, `^3[ ^7${t('BTN_FAVORITES')} ^3]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 211, L+1, T+11, 28, 5, `^6[ ^7${t('BTN_RECENT')} ^6]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 212, L+1, T+17, 28, 5, `^4[ ^7${t('BTN_ABRADIA')} ^4]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 220, L+1, T+23, 28, 5, `^3[ ^7${t('BTN_SEARCH')} ^3]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 213, L+1, T+29, 28, 5, `^7[ ^0${t('BTN_LANG')} ^7]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 237, L+21, T+35, 8, 5, '^3>', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        }
        // Page 1 - local music
        else if (page === 1) {
            sendBtn(ucid, 234, L+1, T+5, 28, 5, `^2[ ^7${t('BTN_LOCAL_MUSIC')} ^2]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 223, L+1, T+11, 28, 5, `^6[ ^7${t('BTN_PLAYLISTS')} ^6]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 235, L+1, T+35, 8, 5, '^3<', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        }
        else {
            if (ENABLE_DEBUG) console.log(`[DEBUG] UNKNOWN PAGE: ${page} (type: ${typeof page})`);
        }
        
        let txtPart = currentDisplayParts[tickerIndex] || currentStation || t('STATUS_STOPPED');
        let txt = `^2${txtPart}`;
        sendBtn(MY_UCID, 225, L+1, T+41, 28, 4, txt.substring(0,27), ButtonStyle.ISB_DARK);
        
        sendBtn(ucid, 216, L+1, T+46, 5, 5, '^1-', ButtonStyle.ISB_CLICK | ButtonStyle.ISB_LIGHT);
        sendBtn(ucid, 218, L+7, T+46, 16, 5, `^7VOL: ^3${currentVolume}%`, ButtonStyle.ISB_LIGHT);
        sendBtn(ucid, 217, L+24, T+46, 5, 5, '^2+', ButtonStyle.ISB_CLICK | ButtonStyle.ISB_LIGHT);
        sendBtn(ucid, 214, L+1, T+52, 14, 5, `^1${t('BTN_STOP')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(ucid, 215, L+15, T+52, 14, 5, `^8${t('BTN_CLOSE')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
    } 
    else {
        let dataSource = [];
        if (requestedState === 'favorites') { dataSource = radioConfig.favorites; title = t('TITLE_FAV'); }
        else if (requestedState === 'recent') { dataSource = radioConfig.recent; title = t('TITLE_RECENT'); }
        else if (requestedState === 'abradia') { dataSource = searchResults; title = t('TITLE_ABRADIA'); }
        else if (requestedState === 'results') { dataSource = searchResults; title = t('TITLE_RESULTS'); }
        else if (requestedState === 'local_music') { 
            dataSource = localMusicSearchQuery ? localMusicSearchResults : getLocalMusicFiles(); 
            title = localMusicSearchQuery ? `^2🔍 ${t('TITLE_LOCAL_MUSIC')}` : t('TITLE_LOCAL_MUSIC'); 
        }
        else if (requestedState === 'playlists') { dataSource = getPlaylists(); title = t('TITLE_PLAYLISTS'); }
        else if (requestedState === 'search') { title = t('TITLE_SEARCH'); height = 20; }

        if (requestedState === 'search') {
             sendBtn(ucid, 221, L+1, T+5, 28, 5, t('SEARCH_PLACEHOLDER'), ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK, 95);
             sendBtn(ucid, 222, L+1, T+12, 28, 5, `^8${t('BTN_BACK')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        } else {
            height = 37 + (ITEMS_PER_PAGE * 6);
            sendBtn(ucid, 201, L, T, 30, 4, `${title} ^7(${dataSource.length})`, ButtonStyle.ISB_DARK);
            const start = page * ITEMS_PER_PAGE;
            const items = dataSource.slice(start, start + ITEMS_PER_PAGE);
            
            if (items.length === 0) sendBtn(ucid, 230, L+1, T+6, 28, 4, t('NO_ITEMS'), ButtonStyle.ISB_DARK);
            else items.forEach((s, i) => sendBtn(ucid, 230+i, L+1, T+5+(i*6), 28, 5, `^7${s.name.substring(0,24)}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK));

            const navTop = T + (ITEMS_PER_PAGE * 6) + 6;
            const maxPage = Math.ceil(dataSource.length / ITEMS_PER_PAGE);
            if (page > 0) sendBtn(ucid, 235, L+1, navTop, 8, 5, '^3<', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            sendBtn(ucid, 236, L+10, navTop, 10, 5, `^7${page+1}^8/^7${maxPage||1}`, ButtonStyle.ISB_DARK);
            if (page < maxPage - 1) sendBtn(ucid, 237, L+21, navTop, 8, 5, '^3>', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            
            // Search button pro local music
            if (requestedState === 'local_music') {
                sendBtn(ucid, 238, L+1, navTop + 6, 28, 5, localMusicSearchQuery ? `^2🔍 ${localMusicSearchQuery.substring(0,20)}` : '^3🔍 HLEDAT...', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK, localMusicSearchQuery ? 0 : 95);
            }
            
            // Control buttons pro local music/playlists
            if (requestedState === 'local_music' || requestedState === 'playlists') {
                sendBtn(ucid, 227, L+1, navTop + 12, 8, 5, '^3|<', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
                sendBtn(ucid, 226, L+10, navTop + 12, 10, 5, isPaused ? '^2▶' : '^3||', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
                sendBtn(ucid, 228, L+21, navTop + 12, 8, 5, '^3>|', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
            }
            
            sendBtn(ucid, 222, L+1, navTop + 18, 28, 5, `^8${t('BTN_BACK')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        }
    }
    sendBtn(ucid, 200, L, T, 30, height, '', ButtonStyle.ISB_DARK);
}

function broadcastRadioStatus(station, status, extra = null) {
  const msg = { type: 'radio_status', station, status };
  if (extra) Object.assign(msg, extra);
  wssRadio.clients.forEach(c => { if(c.readyState===1) c.send(JSON.stringify(msg)); });
}

inSim.connect({ Host: '127.0.0.1', Port: 29999, IName: 'LiveMap', Flags: InSimFlags.ISF_MCI | InSimFlags.ISF_LOCAL | InSimFlags.ISF_MSO, ReqI: IS_ISI_ReqI.SEND_VERSION, Interval: 250, Admin: '' });

inSim.on('connect', () => {
  console.log(`${colors.green}[InSim]${colors.reset} Connected.`);
  isInSimConnected = true;
  MY_UCID = 255;
  playerStates.clear();
  activeChases.clear();
  
  initLocalMusic(); // přidej await
  
  playerStates.set(MY_UCID, { state: 'icon', searchResults: [], page: 0 });
  renderUI(MY_UCID, 'icon');
  if (ENABLE_DEBUG) console.log(`${colors.yellow}[System]${colors.reset} Waiting for user interaction (Click [R] button)...`);

  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_ISM })); 
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_SST })); 
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NCN }));
  
  startGuiWatchdog();
});

inSim.on('disconnect', () => { 
    isInSimConnected = false; 
    if (apiUpdateTimer) clearInterval(apiUpdateTimer);
    console.log(`${colors.red}[InSim]${colors.reset} Disconnected.`);
    cars.clear(); currentTrack = ''; currentLayout = '';
    wssMap.clients.forEach(client => { if (client.readyState === 1) client.send(JSON.stringify({ type: 'disconnect' })); });
});

inSim.on(PacketType.ISP_ISM, (p) => {
  console.log(`${colors.green}[Server]${colors.reset} Joined: ${p.HName || 'Local'}`);
  currentServerApiUrl = detectTcServer(p.HName);
  if (currentServerApiUrl) {
      if (ENABLE_DEBUG) console.log(`${colors.cyan}[TC API]${colors.reset} Connected to API: ${currentServerApiUrl}`);
      if (apiUpdateTimer) clearInterval(apiUpdateTimer);
      apiUpdateTimer = setInterval(updateChaseData, 2000);
      updateChaseData(); 
  } else {
      if (ENABLE_DEBUG) console.log(`${colors.yellow}[TC API]${colors.reset} Not a known TC server, API disabled.`);
      if (apiUpdateTimer) clearInterval(apiUpdateTimer);
  }

  cars.clear(); currentTrack = ''; currentLayout = '';
  activeChases.clear();
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_SST }));
});

inSim.on(PacketType.ISP_STA, (p) => {
  const newTrack = p.Track;
  if (newTrack && newTrack !== currentTrack) {
    currentTrack = newTrack; currentLayout = '';
    const trackName = getTrackName(currentTrack);
    console.log(`${colors.blue}[Track]${colors.reset} ${trackName} (${currentTrack})`);
    wssMap.clients.forEach(client => { if (client.readyState === 1) client.send(JSON.stringify({ type: 'track', track: currentTrack, layout: currentLayout })); });
  }
});

inSim.on(PacketType.ISP_NCN, (p) => {
  if (ENABLE_DEBUG) console.log(`${colors.cyan}[Connection]${colors.reset} New connection: ${p.UName} (UCID: ${p.UCID})`);
});

inSim.on(PacketType.ISP_NPL, (p) => {
  const convertedName = convertLFSText(p.PName);
  cars.set(p.PLID, {
    plid: p.PLID, ucid: p.UCID, pname: convertedName, plate: p.Plate, cname: p.CName, x: 0, y: 0, z: 0, speed: 0, heading: 0
  });
  const playerType = p.UCID === MY_UCID ? '[YOU] ' : '';
  if (ENABLE_DEBUG) console.log(`${colors.green}[Player]${colors.reset} ${playerType}${p.PName} joined (PLID: ${p.PLID})`);
});

inSim.on(PacketType.ISP_PLL, (p) => {
  cars.delete(p.PLID);
});

inSim.on(PacketType.ISP_TINY, (p) => {
  if (p.SubT === TinyType.TINY_MPE) {
    console.log(`${colors.yellow}[Server]${colors.reset} Left multiplayer server`);
    if (apiUpdateTimer) clearInterval(apiUpdateTimer);
    cars.clear(); currentTrack = ''; currentLayout = '';
    activeChases.clear();
    wssMap.clients.forEach(client => { if (client.readyState === 1) client.send(JSON.stringify({ type: 'server_left' })); });
  }
});

inSim.on(PacketType.ISP_MCI, (p) => {
  p.Info.forEach(carInfo => {
    const car = cars.get(carInfo.PLID);
    if (car) {
      car.x = carInfo.X / 65536; car.y = carInfo.Y / 65536; car.z = carInfo.Z / 65536;
      car.speed = carInfo.Speed / 327.68; car.heading = carInfo.Heading / 182.044;
    }
  });

  let myPlid = null;
  for (const car of cars.values()) {
      if (car.ucid === MY_UCID) {
          myPlid = car.plid;
          break;
      }
  }

  let myRole = FORCE_COP_MODE ? 'COP' : (myPlid !== null ? getPlayerRole(myPlid) : 'CIVILIAN');

  const mapData = Array.from(cars.values()).filter(targetCar => {
      const targetRole = getPlayerRole(targetCar.plid);
      if (targetRole === 'CIVILIAN') return true;
      if (myRole === 'CIVILIAN') return false;
      if (myRole === 'COP') {
          if (targetRole === 'COP') return true;
          if (targetRole === 'SUSPECT') return false;
      }
      if (myRole === 'SUSPECT') {
          if (targetRole === 'COP') return false;
          if (targetRole === 'SUSPECT') return true;
      }
      return false; 
  }).map(c => ({
      plid: c.plid, name: c.pname, x: c.x, y: c.y, z: c.z, speed: c.speed, heading: c.heading
  }));
  
  wssMap.clients.forEach(client => { if (client.readyState === 1) client.send(JSON.stringify({ type: 'positions', cars: mapData })); });
});

inSim.on(PacketType.ISP_MSO, (p) => {
    if (p.UserType === UserType.MSO_O) {
        const msg = p.Msg; 
        if (msg === 'gui') {
            if (MY_UCID === 255 || MY_UCID !== p.UCID) {
                const oldState = playerStates.get(MY_UCID);
                if (oldState) {
                    playerStates.set(p.UCID, oldState);
                    playerStates.delete(MY_UCID);
                    clearGuiButtons(MY_UCID);
                }
                MY_UCID = p.UCID;
            }
            const state = playerStates.get(MY_UCID);
            if (!state) {
                 playerStates.set(MY_UCID, { state: 'main', searchResults: [], page: 0 });
                 renderUI(MY_UCID, 'main');
            } else {
                 state.state = 'main';
                 renderUI(MY_UCID, 'main', state.searchResults, state.page);
            }
        }
        else if (msg === 'np') {
            if (currentStation) showNowPlayingOverlay(lastNowPlayingInfo);
        }
    }
});

inSim.on(PacketType.ISP_BTC, async (p) => {
    if (MY_UCID === 255) {
        const oldState = playerStates.get(255);
        if (oldState) {
            playerStates.set(p.UCID, oldState);
            playerStates.delete(255);
        }
        clearGuiButtons(255);
        MY_UCID = p.UCID;
        if (p.ClickID === 239) {
             renderUI(MY_UCID, 'main');
             return; 
        }
    }

    if (p.UCID !== MY_UCID) return;
    const state = playerStates.get(MY_UCID);

    if (p.ClickID === 239) renderUI(MY_UCID, 'main');
    else if (p.ClickID === 215) renderUI(MY_UCID, 'icon');
    else if (p.ClickID === 214) stopRadio();
    else if (p.ClickID === 216) changeVolume(-5);
    else if (p.ClickID === 217) changeVolume(+5);
    else if (p.ClickID === 226) { if (ENABLE_DEBUG) console.log('[CLICK] Pause/Play'); togglePause(); }
    else if (p.ClickID === 227) { if (ENABLE_DEBUG) console.log('[CLICK] Previous'); playPrevTrack(); }
    else if (p.ClickID === 228) { if (ENABLE_DEBUG) console.log('[CLICK] Next'); playNextTrack(); }
    else if (p.ClickID === 229) { if (ENABLE_DEBUG) console.log('[CLICK] Shuffle'); toggleShuffle(); if (isOverlayVisible) showNowPlayingOverlay(lastNowPlayingInfo); }
    else if (p.ClickID === 238 || p.ClickID === 234) { 
        // Clear search při kliknutí na search box
        if (localMusicSearchQuery) {
            localMusicSearchQuery = '';
            localMusicSearchResults = [];
        }
        renderUI(MY_UCID, 'local_music'); 
    }
    else if (p.ClickID === 210) renderUI(MY_UCID, 'favorites');
    else if (p.ClickID === 211) renderUI(MY_UCID, 'recent');
    else if (p.ClickID === 212) renderUI(MY_UCID, 'abradia', await getAbradiaStations(), 0);
    else if (p.ClickID === 220) renderUI(MY_UCID, 'search');
    else if (p.ClickID === 234) { if (ENABLE_DEBUG) console.log('[CLICK] LOCAL MUSIC button'); refreshLocalMusic(); renderUI(MY_UCID, 'local_music'); }
    else if (p.ClickID === 223) { if (ENABLE_DEBUG) console.log('[CLICK] PLAYLISTS button'); refreshLocalMusic(); renderUI(MY_UCID, 'playlists'); }
    else if (p.ClickID === 222) { if (ENABLE_DEBUG) console.log('[CLICK] BACK button'); renderUI(MY_UCID, 'main'); }
    else if (p.ClickID === 213) { currentLang = currentLang === 'en' ? 'cz' : 'en'; saveConfig(); renderUI(MY_UCID, 'main'); }
    else if (p.ClickID === 235 || p.ClickID === 237) {
        let list = [];
        if (state.state === 'main') {
            // Main menu má 2 stránky (0, 1)
            let newPage = state.page + (p.ClickID === 235 ? -1 : 1);
            if (ENABLE_DEBUG) console.log(`[DEBUG] Main pagination: clickID=${p.ClickID}, oldPage=${state.page}, newPage=${newPage}`);
            if (newPage >= 0 && newPage <= 1) renderUI(MY_UCID, 'main', [], newPage);
        } else {
            if (state.state === 'favorites') list = radioConfig.favorites;
            else if (state.state === 'recent') list = radioConfig.recent;
            else if (state.state === 'local_music') list = getLocalMusicFiles();
            else if (state.state === 'playlists') list = getPlaylists();
            else list = state.searchResults;
            let newPage = state.page + (p.ClickID === 235 ? -1 : 1);
            if(newPage >= 0 && newPage < Math.ceil(list.length/ITEMS_PER_PAGE)) renderUI(MY_UCID, state.state, list, newPage);
        }
    }

    else if (p.ClickID >= 230 && p.ClickID < 235) {
        const idx = (state.page * ITEMS_PER_PAGE) + (p.ClickID - 230);
        let list = [];
        if (state.state === 'favorites') list = radioConfig.favorites;
        else if (state.state === 'recent') list = radioConfig.recent;
        else if (state.state === 'local_music') {
            // Použij search results pokud hledáš, jinak celý seznam
            list = localMusicSearchQuery ? localMusicSearchResults : getLocalMusicFiles();
            if (ENABLE_DEBUG) console.log(`[CLICK] local_music: query="${localMusicSearchQuery}", list size=${list.length}, idx=${idx}`);
        }
        else if (state.state === 'playlists') list = getPlaylists();
        else list = state.searchResults;
        const station = list[idx];
        if (station) {
            // LOCAL MUSIC: Použij path (filesystem) pokud existuje
            if (station.path && station.path.includes('music')) {
                // Nastav playlist POUZE pokud ještě není nastavený nebo je jiný
                if (state.state === 'local_music') {
                    // Pokud je search aktivní, najdi index v PLNÉM playlistu
                    if (localMusicSearchQuery) {
                        const fullList = getLocalMusicFiles();
                        const fullIndex = fullList.findIndex(t => t.id === station.id);
                        if (ENABLE_DEBUG) console.log(`[HANDLER] Search active: found "${station.name}" at index ${fullIndex} in full playlist`);
                        setPlaylist(fullList, fullIndex >= 0 ? fullIndex : 0);
                    } else {
                        // Normální přehrávání bez search
                        const isSamePlaylist = currentPlaylist.length === list.length && 
                                              currentPlaylist[0]?.id === list[0]?.id;
                        
                        if (!isSamePlaylist) {
                            if (ENABLE_DEBUG) console.log(`[HANDLER] Setting NEW playlist (${list.length} tracks)`);
                            setPlaylist(list, idx);
                        } else {
                            if (ENABLE_DEBUG) console.log(`[HANDLER] Same playlist, updating index to ${idx}`);
                            currentTrackIndex = idx;
                        }
                    }
                }
                else if (state.state === 'playlists') {
                    const isSamePlaylist = currentPlaylist.length === list.length && 
                                          currentPlaylist[0]?.id === list[0]?.id;
                    if (!isSamePlaylist) {
                        setPlaylist(list, idx);
                    } else {
                        currentTrackIndex = idx;
                    }
                }
                
                if (ENABLE_DEBUG) console.log(`[HANDLER] Playing local file: ${station.path}`);
                playRadioStream(station.path, station.name, { provider: 'local', ...station });
            }
            else if (station.tracks && station.tracks.length > 0) {
            
                setPlaylist(station.tracks, 0);

                const firstTrack = station.tracks[0];
                const url = firstTrack.url || firstTrack.path;
                playRadioStream(url, `${station.name} - ${firstTrack.name}`, { provider: 'playlist', playlistName: station.name, ...station });
            }
            else
            if (station.provider === 'abradia' || station.slug) {
                const prep = await prepareAbradiaStation(station.slug);
                if(prep) playRadioStream(prep.url, station.name, { provider: 'abradia', slug: station.slug, programs: prep.programs });
            } else {
                playRadioStream(station.url, station.name, station);
                if (station.id) voteForStation(station.id);
            }
        }
    }
    else if (p.ClickID === OVERLAY_CLOSE) clearNowPlayingOverlay();
});

inSim.on(PacketType.ISP_BTT, async (p) => {
    if (p.UCID !== MY_UCID) return;
    
    // Radio search
    if (p.ClickID === 221 && p.Text) {
        try { renderUI(MY_UCID, 'results', await searchStationsByName(p.Text, 30), 0); } catch(e){}
    }
    
    // Local music search
    if (p.ClickID === 238 && p.Text) {
        localMusicSearchQuery = p.Text;
        const results = searchLocalMusic(p.Text);
        renderUI(MY_UCID, 'local_music', null, 0);
    }
});

wssRadio.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'init', radio: { station: currentStation, volume: currentVolume, metadata: currentMetadata } }));
  ws.on('message', (raw) => {
    try {
        const msg = JSON.parse(raw);
        if (msg.type === 'change_volume') changeVolume(msg.delta);
        if (msg.type === 'get_status') ws.send(JSON.stringify({ type: 'init', radio: { station: currentStation, volume: currentVolume, metadata: currentMetadata } }));
    } catch(e){}
  });
});

initRadioBrowser();