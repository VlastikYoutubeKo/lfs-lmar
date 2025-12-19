// gps_logger.js - Automatický mapovač TC lokací
// Usage: node server.js --map-logger

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// === CONFIGURATION ===
const LOGGER_FILE = './discovered_locations.json';
const OUTPUT_JS = './tc_locations_generated.js';
const MIN_DISTANCE = 50; // Minimální vzdálenost pro novou lokaci (metry)
const SAVE_INTERVAL = 10000; // Auto-save každých 10 sekund

// === STATE ===
const discoveredLocations = new Map();
let lastSaveTime = Date.now();
let totalDiscovered = 0;
let sessionStartTime = Date.now();

// === EMOJI AUTO-DETECTION ===
const LOCATION_EMOJI_MAP = {
  // Services
  'services': '⛽',
  'gas': '⛽',
  'fuel': '⛽',
  
  // Transport
  'station': '🚉',
  'train': '🚉',
  'bus': '🚌',
  'tunnel': '🚇',
  'bridge': '🌉',
  
  // Commercial
  'dealer': '🏢',
  'bmw': '🏢',
  'shop': '🏪',
  'market': '🏪',
  'store': '🏪',
  'emporium': '🏪',
  
  // Food
  'curry': '🌭',
  'restaurant': '🍴',
  'cafe': '☕',
  'food': '🍔',
  
  // Industrial
  'depot': '🏭',
  'factory': '🏭',
  'warehouse': '🏭',
  'industrial': '🏭',
  
  // Roads
  'road': '🛣️',
  'street': '🛣️',
  'lane': '🛣️',
  'way': '🛣️',
  'avenue': '🛣️',
  'grove': '🛣️',
  
  // Junctions
  'junction': '🚦',
  'roundabout': '🔄',
  'circus': '🎪',
  
  // Police
  'police': '👮',
  'cop': '👮',
  
  // Stadium
  'stadium': '🏟️',
  'banger': '🏟️',
  
  // Parking
  'parking': '🅿️',
  'park': '🌳',
  
  // Spawn
  'spawn': '📍'
};

function detectEmoji(locationName) {
  const lower = locationName.toLowerCase();
  
  for (const [keyword, emoji] of Object.entries(LOCATION_EMOJI_MAP)) {
    if (lower.includes(keyword)) {
      return emoji;
    }
  }
  
  return '📍'; // Default
}

// === DISTANCE CALCULATION ===
function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// === LOAD EXISTING DATA ===
export function loadExistingLocations() {
  if (fs.existsSync(LOGGER_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOGGER_FILE, 'utf8'));
      
      data.forEach(loc => {
        discoveredLocations.set(loc.name, {
          x: loc.x,
          y: loc.y,
          icon: loc.icon,
          firstSeen: loc.firstSeen || Date.now(),
          lastSeen: loc.lastSeen || Date.now(),
          visits: loc.visits || 1
        });
      });
      
      totalDiscovered = discoveredLocations.size;
      console.log(`[GPS Logger] Načteno ${totalDiscovered} existujících lokací`);
    } catch (e) {
      console.warn(`[GPS Logger] Chyba při načítání: ${e.message}`);
    }
  }
}

// === LOG NEW LOCATION ===
export function logLocation(name, x, y, playerUCID = null) {
  // Ignorovat speciální lokace
  if (!name || name.includes('OFFROAD') || name.includes('Spawn Zone')) {
    return false;
  }
  
  // Očistit název (remove color codes)
  const cleanName = name.replace(/\^[0-9a-zA-Z]/g, '').trim();
  if (!cleanName) return false;
  
  const existing = discoveredLocations.get(cleanName);
  
  if (existing) {
    // Update existing location
    const distance = calculateDistance(existing.x, existing.y, x, y);
    
    // Pokud je moc daleko, je to možná jiná lokace se stejným názvem
    if (distance > MIN_DISTANCE) {
      console.log(`[GPS Logger] ⚠️  ${cleanName} má velkou vzdálenost (${Math.round(distance)}m) - možná duplicita?`);
    }
    
    // Update stats
    existing.visits++;
    existing.lastSeen = Date.now();
    
    return false; // Už známe
  } else {
    // New location!
    const icon = detectEmoji(cleanName);
    
    discoveredLocations.set(cleanName, {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      icon,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      visits: 1,
      discoveredBy: playerUCID
    });
    
    totalDiscovered++;
    
    console.log(`[GPS Logger] ✨ NOVÁ LOKACE: ${icon} ${cleanName} (${x.toFixed(2)}, ${y.toFixed(2)}) [Total: ${totalDiscovered}]`);
    
    return true;
  }
}

// === PROCESS TC API DATA ===
export function processApiData(apiData, myUCID) {
  if (!apiData || !apiData.ps) return;
  
  // Najít všechny hráče a zalogovat jejich pozice
  Object.values(apiData.ps).forEach(player => {
    if (!player.l || !player.x || !player.y) return;
    
    logLocation(player.l, player.x, player.y, player.u);
  });
  
  // Auto-save každých X sekund
  if (Date.now() - lastSaveTime > SAVE_INTERVAL) {
    saveLocations();
    lastSaveTime = Date.now();
  }
}

