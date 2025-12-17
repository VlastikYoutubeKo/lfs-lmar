// LFS InSim Live Map + Radio Server - FINAL STABLE + MULTILANGUAGE
// Requires: npm install node-insim ws

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

// === ANSI COLORS ===
const colors = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

// === LFS CODEPAGE SUPPORT ===
// Mapování Windows codepages podle LFS dokumentace
const LFS_CODEPAGES = {
  'L': { code: 1252, name: 'Latin 1' },      // Default
  'G': { code: 1253, name: 'Greek' },
  'C': { code: 1251, name: 'Cyrillic' },
  'E': { code: 1250, name: 'Central Europe' },
  'T': { code: 1254, name: 'Turkish' },
  'B': { code: 1257, name: 'Baltic' },
  'J': { code: 932,  name: 'Japanese' },
  'S': { code: 936,  name: 'Simplified Chinese' },
  'H': { code: 950,  name: 'Traditional Chinese' },
  'K': { code: 949,  name: 'Korean' }
};

// Speciální znaky které se často objevují v LFS nicích
const SPECIAL_CHARS_MAP = {
  '•': { char: '•', codepoint: 0x2022, codepage: 'G', name: 'BULLET' },
  '○': { char: '○', codepoint: 0x25CB, codepage: 'J', name: 'WHITE CIRCLE' },
  '●': { char: '●', codepoint: 0x25CF, codepage: 'J', name: 'BLACK CIRCLE' },
  '★': { char: '★', codepoint: 0x2605, codepage: 'J', name: 'BLACK STAR' },
  '☆': { char: '☆', codepoint: 0x2606, codepage: 'J', name: 'WHITE STAR' },
  '♪': { char: '♪', codepoint: 0x266A, codepage: 'G', name: 'EIGHTH NOTE' },
  '♫': { char: '♫', codepoint: 0x266B, codepage: 'G', name: 'BEAMED EIGHTH NOTES' },
  '█': { char: '█', codepoint: 0x2588, codepage: 'G', name: 'FULL BLOCK' },
  '▓': { char: '▓', codepoint: 0x2593, codepage: 'G', name: 'DARK SHADE' },
  '▒': { char: '▒', codepoint: 0x2592, codepage: 'G', name: 'MEDIUM SHADE' },
  '░': { char: '░', codepoint: 0x2591, codepage: 'G', name: 'LIGHT SHADE' }
};

// UTF-8 encoded CP1252 characters -> správný Unicode mapping
// LFS posílá některé znaky jako UTF-8 enkódované CP1252 bajty
const CP1252_UTF8_MAP = {
  '\u0095': '•',  // 0xC2 0x95 -> BULLET (CP1252 0x95)
  '\u008B': '‹',  // 0xC2 0x8B -> SINGLE LEFT ANGLE QUOTATION (CP1252 0x8B)
  '\u009B': '›',  // 0xC2 0x9B -> SINGLE RIGHT ANGLE QUOTATION (CP1252 0x9B)
  '\u0099': '™',  // 0xC2 0x99 -> TRADE MARK SIGN (CP1252 0x99)
};

// Fix UTF-8 encoded CP1252 characters
function fixCP1252Encoding(text) {
  let fixed = text;
  for (const [wrongChar, correctChar] of Object.entries(CP1252_UTF8_MAP)) {
    fixed = fixed.replace(new RegExp(wrongChar, 'g'), correctChar);
  }
  return fixed;
}

