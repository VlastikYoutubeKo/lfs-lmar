// metadata.js - Configurable metadata providers for radio stations
// Add your own station metadata APIs here!

/**
 * METADATA PROVIDERS CONFIGURATION
 *
 * Each provider needs:
 * - name: Display name for logging
 * - match: Function that checks if a stream URL matches this provider
 *          Can also receive stationConfig object with extra info (like slug)
 * - fetch: Async function that returns metadata object
 *          Receives (url, stationConfig) for context-dependent APIs
 *
 * Return object should have: { artist, song, fullTitle, cover?, duration?, nextRefresh? }
 *
 * Add your own providers to the PROVIDERS array below!
 */

const PROVIDERS = [
  // ============================================
  // ABRADIA.CZ - Czech radio stations database
  // ============================================
  {
    name: 'Abradia',
    // Match stations with abradia provider or slug
    match: (url, stationConfig) => {
      return stationConfig?.provider === 'abradia' || !!stationConfig?.slug;
    },
    // Fetch metadata using the station slug
    fetch: async (url, stationConfig) => {
      if (!stationConfig?.slug) return null;

      const apiUrl = `https://radia.cz/api/v1/radio/${stationConfig.slug}/songs/now.json`;
      const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'LFS-LiveMap/3.0' }
      });
      if (!response.ok) return null;

      const data = await response.json();
      if (!data || !data.interpret || !data.song) return null;

      return {
        artist: data.interpret,
        song: data.song,
        fullTitle: `${data.interpret} - ${data.song}`,
        cover: data.image,
        beginAt: data.beginAt,
        endAt: data.endAt,
        nextRefresh: 10000 // Abradia updates every 10 seconds
      };
    }
  },

  // ============================================
  // FREKVENCE 1 - Czech radio station
  // ============================================
  {
    name: 'Frekvence 1',
    // Match any Frekvence 1 stream URLs
    match: (url) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return lower.includes('ice.actve.net/fm-frekvence1') ||
             lower.includes('frekvence1');
    },
    // Fetch metadata from actve.net API
    fetch: async () => {
      const response = await fetch('https://rds.actve.net/v1/metadata/channel/frekvence1', {
        headers: { 'User-Agent': 'LFS-LiveMap/3.0' }
      });
      if (!response.ok) return null;

      const data = await response.json();
      if (data.status !== 'ok') return null;

      return {
        artist: data.artist || 'Unknown',
        song: data.title || 'Unknown',
        fullTitle: `${data.artist || 'Unknown'} - ${data.title || 'Unknown'}`,
        album: data.album,
        cover: data.cover || data.coverBase,
        duration: data.duration,
        startTime: data.starttime ? data.starttime * 1000 : null,
        nextRefresh: data.nextrefresh || 30000,
        // Extra info
        moderator: data.moderatorName,
        showName: data.showName
      };
    }
  },

  // ============================================
  // EXAMPLE: Add your own provider here!
  // ============================================
  // {
  //   name: 'My Radio Station',
  //   match: (url) => url.includes('myradio.com'),
  //   fetch: async () => {
  //     const res = await fetch('https://api.myradio.com/nowplaying');
  //     const data = await res.json();
  //     return {
  //       artist: data.artist,
  //       song: data.title,
  //       fullTitle: `${data.artist} - ${data.title}`,
  //       cover: data.albumArt,
  //       nextRefresh: 30000
  //     };
  //   }
  // },

  // ============================================
  // EUROPA 2 - Czech radio station (example)
  // ============================================
  // {
  //   name: 'Europa 2',
  //   match: (url) => url.toLowerCase().includes('europa2'),
  //   fetch: async () => {
  //     const response = await fetch('https://rds.actve.net/v1/metadata/channel/evropa2');
  //     if (!response.ok) return null;
  //     const data = await response.json();
  //     if (data.status !== 'ok') return null;
  //     return {
  //       artist: data.artist || 'Unknown',
  //       song: data.title || 'Unknown',
  //       fullTitle: `${data.artist} - ${data.title}`,
  //       cover: data.cover,
  //       nextRefresh: data.nextrefresh || 30000
  //     };
  //   }
  // }
];

// ============================================
// API FUNCTIONS - Don't modify below this line
// ============================================

let currentMetadataTimer = null;
let currentProvider = null;
let currentStreamUrl = null;
let currentStationConfig = null;
let debugEnabled = false;

function debugLog(...args) {
  if (debugEnabled) console.log('[Metadata]', ...args);
}

/**
 * Enable or disable debug logging
 * Use --meta-debug flag when starting the server
 */
export function setMetadataDebug(enabled) {
  debugEnabled = enabled;
  if (enabled) console.log('[Metadata] Debug mode enabled');
}

