// prebuild.js - Pre-build validation and setup
import fs from 'fs';
import { execSync } from 'child_process';

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

function check(condition, successMsg, failMsg) {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${successMsg}`);
    return true;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${failMsg}`);
    return false;
  }
}

async function main() {
  log('\n============================================================', 'cyan');
  log('   Pre-Build Validation', 'cyan');
  log('============================================================\n', 'cyan');

  let allGood = true;

  // Check Node.js version
  log('Checking Node.js version...', 'cyan');
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  allGood &= check(
    majorVersion >= 18,
    `Node.js ${nodeVersion} (OK)`,
    `Node.js ${nodeVersion} is too old (need >= 18)`
  );

  // Check required files
  log('\nChecking required files...', 'cyan');
  const requiredFiles = [
    'server.js',
    'package.json',
    'radio_browser.js',
    'abradia_api.js',
    'track_names.js',
    'public/index.html',
    'public/radio.html',
    'public/track_configs.js'
  ];

  requiredFiles.forEach(file => {
    allGood &= check(
      fs.existsSync(file),
      file,
      `${file} is missing!`
    );
  });

  // Check public/tracks directory
  log('\nChecking track images...', 'cyan');
  if (fs.existsSync('public/tracks')) {
    const tracks = fs.readdirSync('public/tracks').filter(f => f.endsWith('.png'));
    allGood &= check(
      tracks.length >= 9,
      `${tracks.length} track images found`,
      `Only ${tracks.length} track images found (expected 9)`
    );
  } else {
    allGood &= check(
      false,
      'public/tracks directory exists',
      'public/tracks directory is missing!'
    );
  }

  // Check node_modules
  log('\nChecking dependencies...', 'cyan');
  if (!fs.existsSync('node_modules')) {
    log('Installing dependencies...', 'yellow');
    try {
      execSync('npm install', { stdio: 'inherit' });
      log('✓ Dependencies installed', 'green');
    } catch (e) {
      log('✗ Failed to install dependencies', 'red');
      allGood = false;
    }
  } else {
    log('✓ node_modules found', 'green');
  }

  // Check for config example
  log('\nChecking configuration...', 'cyan');
  if (!fs.existsSync('radio_config.json')) {
    if (fs.existsSync('radio_config.example.json')) {
      fs.copyFileSync('radio_config.example.json', 'radio_config.json');
      log('✓ Created radio_config.json from example', 'green');
    } else {
      log('! radio_config.json not found (will be created at runtime)', 'yellow');
    }
  } else {
    log('✓ radio_config.json exists', 'green');
  }

  // Summary
  log('\n============================================================', allGood ? 'green' : 'red');
  if (allGood) {
    log('   Pre-Build Validation PASSED', 'green');
    log('============================================================\n', 'green');
  } else {
    log('   Pre-Build Validation FAILED', 'red');
    log('============================================================\n', 'red');
    log('Please fix the errors above before building.', 'yellow');
    process.exit(1);
  }
}

main();
