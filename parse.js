// tc_api_parser.js - TC API PARSER
// Fetches TC data for ALL track combinations and generates tc_locations.js
import fs from 'fs';

const TC_API_BASE = 'https://world.city-driving.co.uk/api/v2/json';

// All LFS track short codes
const TRACK_CODES = ['AS', 'AU', 'BL', 'FE', 'KY', 'LA', 'RO', 'SO', 'WE'];

// Track numbers to check (1-9) with X suffix for TC servers
const TRACK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Generate all possible track combinations with X suffix
function getAllTrackCombinations() {
    const combinations = [];
    for (const code of TRACK_CODES) {
        for (const num of TRACK_NUMBERS) {
            combinations.push(`${code}${num}X`);
        }
    }
    return combinations;
}

// Fetch track data from TC API
async function fetchTrackData(trackCode) {
    const url = `${TC_API_BASE}/track_${trackCode.toLowerCase()}.json`;

    try {
        const response = await fetch(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'LFS-Map-Radio/1.0'
            }
        });

        if (!response.ok) {
            return null;
        }

        const textData = await response.text();

        // Replace Infinity values with valid JSON numbers
        const cleanedData = textData
            .replace(/:\s*Infinity/g, ': 999999')
            .replace(/:\s*-Infinity/g, ': -999999');

        const data = JSON.parse(cleanedData);

        // Verify the track key matches (or use the one from response)
        const actualTrack = data.tk || trackCode;

        return { trackCode: actualTrack, data };
    } catch (error) {
        return null;
    }
}

// Parse track data into locations
function parseTrackData(trackCode, data) {
    const locations = [];
    const nameCounters = {};

    // Helper to get unique name
    function getUniqueName(baseName) {
        if (nameCounters[baseName]) {
            nameCounters[baseName]++;
            return `${baseName} ${nameCounters[baseName]}`;
        } else {
            nameCounters[baseName] = 1;
            return baseName;
        }
    }

    // === ROADS ===
    if (data.rds) {
        for (const road of data.rds) {
            if (!road.pts || road.pts.length < 2) {
                continue;
            }

            const center = calculateCenter(road.pts);
            const finalName = getUniqueName(road.n);

            locations.push({
                name: finalName,
                x: center.x,
                y: center.y,
                icon: "🛣️",
                type: "road",
                track: trackCode,
                points: road.pts
            });
        }
    }

    // === ZONES ===
    if (data.zones) {
        for (const zone of data.zones) {
            const center = zone.pts ? calculateCenter(zone.pts) : { x: zone.ct?.x || 0, y: zone.ct?.y || 0 };
            const finalName = getUniqueName(zone.n);

            locations.push({
                name: finalName,
                x: center.x,
                y: center.y,
                icon: "🏘️",
                type: "zone",
                track: trackCode,
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
                    if (stop.n) { // Only named stops
                        const stopKey = `${stop.n}|${stop.x}|${stop.y}`;
                        if (!busStops.has(stopKey)) {
                            busStops.set(stopKey, stop);
                        }
                    }
                }
            }
        }
    }

    for (const stop of busStops.values()) {
        const finalName = getUniqueName(stop.n);

        locations.push({
            name: finalName,
            x: stop.x,
            y: stop.y,
            icon: "🚏",
            type: "bus_stop",
            track: trackCode
        });
    }

    // === BUILDINGS ===
    if (data.buildings) {
        for (const building of data.buildings) {
            const x = building.ct?.x || 0;
            const y = building.ct?.y || 0;
            const finalName = getUniqueName(building.n);

            locations.push({
                name: finalName,
                x: x,
                y: y,
                icon: detectIcon(building.n, building.t),
                type: "building",
                track: trackCode
            });
        }
    }

    return locations;
}

