// tc_api_parser.js - TC API PARSER
// Stáhni TC data a vygeneruj tc_locations.js
import fs from 'fs';

const TC_API_URL = 'https://world.city-driving.co.uk/api/v2/json/track_so7.json';

async function parseTC_API() {
    console.log('🔄 Downloading TC API data...');
    
    const response = await fetch(TC_API_URL);
    const textData = await response.text();
    
    // Nahradit Infinity hodnotami, které jsou validní JSON
    const cleanedData = textData
        .replace(/:\s*Infinity/g, ': 999999')
        .replace(/:\s*-Infinity/g, ': -999999');
    
    const data = JSON.parse(cleanedData);
    
    console.log('📊 Raw API data:');
    console.log(`  Roads (rds): ${data.rds?.length || 0}`);
    console.log(`  Zones: ${data.zones?.length || 0}`);
    console.log(`  Buildings: ${data.buildings?.length || 0}`);
    console.log(`  Bus Lines: ${data.busLines?.length || 0}`);
    
    const locations = [];
    const nameCounters = {};
    
    // === ROADS ===
    if (data.rds) {
        for (const road of data.rds) {
            if (!road.pts || road.pts.length < 2) {
                console.warn(`⚠️  Skipping road "${road.n}" - no points`);
                continue;
            }
            
            const center = calculateCenter(road.pts);
            let finalName = road.n;
            
            // Přidat číslo k duplicitním názvům
            if (nameCounters[road.n]) {
                nameCounters[road.n]++;
                finalName = `${road.n} ${nameCounters[road.n]}`;
            } else {
                nameCounters[road.n] = 1;
            }
            
            locations.push({
                name: finalName,
                x: center.x,
                y: center.y,
                icon: "🛣️",
                type: "road",
                track: "SO7",
                points: road.pts
            });
        }
    }
    
    // === ZONES ===
    if (data.zones) {
        for (const zone of data.zones) {
            const center = zone.pts ? calculateCenter(zone.pts) : { x: zone.ct?.x || 0, y: zone.ct?.y || 0 };
            
            let finalName = zone.n;
            if (nameCounters[zone.n]) {
                nameCounters[zone.n]++;
                finalName = `${zone.n} ${nameCounters[zone.n]}`;
            } else {
                nameCounters[zone.n] = 1;
            }
            
            locations.push({
                name: finalName,
                x: center.x,
                y: center.y,
                icon: "🏘️",
                type: "zone",
                track: "SO7",
                points: zone.pts || null
            });
        }
    }
    
    // === BUS STOPS ===
    const busStops = new Map();
    if (data.busLines) {
        for (const line of data.busLines) {
            if (line.stp) {
                for (const stop of line.stp) {
                    const stopKey = `${stop.n}|${stop.x}|${stop.y}`;
                    if (!busStops.has(stopKey)) {
                        busStops.set(stopKey, stop);
                    }
                }
            }
        }
    }
    
    for (const stop of busStops.values()) {
        let finalName = stop.n;
        if (nameCounters[stop.n]) {
            nameCounters[stop.n]++;
            finalName = `${stop.n} ${nameCounters[stop.n]}`;
        } else {
            nameCounters[stop.n] = 1;
        }
        
        locations.push({
            name: finalName,
            x: stop.x,
            y: stop.y,
            icon: "🚏",
            type: "bus_stop",
            track: "SO7"
        });
    }
    
    // === BUILDINGS ===
    if (data.buildings) {
        for (const building of data.buildings) {
            const x = building.ct?.x || 0;
            const y = building.ct?.y || 0;
            
            let finalName = building.n;
            if (nameCounters[building.n]) {
                nameCounters[building.n]++;
                finalName = `${building.n} ${nameCounters[building.n]}`;
            } else {
                nameCounters[building.n] = 1;
            }
            
            locations.push({
                name: finalName,
                x: x,
                y: y,
                icon: "🏢",
                type: "building",
                track: "SO7"
            });
        }
    }
    
    console.log('\n✅ Parsing complete!');
    console.log(`📊 Total locations: ${locations.length}`);
    console.log(`   Roads: ${locations.filter(l => l.type === 'road').length}`);
    console.log(`   Zones: ${locations.filter(l => l.type === 'zone').length}`);
    console.log(`   Stops: ${locations.filter(l => l.type === 'bus_stop').length}`);
    console.log(`   Buildings: ${locations.filter(l => l.type === 'building').length}`);
    
    const roadPoints = locations
        .filter(l => l.type === 'road' && l.points)
        .reduce((sum, l) => sum + l.points.length, 0);
    console.log(`\n🗺️  Total road navigation points: ${roadPoints}`);
    
    return locations;
}

