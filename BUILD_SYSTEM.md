# 📦 LFS Live Map + Radio - Build System Overview

Tento dokument popisuje kompletní build systém pro vytváření standalone EXE balíčku.

## 🎯 Co bylo vytvořeno

### Core Build Files

1. **package.json** (aktualizovaný)
   - Přidány build scripty
   - Přidán `pkg` jako devDependency
   - Konfigurace pro pkg packaging

2. **build.js**
   - Hlavní build orchestrator
   - Vytváří dist folder
   - Volá pkg pro kompilaci
   - Kopíruje assets
   - Generuje README a dokumentaci

3. **prebuild.js**
   - Validace před buildem
   - Kontrola Node.js verze
   - Kontrola required files
   - Instalace dependencies

4. **postbuild.js**
   - Post-build verifikace
   - Vytváření package info
   - Generování portable launcheru
   - Build summary

5. **BUILD.bat**
   - Windows batch script pro lokální build
   - User-friendly interface
   - Error handling

### GitHub Actions

6. **.github/workflows/build-release.yml**
   - Automatický build při push tagu
   - Windows runner
   - Vytváří GitHub Release
   - Upload ZIP souboru

### Documentation

7. **README.md**
   - Kompletní projekt dokumentace
   - Build instrukce
   - Usage guide
   - Troubleshooting

8. **QUICKSTART.md**
   - Quick start guide pro end-users
   - Setup instrukce
   - Common problems

9. **CONTRIBUTING.md**
   - Guidelines pro contributory
   - Code style
   - PR process

10. **CHANGELOG.md**
    - Version history template
    - Semantic versioning

### GitHub Templates

11. **.github/ISSUE_TEMPLATE/bug_report.md**
    - Bug report template

12. **.github/ISSUE_TEMPLATE/feature_request.md**
    - Feature request template

### Configuration

13. **.gitignore**
    - Ignore dist/, node_modules/, etc.

14. **radio_config.example.json**
    - Example configuration file

## 🚀 Jak použít Build System

### Lokální Build

```bash
# Metoda 1: Použij BUILD.bat (nejjednodušší)
BUILD.bat

# Metoda 2: NPM script
npm install
npm run build

# Metoda 3: Přímé volání
node build.js
```

### Výsledek
Po buildu najdeš v `dist/` složce:
```
dist/
├── lfs-live-map-radio.exe    # Hlavní executable
├── public/                     # Web assets
│   ├── index.html
│   ├── radio.html
│   ├── track_configs.js
│   └── tracks/                 # 9 PNG map files
├── radio_config.json          # Config file
├── START.bat                  # Original launcher
├── RUN.bat                    # Auto-start launcher
├── README.txt                 # User guide
└── BUILD_INFO.json            # Build metadata
```

### GitHub Automated Build

1. **Commit změny:**
```bash
git add .
git commit -m "feat: Add new feature"
git push origin main
```

2. **Create release tag:**
```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major

# Push with tags
git push origin main --tags
```

3. **GitHub Actions automatically:**
   - Detects tag push
   - Runs build on Windows runner
   - Creates executable
   - Packages everything into ZIP
   - Creates GitHub Release
   - Uploads ZIP to release

4. **Result:**
   - Release page s downloadable ZIP
   - Auto-generated release notes
   - Build artifacts

## 📋 Build Process Flow

```
START
  ↓
prebuild.js (validation)
  ├─ Check Node.js version
  ├─ Verify required files
  ├─ Check dependencies
  └─ Create config if missing
  ↓
build.js (main build)
  ├─ Clean dist/
  ├─ Create asset manifest
  ├─ Copy public/ assets
  ├─ Copy root files
  ├─ Run pkg (compile to EXE)
  ├─ Rename executable
  └─ Generate README.txt
  ↓
postbuild.js (packaging)
  ├─ Verify EXE exists
  ├─ Check all assets
  ├─ Create BUILD_INFO.json
  ├─ Generate RUN.bat
  └─ Print summary
  ↓
DONE - Ready in dist/
```