// === SAVE TO JSON ===
export function saveLocations() {
  const data = Array.from(discoveredLocations.entries()).map(([name, loc]) => ({
    name,
    x: loc.x,
    y: loc.y,
    icon: loc.icon,
    firstSeen: loc.firstSeen,
    lastSeen: loc.lastSeen,
    visits: loc.visits,
    discoveredBy: loc.discoveredBy
  }));
  
  // Sort by visits (most visited first)
  data.sort((a, b) => b.visits - a.visits);
  
  fs.writeFileSync(LOGGER_FILE, JSON.stringify(data, null, 2), 'utf8');
  
  console.log(`[GPS Logger] 💾 Uloženo ${data.length} lokací do ${LOGGER_FILE}`);
}

// === GENERATE TC_LOCATIONS.JS ===
export function generateTcLocationsFile() {
  const data = Array.from(discoveredLocations.entries())
    .map(([name, loc]) => ({ name, ...loc }))
    .sort((a, b) => b.visits - a.visits); // Seřadit podle návštěv
  
  let jsContent = `// tc_locations_generated.js
// AUTO-GENERATED by GPS Logger
// Generated: ${new Date().toISOString()}
// Total Locations: ${data.length}
// Session Duration: ${Math.round((Date.now() - sessionStartTime) / 1000 / 60)} minutes

export const TC_LOCATIONS = {\n`;

  data.forEach(loc => {
    jsContent += `  '${loc.name}': { x: ${loc.x}, y: ${loc.y}, icon: '${loc.icon}' }, // Visits: ${loc.visits}\n`;
  });

  jsContent += `};\n\n`;
  
  // Add helper functions
  jsContent += `// === HELPER FUNCTIONS ===

export function parseMissionDestination(missionText) {
  if (!missionText) return null;
  
  const text = missionText.toLowerCase();
  
  // Delivery missions
  let match = text.match(/deliver.*?to\\s+(.+?)(?:\\s*$|\\s*\\(|\\.)/i);
  if (match) return capitalizeLocation(match[1].trim());
  
  // Barrier/Road missions
  match = text.match(/(?:fix|repair).*?(?:on|at)\\s+(.+?)(?:\\s*$|\\s*\\(|\\.)/i);
  if (match) return capitalizeLocation(match[1].trim());
  
  // Bus missions
  match = text.match(/-> (.+?)(?:\\s*$|\\s*\\()/i);
  if (match) return capitalizeLocation(match[1].trim());
  
  // Taxi missions
  match = text.match(/(?:pickup|drop.*?off).*?(?:at|to)\\s+(.+?)(?:\\s*$|\\s*\\(|\\.)/i);
  if (match) return capitalizeLocation(match[1].trim());
  
  // Generic search
  for (const location in TC_LOCATIONS) {
    if (text.includes(location.toLowerCase())) {
      return location;
    }
  }
  
  return null;
}

function capitalizeLocation(location) {
  return location.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getDestinationCoords(destination) {
  if (!destination) return null;
  
  if (TC_LOCATIONS[destination]) {
    return TC_LOCATIONS[destination];
  }
  
  const lowerDest = destination.toLowerCase();
  for (const [key, value] of Object.entries(TC_LOCATIONS)) {
    if (key.toLowerCase() === lowerDest) {
      return value;
    }
  }
  
  for (const [key, value] of Object.entries(TC_LOCATIONS)) {
    if (key.toLowerCase().includes(lowerDest) || lowerDest.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
}

export function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateETA(distance, speed) {
  if (speed <= 0) return 0;
  return Math.round(distance / speed);
}

export function formatTime(seconds) {
  if (seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return \`\${mins}:\${String(secs).padStart(2, '0')}\`;
}
`;

  fs.writeFileSync(OUTPUT_JS, jsContent, 'utf8');
  
  console.log(`[GPS Logger] 📝 Vygenerováno ${OUTPUT_JS} s ${data.length} lokacemi`);
  console.log(`[GPS Logger] 📊 Top 10 nejnavštěvovanějších:`);
  
  data.slice(0, 10).forEach((loc, i) => {
    console.log(`   ${i + 1}. ${loc.icon} ${loc.name} (${loc.visits} visits)`);
  });
}

// === GRACEFUL SHUTDOWN ===
export function setupGracefulShutdown() {
  const shutdown = () => {
    console.log('\n[GPS Logger] 🛑 Ukončuji...');
    saveLocations();
    generateTcLocationsFile();
    
    const duration = Math.round((Date.now() - sessionStartTime) / 1000 / 60);
    console.log(`[GPS Logger] ✅ Session dokončena!`);
    console.log(`   • Duration: ${duration} minut`);
    console.log(`   • Discovered: ${totalDiscovered} lokací`);
    console.log(`   • Output: ${LOGGER_FILE}, ${OUTPUT_JS}`);
    
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// === PRINT STATS ===
export function printStats() {
  const duration = Math.round((Date.now() - sessionStartTime) / 1000);
  console.log(`\n[GPS Logger] 📊 Stats:`);
  console.log(`   • Runtime: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`);
  console.log(`   • Locations: ${totalDiscovered}`);
  console.log(`   • Auto-save: každých ${SAVE_INTERVAL / 1000}s`);
  console.log(`   • Last save: ${Math.round((Date.now() - lastSaveTime) / 1000)}s ago\n`);
}