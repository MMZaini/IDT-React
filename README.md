# IDT React

Automated, improved bulk ordering system for DNA oligonucleotides and Probes from Integrated DNA Technologies (IDT). Features a modern web interface with AI-powered sequence generation and a local automation agent for seamless order submission.

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

## Features

### Smart Order Management
- **Bulk Ordering** - Add up to 200 lines at once with automatic validation
- **Import/Export** - Save and load orders in JSON format for easy reuse
- **Force Submit** - Override validation warnings when needed (agent must be online)
- **Live Validation** - Instant feedback on sequence length, scale compatibility, and purification requirements

### AI-Powered Sequence Generation
- **Intelligent Extraction** - Upload documents and automatically extract DNA sequences
- **Organism Detection** - Finds sequences for specific organisms from research papers
- **Expanded Search** - Optional deep search mode to find as many sequences as possible
- **Smart Parameters** - Automatically selects appropriate scale and purification based on sequence length

### User-Friendly Interface
- **Helpful Tooltips** - Hover over any button to see what it does
- **Visual Feedback** - Clear indicators for agent status, validation errors, and submission progress
- **Responsive Design** - Works seamlessly on desktop browsers
- **Dark Mode** - Built-in dark theme support

### Browser Automation
- **One-Click Submission** - Agent handles the entire IDT website interaction
- **Persistent Sessions** - Maintains login state across orders
- **Automatic Focus** - Browser window appears in foreground when automation starts

## Usage Tips

- **First Time Setup**: When you first visit the AI sidebar, you'll see a welcome guide
- **API Key**: Add your OpenAI API key in the AI sidebar to enable sequence generation
- **Bug Reports**: Found an issue? Email us at zainimahdi@outlook.com

## For Developers

```bash
npm install
npm run dev           # Start web UI at http://localhost:3000
npm run agent         # Run agent locally for testing
```

**Build Agent:**
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

## Deployment

- **Web UI:** Deployed on Vercel
- **Agent:** Distributed as standalone executables via GitHub Releases