// Konverze LFS textu s automatickou detekcí codepage
function convertLFSText(text) {
  if (!text) return text;
  
  // KROK 1: Opravit UTF-8 encoded CP1252 znaky
  text = fixCP1252Encoding(text);
  
  let result = '';
  let currentCodepage = 'L'; // Default Latin 1
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charCode = char.charCodeAt(0);
    
    // ASCII znaky (0-127) jsou v pořádku všude
    if (charCode < 128) {
      result += char;
      continue;
    }
    
    // Zkontrolovat jestli je to LFS color/escape kód
    if (char === '^' && i + 1 < text.length) {
      result += char + text[i + 1];
      i++;
      continue;
    }
    
    // Zkusit najít znak ve speciálním mappingu
    const specialChar = SPECIAL_CHARS_MAP[char];
    if (specialChar) {
      // Přidat escape kód jen pokud se codepage změnil
      if (specialChar.codepage !== currentCodepage) {
        result += '^' + specialChar.codepage;
        currentCodepage = specialChar.codepage;
      }
      result += char;
      continue;
    }
    
    // Znak není v mappingu, zkusíme ho detekovat
    // Pro Latin 1 (CP1252) je rozsah 128-255
    if (charCode >= 128 && charCode <= 255) {
      // Pravděpodobně Latin 1 extended
      if (currentCodepage !== 'L') {
        result += '^L';
        currentCodepage = 'L';
      }
      result += char;
    } else {
      // Neznámý znak mimo základní rozsah - zkusíme Greek (má hodně symbolů)
      if (currentCodepage !== 'G') {
        result += '^G';
        currentCodepage = 'G';
      }
      result += char;
    }
  }
  
  return result;
}

// === TRANSLATIONS / PŘEKLADY ===
const TRANSLATIONS = {
    en: {
        GUI_TITLE: "^5 RADIO PLAYER",
        BTN_FAVORITES: "FAVORITES",
        BTN_RECENT: "RECENTLY PLAYED",
        BTN_ABRADIA: "ABRADIA.CZ",
        BTN_SEARCH: "SEARCH",
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
let MY_UCID = 255; // Bude nastaveno po připojení (255 = dosud neznámý)

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
let isOverlayVisible = false; // Persistent overlay flag
let currentLang = 'en'; // Default language

// Config
let radioConfig = { favorites: [], recent: [], lang: 'en' };

// === HELPER: TRANSLATE ===
function t(key) {
    return TRANSLATIONS[currentLang][key] || key;
}

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

// === MPV & AUDIO ===
let MPV_PATH = null;
let currentAudioProcess = null;
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

// === MAP WEBSOCKET HANDLER ===
wssMap.on('connection', (ws) => {
  console.log(`${colors.cyan}[Map WS]${colors.reset} Client connected`);
  
  // Send current track info (or default BL1 if not connected to LFS yet)
  const trackToSend = currentTrack || 'BL1';
  ws.send(JSON.stringify({
    type: 'track',
    track: trackToSend,
    layout: currentLayout
  }));
  
  // Send current car positions
  const mapData = Array.from(cars.values()).map(c => ({
    plid: c.plid,
    name: c.pname,
    x: c.x,
    y: c.y,
    z: c.z,
    speed: c.speed,
    heading: c.heading
  }));
  
  if (mapData.length > 0) {
    ws.send(JSON.stringify({ type: 'positions', cars: mapData }));
  }
  
  ws.on('close', () => {
    console.log(`${colors.cyan}[Map WS]${colors.reset} Client disconnected`);
  });
});

const radioServer = http.createServer();
const wssRadio = new WebSocketServer({ server: radioServer });
radioServer.listen(RADIO_WS_PORT, () => console.log(`${colors.magenta}[Radio WS]${colors.reset} Port ${RADIO_WS_PORT}`));

// === INSIM ===
const inSim = new InSim();
const cars = new Map();
let currentTrack = '';
let currentLayout = '';

// === WATCHDOG (PERSISTENT UI) ===
function startGuiWatchdog() {
    setInterval(() => {
        if (!isInSimConnected) return;

        // 1. Refresh Main UI
        const state = playerStates.get(MY_UCID);
        if (state) {
            renderUI(MY_UCID, state.state, state.searchResults, state.page);
        } else {
            playerStates.set(MY_UCID, { state: 'icon', searchResults: [], page: 0 });
            renderUI(MY_UCID, 'icon');
        }

        // 2. Refresh Overlay (Now Playing) if visible
        if (isOverlayVisible && currentStation) {
            showNowPlayingOverlay(lastNowPlayingInfo);
        }

    }, 3000); 
}

// === AUDIO LOGIC ===
function forceKillMpv() {
    if (metadataFetchTimer) { clearInterval(metadataFetchTimer); metadataFetchTimer = null; }
    if (ipcClient) { try { ipcClient.destroy(); } catch(e){} ipcClient = null; }
    try { execSync('taskkill /F /IM mpv.exe /T', { stdio: 'ignore' }); } catch (e) {}
}

async function playRadioStream(url, name, stationConfig = null) {
  forceKillMpv();
  currentStation = name;
  currentStationConfig = stationConfig;
  currentProgram = stationConfig?.programs?.[0] || null;
  updateMetadata(name, false); 
  
  addToRecent({ name, url: stationConfig?.originalUrl || url, ...stationConfig });

  if (MPV_PATH) {
      const args = ['--no-video', `--volume=${currentVolume}`, '--really-quiet', `--input-ipc-server=${MPV_PIPE}`, url];
      setTimeout(() => {
          currentAudioProcess = spawn(MPV_PATH, args);
          tryConnectIpc();
      }, 100);
      
      if (stationConfig?.provider === 'abradia' && stationConfig?.slug) startAbradiaMetadataFetch();
      
      broadcastRadioStatus(name, 'playing', { metadata: name });
      updateStatusButtons();
  }
}

function stopRadio() {
  forceKillMpv();
  if (tickerTimer) { clearInterval(tickerTimer); tickerTimer = null; }
  currentStation = null;
  currentMetadata = "";
  currentDisplayParts = [];
  
  clearNowPlayingOverlay(); // Sets isOverlayVisible = false
  
  broadcastRadioStatus('Stopped', 'stopped');
  updateStatusButtons();
}

function changeVolume(delta) {
    currentVolume = Math.min(100, Math.max(0, currentVolume + delta));
    if (ipcClient && !ipcClient.destroyed) ipcClient.write(JSON.stringify({ command: ["set_property", "volume", currentVolume] }) + '\n');
    updateVolumeButtonsOnly();
    broadcastRadioStatus(currentStation || 'Stopped', 'volume_change', { volume: currentVolume });
}

// === METADATA & OVERLAY ===
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
      
      broadcastRadioStatus(currentStation, 'metadata', { 
          artist: nowPlaying.artist,
          song: nowPlaying.song,
          fullTitle: nowPlaying.fullTitle
      });
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
                        if (!currentStationConfig?.provider) {
                            updateMetadata(msg.data, true);
                        }
                    }
                } catch(e){}
            });
        });
        client.on('error', () => { client.destroy(); tryConnectIpc(attempts + 1); });
    }, 300);
}

