// radio_browser.js
// FIXED: Správné API endpointy podle dokumentace

const SERVER = "https://de1.api.radio-browser.info";

export async function initRadioBrowser() {
  console.log(`✅ Radio Browser: Nastaveno na ${SERVER}`);
}

async function apiCall(endpoint, params = {}) {
  // Používáme endpoint 'stations/search', který bere parametry
  const url = new URL(`${SERVER}/json/${endpoint}`);
  
  // Přidáme parametry
  const query = {
    limit: 30,
    hidebroken: 'true',
    order: 'clickcount',
    reverse: 'true',
    ...params
  };
  
  url.search = new URLSearchParams(query).toString();

  console.log(`📡 API Request: ${url.toString()}`); // Debug výpis

  try {
    const res = await fetch(url, { 
        headers: { 'User-Agent': 'LFS-LiveMap/3.0' } 
    });
    
    if (!res.ok) throw new Error(`Status ${res.status}`);
    
    const data = await res.json();
    
    // Validace, že data jsou pole
    if (!Array.isArray(data)) {
        console.error('API Error: Odpověď není pole:', data);
        return [];
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
    console.error('❌ API Fail:', e.message);
    return [];
  }
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
  // Pro top stations použijeme specifický endpoint bez parametrů
  const url = `${SERVER}/json/stations/topclick?limit=${limit}`;
  try {
      const res = await fetch(url);
      const data = await res.json();
      return data.map(s => ({
        id: s.stationuuid,
        name: s.name.trim(),
        url: s.url_resolved || s.url,
        country: s.countrycode || '??',
        bitrate: s.bitrate || 0
      }));
  } catch(e) { return []; }
}

export async function voteForStation(uuid) {
  fetch(`${SERVER}/json/vote/${uuid}`).catch(() => {});
}