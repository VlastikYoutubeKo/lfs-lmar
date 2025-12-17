# 📋 Build System - Complete File Listing

Tento dokument obsahuje kompletní přehled všech vytvořených souborů pro build systém.

## ✨ Nově vytvořené soubory

### Core Build System
```
├── package.json (UPDATED)          # Build scripts + pkg config
├── build.js                        # Main build orchestrator
├── prebuild.js                     # Pre-build validation
├── postbuild.js                    # Post-build packaging
└── BUILD.bat                       # Windows build launcher
```

### GitHub Integration
```
.github/
├── workflows/
│   └── build-release.yml          # Automated CI/CD builds
└── ISSUE_TEMPLATE/
    ├── bug_report.md              # Bug report template
    └── feature_request.md         # Feature request template
```

### Documentation
```
├── README.md                       # Main project documentation
├── QUICKSTART.md                   # Quick start guide
├── CONTRIBUTING.md                 # Contributing guidelines
├── CHANGELOG.md                    # Version history
└── BUILD_SYSTEM.md                 # Build system documentation
```

### Configuration
```
├── .gitignore                      # Git ignore rules
└── radio_config.example.json       # Example configuration
```

---

## 🎯 Použití

### 1. Lokální Build

**Nejjednodušší způsob:**
```cmd
BUILD.bat
```

**Nebo pomocí npm:**
```bash
npm install
npm run build
```

**Přímé volání:**
```bash
node build.js
```

### 2. GitHub Actions Build

**Vytvoření release:**
```bash
# Create and push tag
npm version patch
git push origin main --tags
```

GitHub Actions automaticky:
- Buildne EXE na Windows runneru
- Vytvoří ZIP balíček
- Vytvoří GitHub Release
- Nahraje ZIP k releasu

---

## 📦 Výsledná struktura (dist/)

Po buildu dostaneš:

```
dist/
├── lfs-live-map-radio.exe        # Main executable (~50 MB)
│
├── public/                         # Web interface
│   ├── index.html
│   ├── radio.html
│   ├── track_configs.js
│   └── tracks/                    # Track maps
│       ├── track_AS.png
│       ├── track_AU.png
│       ├── track_BL.png
│       ├── track_FE.png
│       ├── track_KY.png
│       ├── track_LA.png
│       ├── track_RO.png
│       ├── track_SO.png
│       └── track_WE.png
│
├── radio_config.json              # Radio configuration
├── START.bat                      # Original launcher
├── RUN.bat                        # Auto-start launcher
├── README.txt                     # User documentation
└── BUILD_INFO.json                # Build metadata
```

---

## 🚀 Distribution Process

### Pro koncové uživatele:

1. **Download** - Stáhni ZIP z GitHub Releases
2. **Extract** - Rozbal kdekoli
3. **Run** - Spusť `lfs-live-map-radio.exe`
4. **Enjoy** - No installation required!

### Pro vývojáře:

1. **Develop** - Pracuj na kódu
2. **Test** - `npm start` pro testing
3. **Build** - `npm run build` pro local build
4. **Release** - Push tag pro automated release

---

## 📊 Build Statistics

**Typické build časy:**
- První build: ~5-10 minut (stahuje Node.js binaries)
- Další builds: ~1-2 minuty (cached)

**Velikosti souborů:**
- Executable: ~45-50 MB (Node.js runtime included)
- Assets (public/): ~2-3 MB  
- Total ZIP: ~50-55 MB

**GitHub Actions:**
- Build duration: ~10-15 minut
- Uses: `windows-latest` runner
- Node.js: v20

---

## 🔍 Validace

### Pre-build checks (prebuild.js):
✓ Node.js >= 18  
✓ Required files exist  
✓ Track images present (9 PNG)  
✓ Dependencies installed  
✓ Config file ready  

### Post-build checks (postbuild.js):
✓ EXE exists and sized correctly  
✓ All assets copied  
✓ Track count verified  
✓ Package info generated  
✓ Launchers created  

---

## 💡 Pro nové contributors

Pokud chceš přispět k projektu:

1. **Fork** repository
2. **Clone** tvůj fork
3. **Install** dependencies: `npm install`
4. **Develop** - pracuj na změnách
5. **Test** - `npm start` a manual testing
6. **Build** - `npm run build` před commitem
7. **PR** - vytvoř Pull Request

Všechny detaily v [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🐛 Troubleshooting

### Build selže - missing files
```bash
node prebuild.js  # Zjistí co chybí
```

### pkg not found
```bash
npm install -g pkg
```

### Executable crashes
- Test nejprve: `node server.js`
- Check assets v dist/
- Verify paths in code

### GitHub Actions fail
- Check workflow logs
- Verify all files commited
- Check package.json syntax

---

## 📝 Co dál?

### Možná vylepšení:

- [ ] Linux build target (node20-linux-x64)
- [ ] macOS build target (node20-macos-x64)
- [ ] Auto-updater mechanism
- [ ] Digital signature (code signing)
- [ ] Installer wizard (NSIS/Inno Setup)
- [ ] Crash reporting
- [ ] Usage analytics (opt-in)

---

## 🎉 Hotovo!

Build systém je kompletně připraven! Můžeš:

1. **Buildovat lokálně** pomocí `BUILD.bat`
2. **Publishovat releases** pomocí git tags
3. **Distribuovat** ZIP soubory end-userům
4. **Přijímat pull requesty** s automated CI

---

**Created:** 2025-01-XX  
**Version:** 1.0.0  
**Author:** Vlastimil  

---

## 📞 Potřebuješ pomoc?

- 📖 [BUILD_SYSTEM.md](BUILD_SYSTEM.md) - Kompletní dokumentace
- 🐛 [GitHub Issues](https://github.com/YOUR_USERNAME/lfs-live-map-radio/issues)
- 💬 [Discussions](https://github.com/YOUR_USERNAME/lfs-live-map-radio/discussions)

**Happy Building! 🏁**
