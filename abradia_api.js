// Abradia.cz API implementace

const ABRADIA_BASE = 'https://radia.cz/api';

// Cache pro rychlejsi pristup
let stationsCache = null;
let stationsCacheTime = 0;
const CACHE_TTL = 300000; // 5 minut

export async function getAbradiaStations() {
  try {
    const now = Date.now();
    // Pokud je cache platnÃ¡, vraÅ¥ ji rovnou
    if (stationsCache && (now - stationsCacheTime) < CACHE_TTL) {
      return stationsCache;
    }
    
    let allStations = [];
    let page = 1;
    let hasMoreData = true;
    const MAX_PAGES = 50; // BezpeÄnostnÃ­ limit, aby se zamezilo nekoneÄnÃ© smyÄce
    
    while (hasMoreData && page <= MAX_PAGES) {
      const url = `${ABRADIA_BASE}/v1/search/radio/byYesterdayListeners.${page}.json`;
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          hasMoreData = false;
          break;
        }
        
        const data = await response.json();
        
        if (data && data.result && data.result.length > 0) {
          // Namapujeme aktuÃ¡lnÃ­ strÃ¡nku
          const pageStations = data.result.map(s => ({
            id: s.id,
            slug: s.slug,
            name: s.name,
            slogan: s.slogan,
            logo: s.logo,
            url: s.url
          }));
          
          // PÅ™idÃ¡me k celkovÃ©mu seznamu
          allStations = [...allStations, ...pageStations];
          
          // Jdeme na dalÅ¡Ã­ strÃ¡nku
          page++;
        } else {
          // Å½Ã¡dnÃ¡ dalÅ¡Ã­ data, konÄÃ­me cyklus
          hasMoreData = false;
        }
      } catch (innerError) {
        console.warn(`[Abradia] Chyba pÅ™i naÄÃ­tÃ¡nÃ­ strÃ¡nky ${page}:`, innerError.message);
        hasMoreData = false;
      }
    }

    // Pokud jsme nÄ›co naÄetli, uloÅ¾Ã­me do cache
    if (allStations.length > 0) {
      stationsCache = allStations;
      stationsCacheTime = now;
      return stationsCache;
    }
    
    // Pokud cache existuje (i starÃ¡), radÄ›ji vraÅ¥ tu, neÅ¾ prÃ¡zdnÃ© pole pÅ™i chybÄ›
    return stationsCache || [];

  } catch (e) {
    console.error('[Abradia] KritickÃ¡ chyba naÄtenÃ­ stanic:', e.message);
    return stationsCache || [];
  }
}

export async function getAbradiaStreams(slug) {
  try {
    const url = `${ABRADIA_BASE}/v2/radio/${slug}/streams.json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const streams = await response.json();
    
    // Preferuj AAC, pak MP3
    const aac = streams.find(s => s.type === 'aac');
    const mp3 = streams.find(s => s.type === 'mp3');
    
    return aac || mp3 || streams[0];
  } catch (e) {
    console.error('[Abradia] Chyba nacteni streamu:', e.message);
    return null;
  }
}

export async function getAbradiaNowPlaying(slug) {
  try {
    const url = `${ABRADIA_BASE}/v1/radio/${slug}/songs/now.json`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data && data.interpret && data.song) {
      return {
        artist: data.interpret,
        song: data.song,
        fullTitle: `${data.interpret} - ${data.song}`,
        image: data.image,
        beginAt: data.beginAt,
        endAt: data.endAt
      };
    }
    return null;
  } catch (e) {
    console.error('[Abradia] Chyba now playing:', e.message);
    return null;
  }
}

// Helper pro pripravu stanice k prehrani
export async function prepareAbradiaStation(slug) {
  try {
    const [stream, nowPlaying] = await Promise.all([
      getAbradiaStreams(slug),
      getAbradiaNowPlaying(slug)
    ]);
    
    if (!stream) return null;
    
    return {
      url: stream.url,
      type: stream.type,
      nowPlaying
    };
  } catch (e) {
    console.error('[Abradia] Chyba pripravy stanice:', e.message);
    return null;
  }
}