function updateMetadata(raw, shouldBroadcast = false) {
    if (!raw || raw.includes('Now Playing')) return;
    const hasChanged = currentMetadata !== raw;
    currentMetadata = raw;
    currentDisplayParts = raw.includes(" - ") ? raw.split(" - ") : [raw];
    
    let artist = "Radio";
    let song = raw;
    if (raw.includes(" - ")) {
        const parts = raw.split(" - ");
        artist = parts[0];
        song = parts.slice(1).join(" - ");
    }
    lastNowPlayingInfo = { artist, song, fullTitle: raw };

    if (tickerTimer) clearInterval(tickerTimer);
    tickerIndex = 0;
    updateStatusButtons();
    tickerTimer = setInterval(() => {
        tickerIndex = (tickerIndex + 1) % currentDisplayParts.length;
        updateStatusButtons();
    }, 5000);
    
    if (hasChanged && shouldBroadcast) {
        broadcastRadioStatus(currentStation, 'metadata', { fullTitle: raw });
        showNowPlayingOverlay(lastNowPlayingInfo);
    }
}

// === OVERLAY FUNCTIONS ===
function showNowPlayingOverlay(nowPlaying) {
    isOverlayVisible = true; 
    const W = 80; const L = 60; const T = 160; 
    const totalHeight = currentProgram ? 20 : 14; 
    
    sendBtn(MY_UCID, OVERLAY_BG, L, T, W, totalHeight, '', ButtonStyle.ISB_DARK);
    sendBtn(MY_UCID, OVERLAY_HEADER, L, T+1, W, 4, t('OVERLAY_HEADER'), ButtonStyle.ISB_DARK);
    sendBtn(MY_UCID, OVERLAY_CLOSE, L + W - 6, T+1, 5, 4, '^1X', ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);

    let artist = (nowPlaying.artist || "").substring(0, 40);
    let song = (nowPlaying.song || nowPlaying.fullTitle || "").substring(0, 40);
    
    sendBtn(MY_UCID, OVERLAY_ARTIST, L, T+5, W, 5, `^2${artist}`, ButtonStyle.ISB_DARK);
    sendBtn(MY_UCID, OVERLAY_SONG, L, T+9, W, 5, `^7${song}`, ButtonStyle.ISB_DARK);
    
    if (currentProgram) {
        let prog = currentProgram.name.substring(0, 40);
        sendBtn(MY_UCID, OVERLAY_PROGRAM, L, T+14, W, 5, `${t('OVERLAY_PROGRAM')}^7${prog}`, ButtonStyle.ISB_DARK);
    }
}

