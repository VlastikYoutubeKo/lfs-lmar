// Metadata providery pro stanice s vadnymi metadaty

const METADATA_PROVIDERS = {
  // Abradia.cz API
  abradia: async (slug) => {
    try {
      const url = `https://radia.cz/api/v1/radio/${slug}/songs/now.json`;
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data && data.interpret && data.song) {
        return `${data.interpret} - ${data.song}`;
      }
      return null;
    } catch (e) {
      console.error('[Metadata] Abradia chyba:', e.message);
      return null;
    }
  },
  
  // Pridat dalsi providery zde
  // radiobrowser: async (stationuuid) => { ... }
};

export async function getCustomMetadata(provider, slug) {
  if (!METADATA_PROVIDERS[provider]) {
    console.error('[Metadata] Neznamy provider:', provider);
    return null;
  }
  
  return await METADATA_PROVIDERS[provider](slug);
}

export function hasCustomProvider(provider) {
  return !!METADATA_PROVIDERS[provider];
}