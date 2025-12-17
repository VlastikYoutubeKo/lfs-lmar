# Contributing to LFS Live Map + Radio

First off, thanks for taking the time to contribute! 🎉

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Include screenshots if relevant**
- **Mention your environment** (OS, LFS version, app version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List some examples of how it would work**

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** and test thoroughly
3. **Follow the existing code style**
4. **Update documentation** if needed
5. **Write clear commit messages**
6. **Test the build** with `npm run build`

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/lfs-live-map-radio.git
cd lfs-live-map-radio

# Install dependencies
npm install

# Run in development mode
npm run dev

# Test the build
npm run build
```

## Code Style Guidelines

### JavaScript
- Use ES modules (import/export)
- Use async/await for asynchronous code
- Add JSDoc comments for complex functions
- Keep functions small and focused
- Use meaningful variable names

### Commits
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Reference issues and pull requests when relevant
- Keep commits focused on single changes

### Example:
```
feat: Add volume control to radio GUI

- Implement +/- buttons
- Add volume indicator
- Update WebSocket protocol
- Close #42
```

## Project Structure

```
lfs-live-map-radio/
├── server.js              # Main server (InSim + WebSocket)
├── build.js               # Build orchestration
├── prebuild.js            # Pre-build validation
├── postbuild.js           # Post-build packaging
├── radio_browser.js       # Radio Browser API client
├── abradia_api.js         # Abradia.cz API client
├── track_names.js         # LFS track definitions
├── public/                # Frontend assets
│   ├── index.html        # Live map UI
│   ├── radio.html        # Radio player UI
│   ├── track_configs.js  # Track coordinate configs
│   └── tracks/           # Track PNG files
└── .github/
    └── workflows/        # CI/CD pipelines
```

## Testing Checklist

Before submitting a PR, verify:

- [ ] Code runs without errors: `npm start`
- [ ] Build succeeds: `npm run build`
- [ ] No console warnings in browser (F12)
- [ ] InSim GUI displays correctly in LFS
- [ ] Radio playback works
- [ ] Map renders correctly for all tracks
- [ ] Changes work on Windows 10 and 11

## Adding New Features

### Adding a new track:

1. Place PNG file in `public/tracks/` as `track_XX.png`
2. Add bounds to `public/track_configs.js`
3. Test coordinate mapping
4. Update track count in documentation

### Adding a new radio source:

1. Create API client in new file (e.g., `newapi_api.js`)
2. Export async functions for search/play/metadata
3. Integrate into `server.js` radio handlers
4. Update GUI with new button/category
5. Add to documentation

## Building and Releases

Releases are automated via GitHub Actions when you push a tag:

```bash
# Create a new version
npm version patch  # or minor, or major

# Push with tags
git push origin main --tags
```

This triggers the build workflow which:
1. Builds the EXE
2. Packages all assets
3. Creates a GitHub Release
4. Uploads the ZIP file

## Need Help?

- 💬 Open an issue for questions
- 📧 Contact maintainers
- 📖 Read the full [README.md](README.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🏁
