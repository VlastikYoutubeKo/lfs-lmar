// Spotify Web API Integration
// Handles authentication, playback control, and now playing info

import https from 'https';
import { URLSearchParams } from 'url';

let spotifyConfig = {
  enabled: false,
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://127.0.0.1:3000/spotify/callback', // Musí se shodovat s nastavením na Spotify Dashboard
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null
};

// === ZDE BYLA CHYBA: POUŽIJTE OFICIÁLNÍ ADRESY ===
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_HOSTNAME = 'accounts.spotify.com';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

/**
 * Initialize Spotify configuration
 */
export function initSpotify(config) {
  if (config.spotify) {
    spotifyConfig = { ...spotifyConfig, ...config.spotify };
  }
  return spotifyConfig.enabled && spotifyConfig.clientId && spotifyConfig.clientSecret;
}

/**
 * Get current Spotify configuration
 */
export function getSpotifyConfig() {
  return {
    enabled: spotifyConfig.enabled,
    clientId: spotifyConfig.clientId,
    hasAuth: !!spotifyConfig.accessToken
  };
}

/**
 * Update Spotify configuration
 */
export function updateSpotifyConfig(updates) {
  spotifyConfig = { ...spotifyConfig, ...updates };
}

/**
 * Get Spotify tokens (for saving to config)
 */
export function getSpotifyTokens() {
  return {
    accessToken: spotifyConfig.accessToken,
    refreshToken: spotifyConfig.refreshToken,
    tokenExpiry: spotifyConfig.tokenExpiry
  };
}

/**
 * Generate authorization URL for OAuth flow
 */
export function getAuthUrl() {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing'
  ];

  const params = new URLSearchParams({
    client_id: spotifyConfig.clientId,
    response_type: 'code',
    redirect_uri: spotifyConfig.redirectUri,
    scope: scopes.join(' ')
  });

  return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: spotifyConfig.redirectUri
  });

  const auth = Buffer.from(`${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const postData = params.toString();

    const options = {
      hostname: SPOTIFY_ACCOUNTS_HOSTNAME, // OPRAVENO
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
            if (res.statusCode === 200) {
              const tokenData = JSON.parse(data);
              spotifyConfig.accessToken = tokenData.access_token;
              spotifyConfig.refreshToken = tokenData.refresh_token;
              spotifyConfig.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
              resolve(tokenData);
            } else {
              reject(new Error(`Token exchange failed: ${res.statusCode} ${data}`));
            }
        } catch (e) {
            reject(new Error(`Failed to parse token response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Refresh access token
 */
async function refreshAccessToken() {
  if (!spotifyConfig.refreshToken) {
    throw new Error('No refresh token available');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: spotifyConfig.refreshToken
  });

  const auth = Buffer.from(`${spotifyConfig.clientId}:${spotifyConfig.clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const postData = params.toString();

    const options = {
      hostname: SPOTIFY_ACCOUNTS_HOSTNAME, // OPRAVENO
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
            if (res.statusCode === 200) {
              const tokenData = JSON.parse(data);
              spotifyConfig.accessToken = tokenData.access_token;
              spotifyConfig.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
              if (tokenData.refresh_token) {
                spotifyConfig.refreshToken = tokenData.refresh_token;
              }
              resolve(tokenData);
            } else {
              reject(new Error(`Token refresh failed: ${res.statusCode} ${data}`));
            }
        } catch (e) {
            reject(new Error(`Failed to parse refresh response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Make authenticated request to Spotify API
 */
async function spotifyRequest(method, endpoint, body = null) {
  // Check if token needs refresh
  if (spotifyConfig.tokenExpiry && Date.now() >= spotifyConfig.tokenExpiry - 60000) {
    try {
        await refreshAccessToken();
    } catch (e) {
        console.error("Failed to refresh token:", e.message);
        // Continue anyway, maybe the current token is still valid for a second
    }
  }

  if (!spotifyConfig.accessToken) {
    throw new Error('Not authenticated with Spotify');
  }

  return new Promise((resolve, reject) => {
    // OPRAVENO: Správné sestavení URL
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const url = new URL(SPOTIFY_API_BASE + cleanEndpoint);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${spotifyConfig.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              // 202 Accepted, 204 No Content, or empty response - return null
              if (res.statusCode === 202 || res.statusCode === 204 || !data) {
                  resolve(null);
              } else {
                  // Only parse if data looks like JSON (starts with { or [)
                  const trimmedData = data.trim();
                  if (trimmedData.startsWith('{') || trimmedData.startsWith('[')) {
                      resolve(JSON.parse(data));
                  } else {
                      // Non-JSON successful response (hash/signature) - return null
                      resolve(null);
                  }
              }
            } else {
              // Error response - try to parse as JSON for error details
              let msg = data;
              try { msg = JSON.stringify(JSON.parse(data)); } catch(e){}
              reject(new Error(`Spotify API error: ${res.statusCode} ${msg}`));
            }
        } catch (e) {
            console.error("JSON Parse error for URL:", url.toString(), "Data:", data);
            reject(new Error(`Failed to parse API response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Get current playback state
 */
export async function getCurrentPlayback() {
  try {
    return await spotifyRequest('GET', '/me/player');
  } catch (err) {
    console.error('Failed to get Spotify playback:', err.message);
    return null;
  }
}

/**
 * Get currently playing track
 */
export async function getNowPlaying() {
  try {
    const playback = await getCurrentPlayback();
    if (!playback || !playback.item) {
      return null;
    }

    // Ochrana proti null u artists/images
    const artistName = playback.item.artists ? playback.item.artists.map(a => a.name).join(', ') : 'Unknown Artist';
    const artworkUrl = (playback.item.album && playback.item.album.images && playback.item.album.images.length > 0) 
        ? playback.item.album.images[0].url 
        : null;

    return {
      track: playback.item.name,
      artist: artistName,
      album: playback.item.album ? playback.item.album.name : '',
      isPlaying: playback.is_playing,
      progress: playback.progress_ms,
      duration: playback.item.duration_ms,
      artwork: artworkUrl
    };
  } catch (err) {
    // Tiché selhání, aby to nespamovalo log
    return null;
  }
}

/**
 * Play/Resume playback
 */
export async function play() {
  try {
    await spotifyRequest('PUT', '/me/player/play');
    return true;
  } catch (err) {
    console.error('Failed to play:', err.message);
    return false;
  }
}

/**
 * Pause playback
 */
export async function pause() {
  try {
    await spotifyRequest('PUT', '/me/player/pause');
    return true;
  } catch (err) {
    console.error('Failed to pause:', err.message);
    return false;
  }
}

/**
 * Skip to next track
 */
export async function next() {
  try {
    await spotifyRequest('POST', '/me/player/next');
    return true;
  } catch (err) {
    console.error('Failed to skip:', err.message);
    return false;
  }
}

/**
 * Skip to previous track
 */
export async function previous() {
  try {
    await spotifyRequest('POST', '/me/player/previous');
    return true;
  } catch (err) {
    console.error('Failed to go back:', err.message);
    return false;
  }
}

/**
 * Set volume (0-100)
 */
export async function setVolume(volumePercent) {
  try {
    await spotifyRequest('PUT', `/me/player/volume?volume_percent=${volumePercent}`);
    return true;
  } catch (err) {
    console.error('Failed to set volume:', err.message);
    return false;
  }
}

/**
 * Seek to position (milliseconds)
 */
export async function seek(positionMs) {
  try {
    await spotifyRequest('PUT', `/me/player/seek?position_ms=${positionMs}`);
    return true;
  } catch (err) {
    console.error('Failed to seek:', err.message);
    return false;
  }
}