function calculateCenter(points) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    const sum = points.reduce((acc, pt) => ({ 
        x: acc.x + pt.x, 
        y: acc.y + pt.y 
    }), { x: 0, y: 0 });
    return { 
        x: sum.x / points.length, 
        y: sum.y / points.length 
    };
}

function convertToObjectFormat(locationsArray) {
    const result = {};
    for (const loc of locationsArray) {
        const { name, ...data } = loc;
        result[name] = data;
    }
    return result;
}

function generateJSFile(locations, outputPath) {
    const locationsObj = convertToObjectFormat(locations);
    
    const content = `// tc_locations.js
// AUTO-GENERATED from TC API Track Data
// Generated: ${new Date().toISOString()}
// Total Locations: ${locations.length}

export const TC_LOCATIONS = ${JSON.stringify(locationsObj, null, 2)};

export function parseMissionDestination(text) {
  if (!text) return null;
  text = text.toLowerCase();

  // Hledat "» destination"
  let match = text.match(/»\\s*(.+?)(?:\\s*$)/i);
  if (match) return capitalizeLocation(match[1].trim());

  // Hledat "to/at/on destination"
  match = text.match(/(?:to|at|on)\\s+(.+?)(?:\\s*$|\\s*\\(|\\.|\\s*•)/i);
  if (match) {
    let candidate = match[1].trim();
    candidate = candidate.replace(/\\s*\\d+kg.*$/, "").trim();
    return capitalizeLocation(candidate);
  }
  
  // Hledat přímé shody
  for (const location in TC_LOCATIONS) {
    if (text.includes(location.toLowerCase())) return location;
  }
  return null;
}

function capitalizeLocation(location) {
  return location.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function getDestinationCoords(destination) {
  if (!destination) return null;
  
  // Přímá shoda
  if (TC_LOCATIONS[destination]) return TC_LOCATIONS[destination];
  
  const lowerDest = destination.toLowerCase().trim();
  
  // Ignorovat generické slova
  const STOP_WORDS = ["way", "road", "street", "lane", "avenue", "drive", "boulevard", "place", "station", "park"];
  if (STOP_WORDS.includes(lowerDest)) return null;
  
  // Částečná shoda
  for (const [key, value] of Object.entries(TC_LOCATIONS)) {
    if (lowerDest.includes(key.toLowerCase())) return value;
  }
  
  // Fuzzy match pro delší názvy
  if (lowerDest.length > 3) {
    for (const [key, value] of Object.entries(TC_LOCATIONS)) {
      if (key.toLowerCase().includes(lowerDest)) return value;
    }
  }
  
  return null;
}

export function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function calculateETA(distance, speed) {
  if (speed <= 1) return 0;
  return Math.min(Math.round(distance / speed), 999);
}

export function formatTime(seconds) {
  if (seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return \`\${mins}:\${String(secs).padStart(2, "0")}\`;
}
`;

    fs.writeFileSync(outputPath, content);
    console.log(`\n💾 Saved to: ${outputPath}`);
}

// === SPUSTIT ===
(async () => {
    try {
        const locations = await parseTC_API();
        generateJSFile(locations, './tc_locations_generated.js');
        console.log('\n🎉 Done! Replace your tc_locations.js with tc_locations_generated.js');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();