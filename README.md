# 🏁 LFS Live Map + Radio

Live For Speed InSim aplikace kombinující real-time mapu všech hráčů na serveru s integrovaným internetovým rádiem.

## 📦 Releases

Stáhni si poslední verzi z [Releases](https://github.com/VlastikYoutubeKo/lfs-lmar/releases) - obsahuje standalone EXE bez nutnosti instalace Node.js!

## ✨ Funkce

- **Live Mapa** - Real-time pozice všech hráčů na serveru
- **9 Tratí** - Blackwood, South City, Fern Bay, Aston, Kyoto, Westhill, Autocross, Rockingham, Layout Square
- **Internetové Rádio** - 30,000+ mezinárodních stanic + České stanice (Abradia.cz)
- **InSim GUI** - Ovládání přímo v LFS
- **Metadata** - Zobrazení aktuálně hrající skladby
- **Multi-jazyčnost** - Angličtina / Čeština
- **Sledování hráčů** - Klikni na hráče v seznamu pro automatické sledování

## 🚀 Rychlý start (EXE verze)

1. **Stáhni poslední release** z [Releases](https://github.com/VlastikYoutubeKo/lfs-lmar/releases)
2. **Rozbal ZIP** do libovolné složky
3. **Spusť `lfs-live-map-radio.exe`** (nebo `START.bat`)
4. **V LFS zadej:** `/insim 29999`
5. **Otevři prohlížeč:** `http://localhost:3000`

### Požadavky pro radio:
- **MPV** (doporučeno): `choco install mpv`
- **VLC**: https://www.videolan.org/

## 🛠️ Development Setup

```bash
# 1. Klonuj repo
git clone https://github.com/VlastikYoutubeKo/lfs-lmar.git
cd lfs-live-map-radio

# 2. Instaluj dependencies
npm install

# 3. Spusť dev server
npm start

# Nebo s auto-reloadem:
npm run dev
```

## 📦 Building

### Lokální build:

```bash
# Windows:
BUILD.bat

# Nebo přímo:
npm run build
```

Výsledek najdeš v `dist/` složce.

### GitHub Actions:

Build se automaticky spustí při vytvoření tagu:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Release se automaticky vytvoří s připojeným ZIP souborem.

## 📖 Používání

### InSim GUI Commands:

- `/o gui` - Obnovit GUI pokud zmizelo
- `/o np` - Zobrazit Now Playing overlay

### Radio GUI:

1. **Klikni na ikonu [R]** v pravém horním rohu LFS
2. **Vyber kategorii:**
   - Oblíbené
   - Nedávné
   - Abradia.cz (České stanice)
   - Hledat (mezinárodní stanice)
3. **Ovládání hlasitosti:** +/- tlačítka
4. **Language:** Přepínač EN/CZ

### Web Mapa:

- **Zoom:** Kolečko myši nebo tlačítka +/-
- **Posun:** Táhni myší
- **Reset:** Tlačítko ⌂
- **Sledování hráče:** Klikni na jméno v postranním panelu
- **Hamburger menu:** Pravý horní roh - seznam hráčů a informace

## 🎮 LFS Konfigurace

### Automatické připojení při startu LFS:

Přidej do `cfg.txt`:
```
InSimPort=29999
```

### Manuální připojení:

V LFS zadej:
```
/insim 29999
```

## 📁 Struktura projektu

```
lfs-live-map-radio/
├── server.js              # Hlavní server (InSim + WebSocket)
├── build.js               # Build script
├── BUILD.bat              # Windows build launcher
├── START.bat              # User-friendly launcher
├── package.json           # Dependencies & scripts
├── radio_browser.js       # Radio Browser API
├── abradia_api.js         # Abradia.cz API
├── track_names.js         # LFS track names
├── public/
│   ├── index.html        # Live map interface
│   ├── radio.html        # Sony DSX-M80 radio emulator
│   ├── track_configs.js  # Track coordinate mappings
│   └── tracks/           # Track PNG images (9 tracks)
└── .github/
    └── workflows/
        └── build-release.yml  # Automated builds
```

## 🔧 Technologie

- **Node.js 20** - Runtime
- **node-insim** - LFS InSim protocol
- **react-node-insim** - InSim GUI components
- **WebSocket** - Real-time communication
- **Canvas API** - Map rendering
- **MPV/VLC** - Audio playback
- **pkg** - Executable packaging

## 🌐 API Integrace

- **Radio Browser API** - 30,000+ international stations
- **Abradia.cz API** - Czech radio stations with metadata
- **LFS InSim Protocol** - Live game data

## 📝 Konfigurace

### radio_config.json

```json
{
  "favorites": [
    {
      "name": "Station Name",
      "url": "https://stream-url.com/stream",
      "metadataProvider": "abradia",
      "metadataSlug": "station-slug"
    }
  ],
  "recent": [],
  "lang": "en"
}
```

## 🐛 Troubleshooting

### Radio nehraje:
- Zkontroluj instalaci MPV/VLC: `mpv --version` nebo `vlc --version`
- Windows: Přidej MPV do PATH
- Zkontroluj firewall

### GUI zmizelo:
- Zadej v LFS: `/o gui`
- Respawn vozu automaticky obnoví GUI

### Port konflikt:
- Porty 3000, 3001, 29999 musí být volné
- Zavři jiné aplikace na těchto portech

### Mapa se nenačítá:
- Zkontroluj `public/tracks/` obsahuje PNG soubory
- Otevři browser console (F12) pro chyby

## 📜 License

MIT License - Vlastimil © 2025

## 🤝 Contributing

Pull requests vítány! Pro větší změny otevři nejprve issue.

## 📧 Kontakt

- GitHub Issues: [Report Bug](https://github.com/VlastikYoutubeKo/lfs-lmar/issues)
- Discord: @mxnticek

## 🙏 Acknowledgments

- LFS Community
- node-insim by [@simbroadcasts](https://github.com/simbroadcasts)
- Radio Browser Project
- Abradia.cz

---

**Vytvořeno s ❤️ pro Live For Speed komunitu**
