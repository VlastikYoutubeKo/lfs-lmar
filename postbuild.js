// postbuild.js - Post-build packaging and verification
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function step(msg) {
  console.log(`\n${colors.cyan}[POST-BUILD]${colors.reset} ${msg}`);
}

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

async function main() {
  log('\n============================================================', 'magenta');
  log('   Post-Build Packaging', 'magenta');
  log('============================================================\n', 'magenta');

  try {
    // 1. Verify EXE exists
    step('Verifying build output...');
    if (!fs.existsSync('dist/lfs-live-map-radio.exe')) {
      throw new Error('Executable not found in dist/');
    }
    const stats = fs.statSync('dist/lfs-live-map-radio.exe');
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    success(`Executable found (${sizeMB} MB)`);

    // 2. Verify assets
    step('Verifying assets...');
    const requiredDirs = ['public', 'public/tracks'];
    const requiredFiles = ['radio_config.json', 'START.bat', 'README.txt'];
    
    let missingAssets = [];
    requiredDirs.forEach(dir => {
      if (!fs.existsSync(`dist/${dir}`)) {
        missingAssets.push(`${dir}/`);
      }
    });
    
    requiredFiles.forEach(file => {
      if (!fs.existsSync(`dist/${file}`)) {
        missingAssets.push(file);
      }
    });

    if (missingAssets.length > 0) {
      throw new Error(`Missing assets: ${missingAssets.join(', ')}`);
    }
    success('All required assets present');

    // 3. Count track files
    const trackFiles = fs.readdirSync('dist/public/tracks').filter(f => f.endsWith('.png'));
    success(`${trackFiles.length} track images included`);

    // 4. Create release package info
    step('Creating package info...');
    
    const packageInfo = {
      name: 'LFS Live Map + Radio',
      version: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
      buildDate: new Date().toISOString(),
      files: {
        executable: 'lfs-live-map-radio.exe',
        size: `${sizeMB} MB`,
        tracks: trackFiles.length,
        assets: countFiles('dist')
      },
      requirements: {
        os: 'Windows x64',
        runtime: 'Standalone (Node.js bundled)',
        optional: 'MPV or VLC for radio playback'
      }
    };

    fs.writeFileSync('dist/BUILD_INFO.json', JSON.stringify(packageInfo, null, 2));
    success('Package info created');

    // 5. Create portable launcher
    step('Creating portable launcher...');
    
    const portableBat = `@echo off
title LFS Live Map + Radio

echo.
echo ============================================================
echo    LFS Live Map + Radio v${packageInfo.version}
echo    Portable Edition
echo ============================================================
echo.
echo [INFO] Starting server...
echo [WEB] Open: http://localhost:3000
echo [LFS] In LFS type: /insim 29999
echo.
echo Press Ctrl+C to stop
echo.

start /B lfs-live-map-radio.exe

timeout /t 2 >nul

REM Open browser automatically
start http://localhost:3000

echo.
echo [OK] Server is running!
echo [INFO] Close this window to stop the server
echo.

pause >nul
`;

    fs.writeFileSync('dist/RUN.bat', portableBat);
    success('Portable launcher created');

    // 6. Final summary
    log('\n============================================================', 'green');
    log('   POST-BUILD COMPLETED!', 'green');
    log('============================================================\n', 'green');

    console.log(`${colors.cyan}Package Summary:${colors.reset}`);
    console.log(`  • Name: ${packageInfo.name}`);
    console.log(`  • Version: ${packageInfo.version}`);
    console.log(`  • Size: ${sizeMB} MB`);
    console.log(`  • Files: ${packageInfo.files.assets} total`);
    console.log(`  • Tracks: ${trackFiles.length} maps`);
    console.log(`\n${colors.cyan}Distribution files:${colors.reset}`);
    console.log(`  • dist/lfs-live-map-radio.exe - Main executable`);
    console.log(`  • dist/RUN.bat - Auto-start launcher`);
    console.log(`  • dist/START.bat - Manual launcher`);
    console.log(`  • dist/README.txt - User guide`);
    console.log(`  • dist/BUILD_INFO.json - Build information`);
    console.log(`\n${colors.yellow}Ready to package!${colors.reset}`);
    console.log(`  To create release: Zip the 'dist' folder\n`);

  } catch (err) {
    log('\n============================================================', 'red');
    log('   POST-BUILD FAILED!', 'red');
    log('============================================================\n', 'red');
    console.error(err);
    process.exit(1);
  }
}

function countFiles(dir) {
  let count = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isFile()) {
      count++;
    } else if (item.isDirectory()) {
      count += countFiles(path.join(dir, item.name));
    }
  }
  
  return count;
}

main();
