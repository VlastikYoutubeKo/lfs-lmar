// Mapování LFS tratí - Track codes na lidsky čitelné názvy
// Použito v server.js pro lepší logging

export const TRACK_NAMES = {
  // Blackwood (BL)
  'BL1': 'Blackwood GP Track',
  'BL1R': 'Blackwood GP Reversed',
  'BL2': 'Blackwood Rallycross',
  'BL3': 'Blackwood Car Park',

  // Blackwood TC Open World (BL#X)
  'BL1X': '[TC] Blackwood Open World',
  'BL2X': '[TC] Blackwood Open World 2',
  'BL3X': '[TC] Blackwood Open World 3',

  // South City (SO)
  'SO1': 'South City Classic',
  'SO1R': 'South City Classic Reversed',
  'SO2': 'South City Sprint Track 1',
  'SO2R': 'South City Sprint Track 1 Reversed',
  'SO3': 'South City Sprint Track 2',
  'SO3R': 'South City Sprint Track 2 Reversed',
  'SO4': 'South City Long',
  'SO4R': 'South City Long Reversed',
  'SO5': 'South City Town Course',
  'SO5R': 'South City Town Course Reversed',
  'SO6': 'South City Chicane Route',
  'SO6R': 'South City Chicane Route Reversed',

  // South City TC Open World (SO#X)
  'SO1X': '[TC] South City Open World 1',
  'SO2X': '[TC] South City Open World 2',
  'SO3X': '[TC] South City Open World 3',
  'SO4X': '[TC] South City Open World 4',
  'SO5X': '[TC] South City Open World 5',
  'SO6X': '[TC] South City Open World 6',
  'SO7X': '[TC] South City Open World 7',

  // Fern Bay (FE)
  'FE1': 'Fern Bay Club',
  'FE1R': 'Fern Bay Club Reversed',
  'FE2': 'Fern Bay Green',
  'FE2R': 'Fern Bay Green Reversed',
  'FE3': 'Fern Bay Gold',
  'FE3R': 'Fern Bay Gold Reversed',
  'FE4': 'Fern Bay Black',
  'FE4R': 'Fern Bay Black Reversed',
  'FE5': 'Fern Bay Rallycross',
  'FE6': 'Fern Bay RallyX Green',

  // Fern Bay TC Open World (FE#X)
  'FE1X': '[TC] Fern Bay Open World 1',
  'FE2X': '[TC] Fern Bay Open World 2',
  'FE3X': '[TC] Fern Bay Open World 3',

  // Aston (AS)
  'AS1': 'Aston Cadet',
  'AS1R': 'Aston Cadet Reversed',
  'AS2': 'Aston Club',
  'AS2R': 'Aston Club Reversed',
  'AS3': 'Aston National',
  'AS3R': 'Aston National Reversed',
  'AS4': 'Aston Historic',
  'AS4R': 'Aston Historic Reversed',
  'AS5': 'Aston Grand Prix',
  'AS5R': 'Aston Grand Prix Reversed',
  'AS6': 'Aston Grand Touring',
  'AS6R': 'Aston Grand Touring Reversed',
  'AS7': 'Aston North',
  'AS7R': 'Aston North Reversed',

  // Aston TC Open World (AS#X)
  'AS1X': '[TC] Aston Open World 1',
  'AS2X': '[TC] Aston Open World 2',
  'AS3X': '[TC] Aston Open World 3',

  // Kyoto Ring (KY)
  'KY1': 'Kyoto Ring Oval',
  'KY1R': 'Kyoto Ring Oval Reversed',
  'KY2': 'Kyoto Ring National',
  'KY2R': 'Kyoto Ring National Reversed',
  'KY3': 'Kyoto Ring GP Long',
  'KY3R': 'Kyoto Ring GP Long Reversed',

  // Kyoto TC Open World (KY#X)
  'KY1X': '[TC] Kyoto Open World 1',
  'KY2X': '[TC] Kyoto Open World 2',
  'KY3X': '[TC] Kyoto Open World 3',

  // Westhill (WE)
  'WE1': 'Westhill International',
  'WE1R': 'Westhill International Reversed',

  // Westhill TC Open World (WE#X)
  'WE1X': '[TC] Westhill Open World 1',
  'WE2X': '[TC] Westhill Open World 2',
  'WE3X': '[TC] Westhill Open World 3',

  // Autocross (AU)
  'AU1': 'Autocross',
  'AU2': 'Skid Pad',

  // Autocross TC Open World (AU#X)
  'AU1X': '[TC] Autocross Open World 1',

  // Rockingham (RO)
  'RO1': 'Rockingham ISSC',
  'RO2': 'Rockingham National',
  'RO3': 'Rockingham Oval',
  'RO4': 'Rockingham ISSC Long',
  'RO5': 'Rockingham Lake',
  'RO6': 'Rockingham Handling',
  'RO7': 'Rockingham International',
  'RO8': 'Rockingham International Long',
  'RO9': 'Rockingham Sportscar',
  'RO10': 'Rockingham Sportscar Long',
  'RO11': 'Rockingham International Long Alt',

  // Rockingham TC Open World (RO#X)
  'RO1X': '[TC] Rockingham Open World 1',
  'RO2X': '[TC] Rockingham Open World 2',

  // Layout Editor (LA)
  'LA1': 'Layout - Custom Track',

  // Layout TC Open World (LA#X)
  'LA1X': '[TC] Layout Open World 1',
  'LA2X': '[TC] Layout Open World 2',

  // Drag Strip
  'DR1': 'Drag Strip'
};

// Získání názvu tratě podle kódu
export function getTrackName(trackCode) {
  return TRACK_NAMES[trackCode] || trackCode;
}

// Získání track code z plného názvu (např. "BL1R" -> "BL")
export function getTrackCodePrefix(trackCode) {
  return trackCode.substring(0, 2);
}