function clearNowPlayingOverlay() {
    isOverlayVisible = false;
    for (let i = OVERLAY_BG; i <= OVERLAY_CLOSE; i++) {
        inSim.send(new IS_BFN({ReqI: 1, SubT: 1, UCID: MY_UCID, ClickID: i}));
    }
}

// === GUI RENDERER ===
function sendBtn(ucid, id, l, t, w, h, text, style, typeIn = 0) {
    if (ucid !== MY_UCID) return;
    let finalStyle = style;
    if (typeIn > 0) finalStyle = style | ButtonStyle.ISB_CLICK;
    try { inSim.send(new IS_BTN({ ReqI: 1, UCID: ucid, ClickID: id, Inst: 0, BStyle: finalStyle, TypeIn: typeIn, L: l, T: t, W: w, H: h, Text: text })); } catch (e) {}
}

function clearGuiButtons(ucid) {
    if (ucid !== MY_UCID) return;
    for(let i=200; i<=239; i++) {
        try { inSim.send(new IS_BFN({ReqI: 1, SubT: 1, UCID: ucid, ClickID: i})); } catch (e) {}
    }
}

function updateStatusButtons() {
    const state = playerStates.get(MY_UCID);
    if (state && state.state === 'main') {
        let txt = !currentStation ? t('STATUS_STOPPED') : `^2${currentDisplayParts[tickerIndex] || currentStation}`;
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
    if (ucid !== MY_UCID) return;
    
    const oldState = playerStates.get(ucid);
    let searchResults = extraData || (oldState ? oldState.searchResults : []);
    playerStates.set(ucid, { state: requestedState, searchResults, page });

    clearGuiButtons(ucid); 

    if (requestedState === 'icon') {
        sendBtn(ucid, 239, UI_LEFT + 24, ICON_TOP, 5, 5, '^5[ ^7R ^5]', ButtonStyle.ISB_DARK | ButtonStyle.ISB_CLICK);
        return;
    }

    const L = UI_LEFT; const T = UI_TOP;
    let height = 61; // Increased height to fit Language button
    let title = t('GUI_TITLE');
    
    if (requestedState === 'main') {
        sendBtn(ucid, 201, L, T, 30, 4, title, ButtonStyle.ISB_DARK);
        
        // Navigation Buttons
        sendBtn(ucid, 210, L+1, T+5, 28, 5, `^3[ ^7${t('BTN_FAVORITES')} ^3]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(ucid, 211, L+1, T+11, 28, 5, `^6[ ^7${t('BTN_RECENT')} ^6]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(ucid, 212, L+1, T+17, 28, 5, `^4[ ^7${t('BTN_ABRADIA')} ^4]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(ucid, 220, L+1, T+23, 28, 5, `^3[ ^7${t('BTN_SEARCH')} ^3]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        
        // Language Toggle Button (New)
        sendBtn(ucid, 213, L+1, T+29, 28, 5, `^7[ ^0${t('BTN_LANG')} ^7]`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        
        // Status Bar
        let txt = currentStation ? `^2${currentDisplayParts[tickerIndex] || currentStation}` : t('STATUS_STOPPED');
        sendBtn(ucid, 225, L+1, T+36+5, 28, 4, txt.substring(0,27), ButtonStyle.ISB_DARK);
        
        // Controls
        sendBtn(ucid, 216, L+1, T+41+5, 5, 5, '^1-', ButtonStyle.ISB_CLICK | ButtonStyle.ISB_LIGHT);
        sendBtn(ucid, 218, L+7, T+41+5, 16, 5, `^7VOL: ^3${currentVolume}%`, ButtonStyle.ISB_LIGHT);
        sendBtn(ucid, 217, L+24, T+41+5, 5, 5, '^2+', ButtonStyle.ISB_CLICK | ButtonStyle.ISB_LIGHT);

        sendBtn(ucid, 214, L+1, T+47+5, 14, 5, `^1${t('BTN_STOP')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        sendBtn(ucid, 215, L+15, T+47+5, 14, 5, `^8${t('BTN_CLOSE')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
    } 
    else {
        let dataSource = [];
        if (requestedState === 'favorites') { dataSource = radioConfig.favorites; title = t('TITLE_FAV'); }
        else if (requestedState === 'recent') { dataSource = radioConfig.recent; title = t('TITLE_RECENT'); }
        else if (requestedState === 'abradia') { dataSource = searchResults; title = t('TITLE_ABRADIA'); }
        else if (requestedState === 'results') { dataSource = searchResults; title = t('TITLE_RESULTS'); }
        else if (requestedState === 'search') { title = t('TITLE_SEARCH'); height = 20; }

        if (requestedState === 'search') {
             sendBtn(ucid, 221, L+1, T+5, 28, 5, t('SEARCH_PLACEHOLDER'), ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK, 95);
             sendBtn(ucid, 222, L+1, T+12, 28, 5, `^8${t('BTN_BACK')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        } else {
            height = 25 + (ITEMS_PER_PAGE * 6);
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
            sendBtn(ucid, 222, L+1, navTop + 6, 28, 5, `^8${t('BTN_BACK')}`, ButtonStyle.ISB_LIGHT | ButtonStyle.ISB_CLICK);
        }
    }
    sendBtn(ucid, 200, L, T, 30, height, '', ButtonStyle.ISB_DARK);
}

function broadcastRadioStatus(station, status, extra = null) {
  const msg = { type: 'radio_status', station, status };
  if (extra) Object.assign(msg, extra);
  wssRadio.clients.forEach(c => { if(c.readyState===1) c.send(JSON.stringify(msg)); });
}

// === HANDLERS ===
inSim.connect({ Host: '127.0.0.1', Port: 29999, IName: 'LiveMap', Flags: InSimFlags.ISF_MCI | InSimFlags.ISF_LOCAL, ReqI: IS_ISI_ReqI.SEND_VERSION, Interval: 250, Admin: '' });

inSim.on('connect', () => {
  console.log(`${colors.green}[InSim]${colors.reset} Connected.`);
  isInSimConnected = true;
  playerStates.set(MY_UCID, { state: 'icon', searchResults: [], page: 0 });
  
  // Request player list and track info
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_SST })); // Send STate

  // !!! PŘIDAT TENTO ŘÁDEK !!!
  // Vyžádat si seznam připojení, abychom našli lokálního hráče i po restartu scriptu
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NCN }));
  
  renderUI(MY_UCID, 'icon');
  startGuiWatchdog();
});

inSim.on('disconnect', () => { 
    isInSimConnected = false; 
    console.log(`${colors.red}[InSim]${colors.reset} Disconnected.`);
    
    // Vyčistit všechna data
    cars.clear();
    currentTrack = '';
    currentLayout = '';
    
    // Informovat WebSocket klienty o disconnectu
    wssMap.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'disconnect'
        }));
      }
    });
});

// === MAP DATA HANDLERS ===
inSim.on(PacketType.ISP_ISM, (p) => {
  // ISP_ISM se volá když joinneme na nový server
  console.log(`${colors.green}[Server]${colors.reset} Joined: ${p.HName || 'Local'}`);
  
  // Vyčistit stará data
  cars.clear();
  currentTrack = '';
  currentLayout = '';
  
  // Vyžádat si nová data
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL })); // Player list
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_SST })); // Track info
});

inSim.on(PacketType.ISP_STA, (p) => {
  const newTrack = p.Track;
  
  // Ignorovat prázdné tracky a logovat jen skutečné změny
  if (newTrack && newTrack !== currentTrack) {
    currentTrack = newTrack;
    currentLayout = ''; // IS_STA neobsahuje layout name
    
    const trackName = getTrackName(currentTrack);
    console.log(`${colors.blue}[Track]${colors.reset} ${trackName} (${currentTrack})`);
    
    // Broadcast track change to all map clients
    wssMap.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'track',
          track: currentTrack,
          layout: currentLayout
        }));
      }
    });
  }
});

// Detekce lokálního hráče (ISP_NCN = New ConN)
inSim.on(PacketType.ISP_NCN, (p) => {
  // Admin flag znamená že je to lokální hráč
  if (p.Admin) {
    MY_UCID = p.UCID;
    console.log(`${colors.cyan}[System]${colors.reset} Local player detected: ${p.UName} (UCID: ${p.UCID})`);
  }
});

inSim.on(PacketType.ISP_NPL, (p) => {
  // Debug: zobrazit raw bytes v jménu
  const nameBytes = Buffer.from(p.PName, 'utf8');
  console.log(`${colors.magenta}[Debug]${colors.reset} PName raw: "${p.PName}"`);
  console.log(`${colors.magenta}[Debug]${colors.reset} Bytes: ${Array.from(nameBytes).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Konvertovat jméno hráče s codepage escape kódy
  const convertedName = convertLFSText(p.PName);
  
  // Debug: pokud se jméno změnilo, loguj to
  if (convertedName !== p.PName) {
    console.log(`${colors.cyan}[Codepage]${colors.reset} Converted: "${p.PName}" → "${convertedName}"`);
  }
  
  cars.set(p.PLID, {
    plid: p.PLID,
    ucid: p.UCID,
    pname: convertedName,  // Použít konvertované jméno
    plate: p.Plate,
    cname: p.CName,
    x: 0,
    y: 0,
    z: 0,
    speed: 0,
    heading: 0
  });
  
  // Logovat všechny hráče včetně lokálního
  const playerType = p.UCID === MY_UCID ? '[YOU] ' : '';
  console.log(`${colors.green}[Player]${colors.reset} ${playerType}${p.PName} joined (PLID: ${p.PLID})`);
  
  // Debug: pokud se jméno změnilo, loguj to
  if (convertedName !== p.PName) {
    console.log(`${colors.cyan}[Codepage]${colors.reset} Converted: "${p.PName}" → "${convertedName}"`);
  }
});

inSim.on(PacketType.ISP_PLL, (p) => {
  cars.delete(p.PLID);
  console.log(`${colors.yellow}[Player]${colors.reset} PLID ${p.PLID} left`);
});

inSim.on(PacketType.ISP_TINY, (p) => {
  // TINY_MPE = MultiPlayer End - když hráč opustí multiplayer server
  if (p.SubT === TinyType.TINY_MPE) {
    console.log(`${colors.yellow}[Server]${colors.reset} Left multiplayer server - clearing data`);
    
    // Vyčistit všechna data
    cars.clear();
    currentTrack = '';
    currentLayout = '';
    
    // Informovat WebSocket klienty
    wssMap.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({
          type: 'server_left',
          message: 'Left server'
        }));
      }
    });
  }
});

inSim.on(PacketType.ISP_MCI, (p) => {
  p.Info.forEach(carInfo => {
    const car = cars.get(carInfo.PLID);
    if (car) {
      car.x = carInfo.X / 65536;
      car.y = carInfo.Y / 65536;
      car.z = carInfo.Z / 65536;
      car.speed = carInfo.Speed / 327.68; // m/s
      car.heading = carInfo.Heading / 182.044; // degrees
    }
  });
  
  // Broadcast to all map WebSocket clients
  const mapData = Array.from(cars.values()).map(c => ({
    plid: c.plid,
    name: c.pname,
    x: c.x,
    y: c.y,
    z: c.z,
    speed: c.speed,
    heading: c.heading
  }));
  
  wssMap.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'positions', cars: mapData }));
    }
  });
});

