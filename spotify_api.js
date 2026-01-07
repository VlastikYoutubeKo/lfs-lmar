// Spotify Web API Integration
// Handles authentication, playback control, and now playing info

import https from 'https';
import { URLSearchParams } from 'url';

let spotifyConfig = {
  enabled: false,
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://127.0.0.1:3000/spotify/callback',
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null
};

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
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
      hostname: 'accounts.spotify.com',
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
        if (res.statusCode === 200) {
          const tokenData = JSON.parse(data);
          spotifyConfig.accessToken = tokenData.access_token;
          spotifyConfig.refreshToken = tokenData.refresh_token;
          spotifyConfig.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
          resolve(tokenData);
        } else {
          reject(new Error(`Token exchange failed: ${res.statusCode} ${data}`));
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
      hostname: 'accounts.spotify.com',
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
    await refreshAccessToken();
  }

  if (!spotifyConfig.accessToken) {
    throw new Error('Not authenticated with Spotify');
  }

  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SPOTIFY_API_BASE);
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : null);
        } else if (res.statusCode === 204) {
          resolve(null);
        } else {
          reject(new Error(`Spotify API error: ${res.statusCode} ${data}`));
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

    return {
      track: playback.item.name,
      artist: playback.item.artists.map(a => a.name).join(', '),
      album: playback.item.album.name,
      isPlaying: playback.is_playing,
      progress: playback.progress_ms,
      duration: playback.item.duration_ms,
      artwork: playback.item.album.images[0]?.url
    };
  } catch (err) {
    console.error('Failed to get now playing:', err.message);
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