## 🔧 Build Configuration

### pkg Configuration (package.json)

```json
{
  "pkg": {
    "assets": [
      "public/**/*",           // Web files
      "radio_config.json",     // Config
      "node_modules/**/*"      // Dependencies
    ],
    "targets": [
      "node20-win-x64"         // Windows 64-bit
    ],
    "outputPath": "dist"
  }
}
```

### Build Targets

Aktuálně podporováno:
- ✅ Windows x64 (node20-win-x64)

Možné budoucí rozšíření:
- Windows x86 (node20-win-x86)
- Linux x64 (node20-linux-x64)
- macOS x64 (node20-macos-x64)

## 📦 Distribution Package

### Co obsahuje release ZIP:

```
LFS-LiveMap-Radio-v1.0.0/
├── lfs-live-map-radio.exe    # ~50 MB (Node.js bundled)
├── public/                     # ~2 MB (assets)
├── radio_config.json          # ~1 KB
├── START.bat                  # Launch script
├── RUN.bat                    # Auto-start script
├── README.txt                 # User documentation
└── BUILD_INFO.json            # Build metadata
```

### Celková velikost: ~52 MB

## 🎯 Pro Uživatele

### Installation Steps:
1. Download ZIP from GitHub Releases
2. Extract anywhere
3. Run `lfs-live-map-radio.exe`
4. (Optional) Install MPV for radio
5. In LFS: `/insim 29999`

### No Installation Required:
- ✅ Node.js je bundled v EXE
- ✅ Všechny dependencies included
- ✅ Portable - žádná instalace
- ✅ Single folder - easy to move/delete

## 🛠️ Pro Developery

### Development Workflow:

```bash
# 1. Make changes
vim server.js

# 2. Test locally
npm start

# 3. Test build
npm run build

# 4. Commit
git add .
git commit -m "feat: Your feature"

# 5. Create release
npm version patch
git push origin main --tags

# 6. Wait for GitHub Actions
# 7. Download from Releases page
```

### Build Troubleshooting:

**Problem:** `pkg` command not found
```bash
npm install -g pkg
```

**Problem:** Build fails - missing files
```bash
node prebuild.js  # Check what's missing
```

**Problem:** EXE crashes on startup
- Check console output
- Verify all assets are in dist/
- Test with `node server.js` first

**Problem:** Assets not loading
- Check paths in code (use `__dirname` or process.cwd())
- Verify `pkg.assets` includes all needed files
- Use `path.join()` for cross-platform paths

## 📊 Build Statistics

Typical build times:
- First build: ~5-10 minutes (downloads Node.js binaries)
- Subsequent builds: ~1-2 minutes (cached)

File sizes:
- Executable: ~45-50 MB (Node.js runtime included)
- Assets: ~2-3 MB
- Total package: ~50-55 MB

## 🔐 Security Notes

- EXE je signed pouze pokud máš code signing certificate
- Pro production release doporučuji code signing
- GitHub Actions runs na trusted Microsoft runners
- Dependencies jsou locked v package-lock.json

## 🎉 Success Indicators

Build byl úspěšný když:
- ✅ `dist/lfs-live-map-radio.exe` existuje
- ✅ Všechny `public/tracks/*.png` jsou v dist/
- ✅ `BUILD_INFO.json` obsahuje správné info
- ✅ EXE běží bez chyb
- ✅ Web interface se načte na localhost:3000
- ✅ InSim GUI se zobrazí v LFS

## 📝 TODO / Future Improvements

- [ ] Add Linux build target
- [ ] Add macOS build target
- [ ] Implement auto-updater
- [ ] Add digital signature
- [ ] Create installer (NSIS/Inno Setup)
- [ ] Add telemetry (opt-in)
- [ ] Implement crash reporting

## 🆘 Getting Help

Build problems?
1. Check `prebuild.js` output
2. Read error messages carefully
3. Check GitHub Actions logs
4. Open issue with build log

---

**Build System Version:** 1.0.0  
**Last Updated:** 2025-01-XX  
**Maintainer:** Vlastimil