inSim.on(PacketType.ISP_MSO, (p) => {
    if (p.UserType === UserType.MSO_O) {
        const msg = p.Msg; 
        if (msg === 'gui') {
            // !!! OPRAVA ZAČÁTEK !!!
            // Pokud napíšeš /o gui, script si tě nastaví jako hlavního uživatele
            if (MY_UCID === 255 || MY_UCID !== p.UCID) {
                console.log(`${colors.cyan}[System]${colors.reset} Přebírám ovládání pro UCID: ${p.UCID}`);
                
                // Přenést stav ze starého ID na nové, pokud existuje
                const oldState = playerStates.get(MY_UCID);
                if (oldState) {
                    playerStates.set(p.UCID, oldState);
                    playerStates.delete(MY_UCID);
                    clearGuiButtons(MY_UCID); // Smazat staré tlačítka
                }
                MY_UCID = p.UCID;
            }
            // !!! OPRAVA KONEC !!!

            const state = playerStates.get(MY_UCID);
            // Pokud stav neexistuje, vytvoříme ho
            if (!state) {
                 playerStates.set(MY_UCID, { state: 'main', searchResults: [], page: 0 });
                 renderUI(MY_UCID, 'main');
            } else {
                 // Reset do hlavního menu
                 state.state = 'main';
                 renderUI(MY_UCID, 'main', state.searchResults, state.page);
            }
            console.log(`${colors.cyan}[Command]${colors.reset} ${t('MSG_GUI_RESET')}`);
        }
        else if (msg === 'np') {
            if (currentStation) {
                showNowPlayingOverlay(lastNowPlayingInfo);
                console.log(`${colors.cyan}[Command]${colors.reset} ${t('MSG_NP_SHOW')}`);
            } else {
                console.log(`${colors.yellow}[Command]${colors.reset} ${t('MSG_NP_EMPTY')}`);
            }
        }
    }
});

