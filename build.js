// build.js - Main build script for creating standalone EXE
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI Colors for logging
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function step(msg) {
  console.log(`\n${colors.cyan}[BUILD]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

async function main() {
  try {
    log('\n============================================================', 'cyan');
    log('   LFS Live Map + Radio - Build Process', 'cyan');
    log('============================================================\n', 'cyan');

    // 1. Clean old build
    step('Cleaning old build...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist', { recursive: true });
    success('Old build cleaned');

    // 2. Create asset manifest
    step('Creating asset manifest...');
    const assets = {
      public: [],
      root: []
    };

    // Scan public directory
    if (fs.existsSync('public')) {
      const scanDir = (dir, base = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(base, entry.name);
          
          if (entry.isDirectory()) {
            scanDir(fullPath, relativePath);
          } else {
            assets.public.push(relativePath.replace(/\\/g, '/'));
          }
        });
      };
      scanDir('public');
    }

    // Root files to include
    const rootFiles = [
      'radio_config.json',
      'track_names.js',
      'radio_browser.js',
      'abradia_api.js',
      'metadata_providers.js'
    ];

    rootFiles.forEach(file => {
      if (fs.existsSync(file)) {
        assets.root.push(file);
      }
    });

    fs.writeFileSync('dist/assets.json', JSON.stringify(assets, null, 2));
    success(`Asset manifest created (${assets.public.length + assets.root.length} files)`);

    // 3. Copy necessary files to dist
    step('Copying assets to dist...');
    
    // Copy public directory
    if (fs.existsSync('public')) {
      fs.cpSync('public', 'dist/public', { recursive: true });
      success('Public directory copied');
    }

    // Copy root files
    rootFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, `dist/${file}`);
      }
    });
    success('Root files copied');

    // Copy START.bat
    if (fs.existsSync('START.bat')) {
      fs.copyFileSync('START.bat', 'dist/START.bat');
    }

    // 4. Build EXE with pkg
    step('Building executable with pkg...');
    log('This may take a few minutes on first run...', 'yellow');
    
    try {
      execSync('pkg . --out-path dist --targets node20-win-x64 --compress Brotli', {
        stdio: 'inherit',
        cwd: __dirname
      });
      success('Executable built successfully');
    } catch (e) {
      error('pkg build failed');
      throw e;
    }

    // 5. Rename executable
    step('Finalizing...');
    if (fs.existsSync('dist/lfs-live-map-radio.exe')) {
      // EXE already has correct name
      success('Executable ready: lfs-live-map-radio.exe');
    } else if (fs.existsSync('dist/server.exe')) {
      fs.renameSync('dist/server.exe', 'dist/lfs-live-map-radio.exe');
      success('Executable renamed: lfs-live-map-radio.exe');
    }

    // 6. Create README for dist
    const readme = `# LFS Live Map + Radio - Standalone Build

## Jak použít:

1. **Spuštění aplikace:**
   - Spusť \`lfs-live-map-radio.exe\`
   - Nebo použij \`START.bat\` pro uživatelsky přívětivější spuštění

2. **Připojení k LFS:**
   - V LFS zadej: \`/insim 29999\`
   - Nebo nastav InSim v \`cfg.txt\`: \`InSimPort=29999\`

3. **Přístup k mapě:**
   - Otevři prohlížeč: \`http://localhost:3000\`
   - Pro radio přehrávač: \`http://localhost:3000/radio.html\`

4. **Radio ovládání:**
   - V LFS stiskni ikonu [R] v pravém horním rohu
   - Nebo zadej: \`/o gui\` pro obnovení GUI

## Požadavky:

- **MPV nebo VLC přehrávač** (pro funkci rádia)
  - MPV: \`choco install mpv\`
  - VLC: https://www.videolan.org/

## Řešení problémů:

- **Port už používán:** Zavři jiné programy na portech 3000, 3001, 29999
- **Radio nefunguje:** Zkontroluj instalaci MPV/VLC
- **GUI se nezobrazuje:** Zadej v LFS: \`/o gui\`

## Soubory v balíčku:

- \`lfs-live-map-radio.exe\` - Hlavní aplikace
- \`public/\` - Web rozhraní a mapy tratí
- \`radio_config.json\` - Konfigurace rádia
- \`START.bat\` - Spouštěcí skript s kontrolami

---

Build verze: ${new Date().toISOString()}
`;

    fs.writeFileSync('dist/README.txt', readme);
    success('README created');

    // 7. Run post-build processing
    step('Running post-build processing...');
    try {
      const { default: postbuild } = await import('./postbuild.js');
      // postbuild.js runs its own main(), so we just import it
    } catch (e) {
      log('Post-build processing skipped (optional)', 'yellow');
    }

    log('\n============================================================', 'green');
    log('   BUILD COMPLETED SUCCESSFULLY!', 'green');
    log('============================================================\n', 'green');

  } catch (err) {
    log('\n============================================================', 'red');
    log('   BUILD FAILED!', 'red');
    log('============================================================\n', 'red');
    console.error(err);
    process.exit(1);
  }
}

main();
