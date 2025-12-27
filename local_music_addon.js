// === ADDON: LOKALNI HUDBA A M3U PLAYLISTY ===
// Pridat k existujicimu server.js

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import http from 'http';
import express from 'express';
// Přidej import na začátek
import { parseFile } from 'music-metadata';

// Konfigurace
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOCAL_MUSIC_FOLDER = join(__dirname, 'music');
const LOCAL_PLAYLISTS_FOLDER = join(__dirname, 'playlists');
const HTTP_SERVER_PORT = 3002;

// Přidej na začátek souboru (po importech)
let currentPlaylist = null;
let currentTrackIndex = 0;
let isPlaylistPlaying = false;

let localMusicFiles = [];
let localPlaylists = [];

// === SCAN LOKALNI HUDBY ===

// === NOVÁ FUNKCE: NAČTI METADATA ===
async function extractMetadata(filePath) {
  try {
    const metadata = await parseFile(filePath);
    return {
      title: metadata.common.title || null,
      artist: metadata.common.artist || null,
      album: metadata.common.album || null,
      duration: metadata.format.duration || null, // v sekundách
      year: metadata.common.year || null
    };
  } catch (e) {
    if (ENABLE_DEBUG) console.warn(`[Metadata] Chyba čtení: ${filePath}`);
    return null;
  }
}

export async function scanLocalMusic() {
  try {
    if (!fs.existsSync(LOCAL_MUSIC_FOLDER)) {
      fs.mkdirSync(LOCAL_MUSIC_FOLDER, { recursive: true });
      console.log(`📁 Vytvorena slozka: ${LOCAL_MUSIC_FOLDER}`);
      return [];
    }

    const files = fs.readdirSync(LOCAL_MUSIC_FOLDER);
    const musicFiles = files.filter(file => {
      const ext = file.toLowerCase();
      return ext.endsWith('.mp3') || ext.endsWith('.mp4') || ext.endsWith('.m4a') || 
             ext.endsWith('.wav') || ext.endsWith('.ogg') || ext.endsWith('.flac');
    });

    // PARALELNÍ NAČÍTÁNÍ METADAT
    const promises = musicFiles.map(async (file, index) => {
      const nameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file;
      const fullPath = join(LOCAL_MUSIC_FOLDER, file);
      
      const metadata = await extractMetadata(fullPath);
      
      return {
        id: `local_${index}`,
        filename: file,
        name: nameWithoutExt,
        path: fullPath,
        url: `/music/${encodeURIComponent(file)}`,
        // METADATA:
        title: metadata?.title || nameWithoutExt,
        artist: metadata?.artist || 'Unknown Artist',
        album: metadata?.album || null,
        duration: metadata?.duration || null
      };
    });

    localMusicFiles = await Promise.all(promises);
    console.log(`🎵 Nacteno ${localMusicFiles.length} lokalnich skladeb (s metadaty)`);
    return localMusicFiles;
  } catch (e) {
    console.error('❌ Chyba scan lokalni hudby:', e.message);
    return [];
  }
}

// === SCAN M3U PLAYLISTU ===
export async function scanPlaylists() {
  try {
    if (!fs.existsSync(LOCAL_PLAYLISTS_FOLDER)) {
      fs.mkdirSync(LOCAL_PLAYLISTS_FOLDER, { recursive: true });
      console.log(`📁 Vytvorena slozka: ${LOCAL_PLAYLISTS_FOLDER}`);
      return [];
    }

    const files = fs.readdirSync(LOCAL_PLAYLISTS_FOLDER);
    const m3uFiles = files.filter(f => f.toLowerCase().endsWith('.m3u') || f.toLowerCase().endsWith('.m3u8'));

    const promises = m3uFiles.map(async (file, index) => {
      const nameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file;
      const fullPath = join(LOCAL_PLAYLISTS_FOLDER, file);
      const tracks = await parseM3U(fullPath); // ASYNC!
      
      return {
        id: `playlist_${index}`,
        filename: file,
        name: nameWithoutExt,
        path: fullPath,
        tracks: tracks
      };
    });

    localPlaylists = await Promise.all(promises);
    console.log(`📋 Nacteno ${localPlaylists.length} playlistu`);
    return localPlaylists;
  } catch (e) {
    console.error('❌ Chyba scan playlistu:', e.message);
    return [];
  }
}