// Detect appropriate icon based on building name or type
function detectIcon(name, buildingType) {
    const lowerName = name.toLowerCase();

    // Building types from TC API
    if (buildingType !== undefined) {
        switch (buildingType) {
            case 1: return "⛽"; // Gas Station
            case 2: return "🚌"; // Bus Station
            case 4: return "🏢"; // Generic building / Center
            case 5: return "🏎️"; // Karting
            case 6: return "🏭"; // Depot/Industrial
            case 9: return "📍"; // Point of interest
        }
    }

    // Name-based detection
    if (lowerName.includes('gas') || lowerName.includes('fuel') || lowerName.includes('petrol')) return "⛽";
    if (lowerName.includes('police') || lowerName.includes('cop')) return "🚔";
    if (lowerName.includes('hospital') || lowerName.includes('medical')) return "🏥";
    if (lowerName.includes('fire')) return "🚒";
    if (lowerName.includes('motel') || lowerName.includes('hotel')) return "🏨";
    if (lowerName.includes('food') || lowerName.includes('restaurant') || lowerName.includes('steak')) return "🍔";
    if (lowerName.includes('parking')) return "🅿️";
    if (lowerName.includes('warehouse')) return "📦";
    if (lowerName.includes('bus') || lowerName.includes('station')) return "🚌";
    if (lowerName.includes('tower')) return "🏗️";
    if (lowerName.includes('office')) return "🏢";
    if (lowerName.includes('shop') || lowerName.includes('store')) return "🛒";
    if (lowerName.includes('expo') || lowerName.includes('convention')) return "🎪";
    if (lowerName.includes('heli') || lowerName.includes('port')) return "🚁";
    if (lowerName.includes('kart')) return "🏎️";
    if (lowerName.includes('pits') || lowerName.includes('pit')) return "🔧";
    if (lowerName.includes('pool')) return "🏊";
    if (lowerName.includes('ranger')) return "🌲";

    return "🏢";
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

function generateJSFile(locations, trackStats, outputPath) {
    const locationsObj = convertToObjectFormat(locations);

    const trackList = Object.entries(trackStats)
        .filter(([_, count]) => count > 0)
        .map(([track, count]) => `//   ${track}: ${count} locations`)
        .join('\n');

    const content = `// tc_locations.js
// AUTO-GENERATED from TC API Track Data
// Generated: ${new Date().toISOString()}
// Total Locations: ${locations.length}
//
// Track Breakdown:
${trackList}

export const TC_LOCATIONS = ${JSON.stringify(locationsObj, null, 2)};

export function parseMissionDestination(text) {
  if (!text) return null;
  text = text.toLowerCase();

  // Look for "» destination"
  let match = text.match(/»\\s*(.+?)(?:\\s*$)/i);
  if (match) return capitalizeLocation(match[1].trim());

  // Look for "to/at/on destination"
  match = text.match(/(?:to|at|on)\\s+(.+?)(?:\\s*$|\\s*\\(|\\.|\\s*•)/i);
  if (match) {
    let candidate = match[1].trim();
    candidate = candidate.replace(/\\s*\\d+kg.*$/, "").trim();
    return capitalizeLocation(candidate);
  }

  // Look for direct matches
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

  // Direct match
  if (TC_LOCATIONS[destination]) return TC_LOCATIONS[destination];

  const lowerDest = destination.toLowerCase().trim();

  // Ignore generic words
  const STOP_WORDS = ["way", "road", "street", "lane", "avenue", "drive", "boulevard", "place", "station", "park"];
  if (STOP_WORDS.includes(lowerDest)) return null;

  // Partial match
  for (const [key, value] of Object.entries(TC_LOCATIONS)) {
    if (lowerDest.includes(key.toLowerCase())) return value;
  }

  // Fuzzy match for longer names
  if (lowerDest.length > 3) {
    for (const [key, value] of Object.entries(TC_LOCATIONS)) {
      if (key.toLowerCase().includes(lowerDest)) return value;
    }
  }

  return null;
}

// Get locations for a specific track
export function getLocationsForTrack(trackCode) {
  const result = {};
  const upperTrack = trackCode.toUpperCase();

  for (const [name, data] of Object.entries(TC_LOCATIONS)) {
    if (data.track === upperTrack) {
      result[name] = data;
    }
  }
  return result;
}

// Get all available tracks
export function getAvailableTracks() {
  const tracks = new Set();
  for (const data of Object.values(TC_LOCATIONS)) {
    if (data.track) tracks.add(data.track);
  }
  return Array.from(tracks).sort();
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

async function main() {
    console.log('🔄 TC API Multi-Track Parser');
    console.log('============================\n');

    const allCombinations = getAllTrackCombinations();
    console.log(`📋 Checking ${allCombinations.length} track combinations...\n`);

    const allLocations = [];
    const trackStats = {};
    const successfulTracks = [];
    const failedTracks = [];

    // Process tracks with concurrency limit
    const CONCURRENT_LIMIT = 3;

    for (let i = 0; i < allCombinations.length; i += CONCURRENT_LIMIT) {
        const batch = allCombinations.slice(i, i + CONCURRENT_LIMIT);
        const promises = batch.map(async (trackCode) => {
            const result = await fetchTrackData(trackCode);

            if (result) {
                const locations = parseTrackData(result.trackCode, result.data);
                return { trackCode: result.trackCode, locations, success: true };
            }
            return { trackCode, locations: [], success: false };
        });

        const results = await Promise.all(promises);

        for (const result of results) {
            if (result.success) {
                successfulTracks.push(result.trackCode);
                allLocations.push(...result.locations);
                trackStats[result.trackCode] = result.locations.length;
                console.log(`✅ ${result.trackCode}: ${result.locations.length} locations`);
            } else {
                failedTracks.push(result.trackCode);
                // Silently skip - not all combinations exist
            }
        }
    }

    console.log('\n============================');
    console.log('📊 Summary:');
    console.log(`   ✅ Found: ${successfulTracks.length} tracks`);
    console.log(`   ❌ Not found: ${failedTracks.length} tracks`);
    console.log(`   📍 Total locations: ${allLocations.length}`);

    if (successfulTracks.length > 0) {
        console.log('\n🗺️  Available tracks:');
        for (const track of successfulTracks) {
            console.log(`   • ${track}: ${trackStats[track]} locations`);
        }
    }

    // Break down by type
    const byType = {};
    for (const loc of allLocations) {
        byType[loc.type] = (byType[loc.type] || 0) + 1;
    }

    console.log('\n📋 Location types:');
    for (const [type, count] of Object.entries(byType)) {
        console.log(`   • ${type}: ${count}`);
    }

    // Count total road points
    const roadPoints = allLocations
        .filter(l => l.type === 'road' && l.points)
        .reduce((sum, l) => sum + l.points.length, 0);
    console.log(`\n🗺️  Total road navigation points: ${roadPoints}`);

    // Generate output file
    generateJSFile(allLocations, trackStats, './tc_locations_generated.js');

    console.log('\n🎉 Done! Replace your public/tc_locations.js with tc_locations_generated.js');
    console.log('   Command: copy tc_locations_generated.js public\\tc_locations.js');

    return { successfulTracks, allLocations };
}

// === RUN ===
main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
