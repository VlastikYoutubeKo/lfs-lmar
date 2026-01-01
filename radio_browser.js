// radio_browser.js
// FIXED: Dynamic server discovery with DNS lookup and fallback

import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const reverse = promisify(dns.reverse);

// Cache for discovered servers
let cachedServers = [];
let lastDiscoveryTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback servers if DNS fails
const FALLBACK_SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info"
];

/**
 * Discover all available Radio Browser API servers via DNS
 */
async function discoverServers() {
  const now = Date.now();

  // Return cached servers if still valid
  if (cachedServers.length > 0 && (now - lastDiscoveryTime) < CACHE_TTL) {
    return cachedServers;
  }

  try {
    // Get all IPs from DNS
    const ips = await resolve4('all.api.radio-browser.info');
    const hosts = new Set();

    // Reverse lookup each IP to get hostname
    for (const ip of ips) {
      try {
        const hostnames = await reverse(ip);
        if (hostnames && hostnames.length > 0) {
          hosts.add(hostnames[0]);
        }
      } catch (e) {
        // Reverse lookup failed for this IP, skip it
      }
    }

    if (hosts.size > 0) {
      // Sort and convert to URLs
      cachedServers = Array.from(hosts).sort().map(h => `https://${h}`);
      lastDiscoveryTime = now;
      console.log(`🔍 Radio Browser: Discovered ${cachedServers.length} servers`);
      return cachedServers;
    }
  } catch (e) {
    console.warn('⚠️ DNS discovery failed:', e.message);
  }

  // Fall back to hardcoded servers
  console.log('📡 Radio Browser: Using fallback servers');
  return FALLBACK_SERVERS;
}

/**
 * Shuffle array randomly (Fisher-Yates)
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function initRadioBrowser() {
  const servers = await discoverServers();
  console.log(`✅ Radio Browser: ${servers.length} servers available`);
}

async function apiCall(endpoint, params = {}) {
  const servers = await discoverServers();
  const shuffledServers = shuffle(servers);

  // Build query parameters
  const query = {
    limit: 30,
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    ...params
  };

  // Try each server until one works
  for (let i = 0; i < shuffledServers.length; i++) {
    const server = shuffledServers[i];
    const url = new URL(`${server}/json/${endpoint}`);
    url.search = new URLSearchParams(query).toString();

    console.log(`📡 API Request: ${url.toString()} (server ${i + 1}/${shuffledServers.length})`);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LFS-LiveMap/3.0' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      const data = await res.json();

      // Validate response is an array
      if (!Array.isArray(data)) {
        console.error('API Error: Response is not an array:', data);
        continue; // Try next server
      }

      return data.map(s => ({
        id: s.stationuuid,
        name: s.name.trim(),
        url: s.url_resolved || s.url,
        country: s.countrycode || '??',
        bitrate: s.bitrate || 0,
        codec: s.codec || 'MP3'
      }));

    } catch (e) {
      console.warn(`⚠️ Server ${server} failed: ${e.message}`);
      // Continue to next server
    }
  }

  console.error('❌ All Radio Browser servers failed');
  return [];
}

// Všechno směrujeme na 'stations/search', to je nejbezpečnější
export async function searchStationsByName(name, limit = 30) {
  return await apiCall('stations/search', { name: name, limit });
}

export async function searchStationsByCountry(country, limit = 30) {
  return await apiCall('stations/search', { country: country, limit });
}

export async function searchStationsByTag(tag, limit = 30) {
  return await apiCall('stations/search', { tag: tag, limit });
}

export async function getTopStations(limit = 30) {
  const servers = await discoverServers();
  const shuffledServers = shuffle(servers);

  for (let i = 0; i < shuffledServers.length; i++) {
    const server = shuffledServers[i];
    const url = `${server}/json/stations/topclick?limit=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LFS-LiveMap/3.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data)) continue;

      return data.map(s => ({
        id: s.stationuuid,
        name: s.name.trim(),
        url: s.url_resolved || s.url,
        country: s.countrycode || '??',
        bitrate: s.bitrate || 0
      }));
    } catch (e) {
      console.warn(`⚠️ Top stations failed on ${server}: ${e.message}`);
    }
  }
  return [];
}

export async function voteForStation(uuid) {
  const servers = await discoverServers();
  const server = servers[Math.floor(Math.random() * servers.length)];
  fetch(`${server}/json/vote/${uuid}`, {
    headers: { 'User-Agent': 'LFS-LiveMap/3.0' }
  }).catch(() => {});
}