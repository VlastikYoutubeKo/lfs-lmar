// Track Configurations
// Aktualizováno pro oficiální čtvercové mapy z lfs.net
// Všechny mapy jsou centrovány na 0,0 a mají rozměr dle názvu souboru.

export const TRACK_CONFIGS = {
  // ASTON (AS) - Velikost 2560m
  'AS': {
    bounds: { 
      minX: -1280.0, maxX: 1280.0, 
      minY: -1280.0, maxY: 1280.0 
    }
  },

  // AUTOCROSS (AU) - Velikost 2560m
  'AU': {
    bounds: { 
      minX: -1280.0, maxX: 1280.0, 
      minY: -1280.0, maxY: 1280.0 
    }
  },

  // BLACKWOOD (BL) - Velikost 2560m
  'BL': {
    bounds: { 
      minX: -1280.0, maxX: 1280.0, 
      minY: -1280.0, maxY: 1280.0 
    }
  },

  // FERN BAY (FE) - Velikost 2048m
  'FE': {
    bounds: { 
      minX: -1024.0, maxX: 1024.0, 
      minY: -1024.0, maxY: 1024.0 
    }
  },

  // KYOTO (KY) - Velikost 3584m
  'KY': {
    bounds: { 
      minX: -1792.0, maxX: 1792.0, 
      minY: -1792.0, maxY: 1792.0 
    }
  },

  // LAYOUT SQUARE (LA) - Velikost 4096m
  'LA': {
    bounds: { 
      minX: -2048.0, maxX: 2048.0, 
      minY: -2048.0, maxY: 2048.0 
    }
  },

  // ROCKINGHAM (RO) - Velikost 1536m
  'RO': {
    bounds: { 
      minX: -768.0, maxX: 768.0, 
      minY: -768.0, maxY: 768.0 
    }
  },

  // SOUTH CITY (SO) - Velikost 3584m
  'SO': {
    bounds: { 
      minX: -1792.0, maxX: 1792.0, 
      minY: -1792.0, maxY: 1792.0 
    }
  },

  // WESTHILL (WE) - Velikost 3072m
  'WE': {
    bounds: { 
      minX: -1536.0, maxX: 1536.0, 
      minY: -1536.0, maxY: 1536.0 
    }
  },
  
  // FALLBACK
  'DEFAULT': { 
    bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 } 
  }
};

export function getTrackConfig(trackCode) {
  const code = trackCode.substring(0, 2).toUpperCase();
  return TRACK_CONFIGS[code] || TRACK_CONFIGS['DEFAULT'];
}

export function worldToCanvas(xMetres, yMetres, config, imgWidth, imgHeight) {
  const b = config.bounds;
  
  // Ochrana proti dělení nulou, pokud by bounds byly špatně
  const width = b.maxX - b.minX || 1;
  const height = b.maxY - b.minY || 1;

  // Normalizace na 0.0 - 1.0
  const pctX = (xMetres - b.minX) / width;
  const pctY = (b.maxY - yMetres) / height; // LFS Y je otočené (sever je nahoře, ale canvas Y roste dolů)
  
  return { 
    x: pctX * imgWidth, 
    y: pctY * imgHeight 
  };
}