inSim.on(PacketType.ISP_BTC, async (p) => {
    if (p.UCID !== MY_UCID) return;
    const state = playerStates.get(MY_UCID);

    if (p.ClickID === 239) renderUI(MY_UCID, 'main');
    else if (p.ClickID === 215) renderUI(MY_UCID, 'icon');
    else if (p.ClickID === 214) stopRadio();
    else if (p.ClickID === 216) changeVolume(-5);
    else if (p.ClickID === 217) changeVolume(+5);
    else if (p.ClickID === 210) renderUI(MY_UCID, 'favorites');
    else if (p.ClickID === 211) renderUI(MY_UCID, 'recent');
    else if (p.ClickID === 212) renderUI(MY_UCID, 'abradia', await getAbradiaStations(), 0);
    else if (p.ClickID === 220) renderUI(MY_UCID, 'search');
    else if (p.ClickID === 222) renderUI(MY_UCID, 'main');
    
    // LANGUAGE SWITCH (Button 213)
    else if (p.ClickID === 213) {
        currentLang = currentLang === 'en' ? 'cz' : 'en';
        saveConfig(); // Save preference
        renderUI(MY_UCID, 'main'); // Refresh UI
    }

    // Pagination
    else if (p.ClickID === 235 || p.ClickID === 237) {
        let list = [];
        if (state.state === 'favorites') list = radioConfig.favorites;
        else if (state.state === 'recent') list = radioConfig.recent;
        else list = state.searchResults;
        
        let newPage = state.page + (p.ClickID === 235 ? -1 : 1);
        if(newPage >= 0 && newPage < Math.ceil(list.length/ITEMS_PER_PAGE)) renderUI(MY_UCID, state.state, list, newPage);
    }
    
    // Station Selection
    else if (p.ClickID >= 230 && p.ClickID < 235) {
        const idx = (state.page * ITEMS_PER_PAGE) + (p.ClickID - 230);
        let list = [];
        if (state.state === 'favorites') list = radioConfig.favorites;
        else if (state.state === 'recent') list = radioConfig.recent;
        else list = state.searchResults;

        const station = list[idx];
        if (station) {
            if (station.provider === 'abradia' || station.slug) {
                const prep = await prepareAbradiaStation(station.slug);
                if(prep) playRadioStream(prep.url, station.name, { provider: 'abradia', slug: station.slug, programs: prep.programs });
            } else {
                playRadioStream(station.url, station.name, station);
                if (station.id) voteForStation(station.id);
            }
        }
    }
    // Close Overlay
    else if (p.ClickID === OVERLAY_CLOSE) {
        clearNowPlayingOverlay();
    }
});

inSim.on(PacketType.ISP_BTT, async (p) => {
    if (p.UCID === MY_UCID && p.ClickID === 221 && p.Text) {
        try { renderUI(MY_UCID, 'results', await searchStationsByName(p.Text, 30), 0); } catch(e){}
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