/**
 * Find a metadata provider for the given stream URL and station config
 * @param {string} streamUrl - The stream URL
 * @param {object} stationConfig - Optional station configuration (may contain slug, provider, etc.)
 */
export function findMetadataProvider(streamUrl, stationConfig = null) {
  for (const provider of PROVIDERS) {
    try {
      if (provider.match(streamUrl, stationConfig)) {
        return provider;
      }
    } catch (e) {
      console.warn(`[Metadata] Error in provider ${provider.name} match:`, e.message);
    }
  }
  return null;
}

/**
 * Check if a stream URL has a custom metadata provider
 * @param {string} streamUrl - The stream URL
 * @param {object} stationConfig - Optional station configuration
 */
export function hasMetadataProvider(streamUrl, stationConfig = null) {
  return findMetadataProvider(streamUrl, stationConfig) !== null;
}

/**
 * Fetch metadata for a stream URL
 * @param {string} streamUrl - The stream URL
 * @param {object} stationConfig - Optional station configuration
 * Returns: { artist, song, fullTitle, cover?, duration?, nextRefresh? } or null
 */
export async function fetchMetadata(streamUrl, stationConfig = null) {
  const provider = findMetadataProvider(streamUrl, stationConfig);
  if (!provider) return null;

  try {
    const metadata = await provider.fetch(streamUrl, stationConfig);
    if (metadata) {
      console.log(`[Metadata] ${provider.name}: ${metadata.fullTitle}`);
    }
    return metadata;
  } catch (e) {
    console.error(`[Metadata] ${provider.name} fetch error:`, e.message);
    return null;
  }
}

/**
 * Calculate time until next metadata refresh
 * Uses duration and startTime if available, otherwise uses nextRefresh
 */
export function getNextRefreshTime(metadata) {
  if (!metadata) return 30000;

  // If we have duration and startTime, calculate remaining time
  if (metadata.duration && metadata.startTime) {
    const elapsed = Date.now() - metadata.startTime;
    const remaining = (metadata.duration * 1000) - elapsed;

    // If song should have ended, refresh soon
    if (remaining <= 0) {
      return 2000;
    }
    // Add small buffer after song end
    return remaining + 1000;
  }

  // Fallback to nextRefresh or default
  return metadata.nextRefresh || 30000;
}

/**
 * Start automatic metadata fetching for a stream
 * @param {string} streamUrl - The stream URL
 * @param {function} onMetadata - Callback when new metadata is received: (metadata) => void
 * @param {object} stationConfig - Optional station configuration (may contain slug, provider, etc.)
 * @returns {boolean} - True if metadata provider was found and started
 */
export function startMetadataFetch(streamUrl, onMetadata, stationConfig = null) {
  stopMetadataFetch();

  debugLog(`Checking URL: ${streamUrl}`);
  debugLog(`Station config:`, stationConfig ? JSON.stringify(stationConfig).substring(0, 100) : 'null');

  const provider = findMetadataProvider(streamUrl, stationConfig);
  if (!provider) {
    debugLog(`No provider found for this stream`);
    return false;
  }

  currentProvider = provider;
  currentStreamUrl = streamUrl;
  currentStationConfig = stationConfig;
  console.log(`[Metadata] Starting ${provider.name} updates`);

  const doFetch = async () => {
    try {
      debugLog(`Fetching from ${currentProvider.name}...`);
      const metadata = await provider.fetch(currentStreamUrl, currentStationConfig);
      if (metadata) {
        debugLog(`Got: ${metadata.fullTitle}`);
        onMetadata(metadata);
        const nextRefresh = getNextRefreshTime(metadata);
        debugLog(`Next refresh in ${Math.round(nextRefresh/1000)}s`);
        currentMetadataTimer = setTimeout(doFetch, nextRefresh);
      } else {
        debugLog(`Fetch returned null, retrying in 30s`);
        currentMetadataTimer = setTimeout(doFetch, 30000);
      }
    } catch (e) {
      console.error(`[Metadata] ${provider.name} error:`, e.message);
      currentMetadataTimer = setTimeout(doFetch, 30000);
    }
  };

  doFetch();
  return true;
}

/**
 * Stop automatic metadata fetching
 */
export function stopMetadataFetch() {
  if (currentMetadataTimer) {
    clearTimeout(currentMetadataTimer);
    currentMetadataTimer = null;
  }
  if (currentProvider) {
    console.log(`[Metadata] Stopped ${currentProvider.name} metadata updates`);
    currentProvider = null;
  }
  currentStreamUrl = null;
  currentStationConfig = null;
}

/**
 * Get list of all configured providers (for debugging/UI)
 */
export function getProviderList() {
  return PROVIDERS.map(p => p.name);
}
