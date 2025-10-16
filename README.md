# IDT React

Automated, improved bulk ordering system for DNA oligonucleotides and Probes from Integrated DNA Technologies (IDT). Web UI for order creation + local desktop agent for browser automation.

## Quick Start

### For Users

1. **Download** the latest agent from [Releases](https://github.com/MMZaini/idt-react/releases)
2. **Extract** the ZIP to any folder
3. **Run** `idt-agent.exe` (Windows) or `./idt-agent` (macOS)
4. **Visit** the web UI and start ordering

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

**Build and Test Agent (CI)** - `build-agent.yml`
- Runs on every push/PR to validate builds
- Does not create releases

**Release Agent with Provenance** - `release-agent.yml`
- Creates/updates the `latest` release with cryptographic attestations
- Triggers on push to main (auto), git tags, or manual dispatch
- Builds for Windows and macOS
- Always uses stable filenames (`idt-agent-windows.zip`, `idt-agent-macos.zip`)

## Deployment

- **Web UI:** Deployed on Vercel
- **Agent:** Distributed as standalone executables via GitHub Releases