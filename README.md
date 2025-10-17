# IDT React

Automated, improved bulk ordering system for DNA oligonucleotides and Probes from Integrated DNA Technologies (IDT). Web UI for order creation + local desktop agent for browser automation.

## Quick Start

### For Users

**Download the latest agent:**

<div align="center">

[![Download for Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/MMZaini/idt-react/releases/latest/download/idt-agent-windows.zip)
[![Download for macOS](https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/MMZaini/idt-react/releases/latest/download/idt-agent-macos.zip)

</div>

**Then:**

1. **Extract** the ZIP to any folder
2. **Run** `idt-agent.exe` (Windows) or `./idt-agent` (macOS)
3. **Visit** the web UI and start ordering

### For Developers

```bash
npm install
npm run dev           # Start web UI at http://localhost:3000
npm run agent         # Run agent locally for testing
```

## Project Structure

- `src/app/` - Next.js web UI for order creation
- `scripts/local-agent.js` - HTTP server (port 4599) that runs Selenium automation
- `scripts/runner-core-selenium.js` - Browser automation logic for IDT website

## Build Agent

```bash
# Windows
npm run pkg:agent:win:with-chromedriver

# macOS
npm run pkg:agent:mac
node scripts/copy-chromedriver.js
node scripts/copy-runtime-deps.js
```

## Security - Verify Downloads

All releases include SLSA build provenance. Verify authenticity:

```bash
# Install GitHub CLI
brew install gh              # macOS
winget install GitHub.cli    # Windows

# Verify download
gh attestation verify idt-agent-windows.zip -R MMZaini/idt-react
```

**Success output:**
```
✓ Verification succeeded!

sha256:abc123... was attested by:
REPO                PREDICATE_TYPE                  WORKFLOW
MMZaini/idt-react  https://slsa.dev/provenance/v1  .github/workflows/release-agent.yml@refs/tags/latest
```

**What this proves:**
- File was built by official GitHub Actions workflow
- File hasn't been tampered with since build
- Build is traceable to exact source code commit

## Releases

### Automatic Updates

Push to `main` automatically updates the release when agent files change:

```bash
git push origin main
```

Updates the `latest` tag with new builds. Downloads always get the most recent version.

### What Triggers Builds

Workflows only run when these files change:
- `scripts/*.js` - Agent source and build scripts
- `package.json`, `package-lock.json` - Dependencies
- `.github/workflows/*.yml` - Workflow files

Web UI changes (Next.js, React, CSS) don't trigger agent builds.

## Workflows

## Workflow

**Release Agent with Provenance** - `release-agent.yml`
- Automatically creates/updates the `latest` release when agent files change
- Includes cryptographic build attestations (SLSA provenance)
- Triggers on push to main, git tags, or manual dispatch
- Builds for Windows and macOS with smoke tests
- Uses stable filenames (`idt-agent-windows.zip`, `idt-agent-macos.zip`)

## Deployment

- **Web UI:** Deployed on Vercel
- **Agent:** Distributed as standalone executables via GitHub Releases