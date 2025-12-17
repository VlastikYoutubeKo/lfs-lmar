// build-sea.js - Native Node.js Single Executable Application builder
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI Colors
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
    log('   LFS Live Map + Radio - Native SEA Build', 'cyan');
    log('============================================================\n', 'cyan');

    // 1. Clean
    step('Cleaning old build...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
    fs.mkdirSync('dist', { recursive: true });
    success('Old build cleaned');

    // 2. Create SEA config
    step('Creating SEA configuration...');
    const seaConfig = {
      main: 'server.js',
      output: 'sea-prep.blob',
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false, // Must be false for cross-platform
      assets: {}
    };

    // Add all public files as assets
    function addAssets(dir, prefix = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        const assetKey = path.join(prefix, entry.name).replace(/\\/g, '/');
        
        if (entry.isDirectory()) {
          addAssets(fullPath, assetKey);
        } else {
          seaConfig.assets[assetKey] = fullPath;
        }
      });
    }

    // Add public directory
    if (fs.existsSync('public')) {
      addAssets('public', 'public');
    }

    // Add root files
    const rootFiles = ['radio_config.json', 'track_names.js', 'radio_browser.js', 'abradia_api.js', 'metadata_providers.js'];
    rootFiles.forEach(file => {
      if (fs.existsSync(file)) {
        seaConfig.assets[file] = file;
      }
    });

    fs.writeFileSync('sea-config.json', JSON.stringify(seaConfig, null, 2));
    success(`SEA config created (${Object.keys(seaConfig.assets).length} assets)`);

    // 3. Generate blob
    step('Generating SEA blob...');
    execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });
    success('SEA blob generated');

    // 4. Copy node executable
    step('Creating executable...');
    const isWindows = process.platform === 'win32';
    const exeName = isWindows ? 'lfs-live-map-radio.exe' : 'lfs-live-map-radio';
    const distExe = path.join('dist', exeName);

    if (isWindows) {
      fs.copyFileSync(process.execPath, distExe);
    } else {
      execSync(`cp $(command -v node) ${distExe}`);
    }
    success('Executable copied');

    // 5. Remove signature (Windows/macOS)
    if (process.platform === 'darwin') {
      step('Removing signature (macOS)...');
      execSync(`codesign --remove-signature ${distExe}`);
      success('Signature removed');
    }

    // 6. Inject blob
    step('Injecting blob into executable...');
    const postjectCmd = isWindows 
      ? `npx postject ${distExe} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`
      : process.platform === 'darwin'
        ? `npx postject ${distExe} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`
        : `npx postject ${distExe} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;

    execSync(postjectCmd, { stdio: 'inherit' });
    success('Blob injected');

    // 7. Sign (macOS)
    if (process.platform === 'darwin') {
      step('Signing executable (macOS)...');
      execSync(`codesign --sign - ${distExe}`);
      success('Executable signed');
    }

    // 8. Copy assets to dist
    step('Copying assets...');
    if (fs.existsSync('public')) {
      fs.cpSync('public', 'dist/public', { recursive: true });
    }
    rootFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.copyFileSync(file, `dist/${file}`);
      }
    });
    success('Assets copied');

    // 9. Cleanup
    step('Cleaning temporary files...');
    fs.unlinkSync('sea-config.json');
    fs.unlinkSync('sea-prep.blob');
    success('Cleanup complete');

    // 10. Summary
    const stats = fs.statSync(distExe);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    log('\n============================================================', 'green');
    log('   BUILD COMPLETED SUCCESSFULLY!', 'green');
    log('============================================================\n', 'green');

    console.log(`${colors.cyan}Build Information:${colors.reset}`);
    console.log(`  • Executable: ${distExe}`);
    console.log(`  • Size: ${sizeMB} MB`);
    console.log(`  • Assets: ${Object.keys(seaConfig.assets).length} files`);
    console.log(`  • Platform: ${process.platform} (${process.arch})`);
    console.log(`  • Node.js: ${process.version}`);
    console.log(`\n${colors.yellow}Next steps:${colors.reset}`);
    console.log(`  1. Test: cd dist && ./${exeName}`);
    console.log(`  2. Distribute: Share the dist folder\n`);

  } catch (err) {
    log('\n============================================================', 'red');
    log('   BUILD FAILED!', 'red');
    log('============================================================\n', 'red');
    console.error(err);
    process.exit(1);
  }
}

main();