// === PARSE M3U SOUBORU ===
async function parseM3U(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const playlistDir = dirname(filePath);
    
    const promises = lines.map(async (line, index) => {
      // Pokud je to URL
      if (line.startsWith('http://') || line.startsWith('https://')) {
        return {
          id: `m3u_${index}`,
          name: `Stream ${index + 1}`,
          url: line,
          type: 'stream'
        };
      }
      
      const isAbsolutePath = line.match(/^([A-Z]:\\|\/)/i);
      const fullPath = isAbsolutePath ? line : join(playlistDir, line);
      
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Soubor nenalezen: ${fullPath}`);
        return null;
      }
      
      const fileName = fullPath.split(/[/\\]/).pop();
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      
      // NAČTI METADATA
      const metadata = await extractMetadata(fullPath);
      
      return {
        id: `m3u_${index}`,
        name: nameWithoutExt,
        path: fullPath,
        type: 'file',
        // METADATA:
        title: metadata?.title || nameWithoutExt,
        artist: metadata?.artist || 'Unknown Artist',
        album: metadata?.album || null,
        duration: metadata?.duration || null
      };
    });
    
    const results = await Promise.all(promises);
    return results.filter(item => item !== null);
  } catch (e) {
    console.error('❌ Chyba parsovani M3U:', e.message);
    return [];
  }
}


// === HTTP SERVER PRO STREAMING ===
export function startMusicServer() {
  const app = express();
  
  // Staticke soubory z music slozky
  app.use('/music', express.static(LOCAL_MUSIC_FOLDER));
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      localMusic: localMusicFiles.length,
      playlists: localPlaylists.length
    });
  });
  
  // Seznam skladeb
  app.get('/api/local-music', (req, res) => {
    res.json(localMusicFiles);
  });
  
  // Seznam playlistu
  app.get('/api/playlists', (req, res) => {
    res.json(localPlaylists);
  });

  // Playlist player endpointy
  app.get('/api/playlist/current', (req, res) => {
    res.json(getCurrentPlaylistInfo());
  });
  
  app.post('/api/playlist/select/:playlistId', (req, res) => {
    const result = setCurrentPlaylist(req.params.playlistId);
    res.json(result);
  });
  
  app.post('/api/playlist/next', (req, res) => {
    const result = playlistNext();
    res.json(result);
  });
  
  app.post('/api/playlist/previous', (req, res) => {
    const result = playlistPrevious();
  });
  
  app.post('/api/playlist/toggle', (req, res) => {
    const result = playlistTogglePlay();
    res.json(result);
  });
  
  app.listen(HTTP_SERVER_PORT, () => {
    console.log(`🌐 HTTP server bezi na http://localhost:${HTTP_SERVER_PORT}`);
    console.log(`📁 Lokalni hudba: ${LOCAL_MUSIC_FOLDER}`);
    console.log(`📋 Playlisty: ${LOCAL_PLAYLISTS_FOLDER}`);
  });
}

// === EXPORT ===

// === PLAYLIST PLAYER LOGIC ===
export function setCurrentPlaylist(playlistId) {
  const playlist = localPlaylists.find(p => p.id === playlistId);
  if (!playlist) {
    return { success: false, error: 'Playlist nenalezen' };
  }
  
  currentPlaylist = playlist;
  currentTrackIndex = 0;
  isPlaylistPlaying = true;
  
  return {
    success: true,
    playlist: playlist.name,
    track: currentPlaylist.tracks[0]
  };
}

export function playlistNext() {
  if (!currentPlaylist || !currentPlaylist.tracks.length) {
    return { success: false, error: 'Žádný playlist nehraje' };
  }
  
  currentTrackIndex++;
  if (currentTrackIndex >= currentPlaylist.tracks.length) {
    currentTrackIndex = 0; // Loop
  }
  
  return {
    success: true,
    currentIndex: currentTrackIndex,
    track: currentPlaylist.tracks[currentTrackIndex]
  };
}

export function playlistPrevious() {
  if (!currentPlaylist || !currentPlaylist.tracks.length) {
    return { success: false, error: 'Žádný playlist nehraje' };
  }
  
  currentTrackIndex--;
  if (currentTrackIndex < 0) {
    currentTrackIndex = currentPlaylist.tracks.length - 1;
  }
  
  return {
    success: true,
    currentIndex: currentTrackIndex,
    track: currentPlaylist.tracks[currentTrackIndex]
  };
}

export function playlistTogglePlay() {
  if (!currentPlaylist) {
    return { success: false, error: 'Žádný playlist nehraje' };
  }
  
  isPlaylistPlaying = !isPlaylistPlaying;
  return {
    success: true,
    playing: isPlaylistPlaying
  };
}

export function getCurrentPlaylistInfo() {
  if (!currentPlaylist) {
    return {
      playing: false,
      playlist: null,
      track: null
    };
  }
  
  return {
    playing: isPlaylistPlaying,
    playlist: currentPlaylist.name,
    playlistId: currentPlaylist.id,
    currentIndex: currentTrackIndex,
    totalTracks: currentPlaylist.tracks.length,
    track: currentPlaylist.tracks[currentTrackIndex]
  };
}
export async function initLocalMusic() {
  await scanLocalMusic();
  await scanPlaylists();
  startMusicServer();
}

export function getLocalMusicFiles() {
  return localMusicFiles;
}

export function getPlaylists() {
  return localPlaylists;
}

export async function refreshLocalMusic() {
  await scanLocalMusic();
  await scanPlaylists();
}