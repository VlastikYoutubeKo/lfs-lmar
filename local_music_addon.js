// === ADDON: LOKALNI HUDBA A M3U PLAYLISTY ===
// Pridat k existujicimu server.js

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import http from 'http';
import express from 'express';

// Konfigurace
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOCAL_MUSIC_FOLDER = join(__dirname, 'music');
const LOCAL_PLAYLISTS_FOLDER = join(__dirname, 'playlists');
const HTTP_SERVER_PORT = 3002;

let localMusicFiles = [];
let localPlaylists = [];

// === SCAN LOKALNI HUDBY ===
export function scanLocalMusic() {
  try {
    if (!fs.existsSync(LOCAL_MUSIC_FOLDER)) {
      fs.mkdirSync(LOCAL_MUSIC_FOLDER, { recursive: true });
      console.log(`📁 Vytvorena slozka: ${LOCAL_MUSIC_FOLDER}`);
      return [];
    }

    const files = fs.readdirSync(LOCAL_MUSIC_FOLDER);
    const musicFiles = files.filter(file => {
      const ext = join(file).toLowerCase();
      return ext.endsWith('.mp3') || ext.endsWith('.mp4') || ext.endsWith('.m4a') || 
             ext.endsWith('.wav') || ext.endsWith('.ogg') || ext.endsWith('.flac');
    });

    localMusicFiles = musicFiles.map((file, index) => {
      const nameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file;
      return {
        id: `local_${index}`,
        filename: file,
        name: nameWithoutExt, // Jen nazev bez pripony
        path: join(LOCAL_MUSIC_FOLDER, file),
        url: `/music/${encodeURIComponent(file)}`
      };
    });

    console.log(`🎵 Nacteno ${localMusicFiles.length} lokalnich skladeb`);
    return localMusicFiles;
  } catch (e) {
    console.error('❌ Chyba scan lokalni hudby:', e.message);
    return [];
  }
}

// === SCAN M3U PLAYLISTU ===
export function scanPlaylists() {
  try {
    if (!fs.existsSync(LOCAL_PLAYLISTS_FOLDER)) {
      fs.mkdirSync(LOCAL_PLAYLISTS_FOLDER, { recursive: true });
      console.log(`📁 Vytvorena slozka: ${LOCAL_PLAYLISTS_FOLDER}`);
      return [];
    }

    const files = fs.readdirSync(LOCAL_PLAYLISTS_FOLDER);
    const m3uFiles = files.filter(f => f.toLowerCase().endsWith('.m3u') || f.toLowerCase().endsWith('.m3u8'));

    localPlaylists = m3uFiles.map((file, index) => {
      const nameWithoutExt = file.substring(0, file.lastIndexOf('.')) || file;
      const fullPath = join(LOCAL_PLAYLISTS_FOLDER, file);
      const tracks = parseM3U(fullPath);
      
      return {
        id: `playlist_${index}`,
        filename: file,
        name: nameWithoutExt,
        path: fullPath,
        tracks: tracks
      };
    });

    console.log(`📋 Nacteno ${localPlaylists.length} playlistu`);
    return localPlaylists;
  } catch (e) {
    console.error('❌ Chyba scan playlistu:', e.message);
    return [];
  }
}

// === PARSE M3U SOUBORU ===
function parseM3U(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const playlistDir = dirname(filePath); // Složka kde je playlist
    
    return lines.map((line, index) => {
      // Pokud je to URL
      if (line.startsWith('http://') || line.startsWith('https://')) {
        return {
          id: `m3u_${index}`,
          name: `Stream ${index + 1}`,
          url: line,
          type: 'stream'
        };
      }
      
      // Pokud je to absolutní cesta (Windows: C:\... nebo Linux: /...)
      const isAbsolutePath = line.match(/^([A-Z]:\\|\/)/i);
      const fullPath = isAbsolutePath ? line : join(playlistDir, line);
      
      // Zkontroluj jestli soubor existuje
      if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Soubor nenalezen: ${fullPath}`);
        return null;
      }
      
      const fileName = fullPath.split(/[/\\]/).pop();
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
      
      return {
        id: `m3u_${index}`,
        name: nameWithoutExt,
        path: fullPath, // Plná cesta k souboru
        type: 'file'
      };
    }).filter(item => item !== null); // Odstraň neexistující soubory
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
  
  app.listen(HTTP_SERVER_PORT, () => {
    console.log(`🌐 HTTP server bezi na http://localhost:${HTTP_SERVER_PORT}`);
    console.log(`📁 Lokalni hudba: ${LOCAL_MUSIC_FOLDER}`);
    console.log(`📋 Playlisty: ${LOCAL_PLAYLISTS_FOLDER}`);
  });
}

// === EXPORT ===
export function initLocalMusic() {
  scanLocalMusic();
  scanPlaylists();
  startMusicServer();
}

export function getLocalMusicFiles() {
  return localMusicFiles;
}

export function getPlaylists() {
  return localPlaylists;
}

export function refreshLocalMusic() {
  scanLocalMusic();
  scanPlaylists();
}