# GitHub Actions & Release Process

## Overview

This project uses GitHub Actions for continuous integration and automated releases with cryptographic build provenance.

## Workflows

### 1. **Build and Test Agent (CI)** - `build-agent.yml`

**Purpose:** Continuous integration testing on every push/PR

**Triggers:**
- Push to `main` branch (when agent scripts change)
- Pull requests to `main`
- Manual workflow dispatch

**What it does:**
- Builds agent for Windows and macOS
- Runs portability smoke tests
- Uploads artifacts (temporary, 90-day retention)
- **Does NOT create releases**

**Use case:** Development validation and testing

---

### 2. **Release Agent with Provenance** - `release-agent.yml`

**Purpose:** Create official releases with cryptographic attestations

**Triggers:**
- Git tags matching `v*.*.*` pattern (e.g., `v1.0.0`)
- Manual workflow dispatch with version input

**What it does:**
1. Builds agent for Windows and macOS
2. Creates ZIP archives with version numbers
3. Runs portability smoke tests
4. **Generates SLSA build provenance attestations**
5. Creates GitHub Release with:
   - Release notes
   - Downloadable ZIP files
   - Provenance attestations
   - Verification instructions

**Use case:** Production releases for end users

---

## Creating a Release

### Method 1: Git Tag (Recommended)

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# The release workflow automatically triggers
```

### Method 2: Manual Dispatch

1. Go to GitHub → Actions → "Release Agent with Provenance"
2. Click "Run workflow"
3. Enter version (e.g., `v1.0.0`)
4. Click "Run workflow"

---

## Build Provenance (SLSA)

### What is it?

Build provenance provides cryptographic proof that:
- The artifact was built by GitHub Actions
- The build used specific source code (commit SHA)
- No tampering occurred after the build
- The build process is traceable and verifiable

### How it works

Each release includes attestation files that link the ZIP archive to:
- Source repository
- Commit SHA
- Workflow that built it
- Timestamp of build

### Verifying Downloads

Users can verify official releases using GitHub CLI:

```bash
# Install GitHub CLI (if not already installed)
brew install gh  # macOS
# or: winget install GitHub.cli  # Windows

# Login to GitHub
gh auth login

# Verify a downloaded release
gh attestation verify idt-agent-windows-v1.0.0.zip -R MMZaini/idt-react
```

**Expected output:**
```
✓ Verification succeeded!

Attestation is from:
  Verified by: GitHub
  Build by: MMZaini/idt-react/.github/workflows/release-agent.yml@main
  Source: MMZaini/idt-react@<commit-sha>
```

---

## Release Artifacts

Each release creates two ZIP files:

### `idt-agent-windows-<version>.zip`
- `idt-agent.exe` - Windows executable
- `chromedriver.exe` - ChromeDriver for Windows
- `runner-core-selenium.js` - Automation script
- `node_modules/` - Runtime dependencies
- `README.txt` - Installation and troubleshooting guide

### `idt-agent-macos-<version>.zip`
- `idt-agent` - macOS executable
- `chromedriver` - ChromeDriver for macOS
- `runner-core-selenium.js` - Automation script
- `node_modules/` - Runtime dependencies
- `README.txt` - Installation and troubleshooting guide

---

## Quality Assurance

### Automated Testing

Every build (CI and release) runs:

1. **Dependency Installation:** Clean install with `npm ci`
2. **Build Process:** pkg compilation with all dependencies
3. **File Verification:** Checks all required files are present
4. **Portability Test:** 
   - Moves build to temporary folder
   - Starts agent in isolated environment
   - Verifies `/health` endpoint responds
5. **Health Check:** Confirms agent starts and responds correctly

### Smoke Test Details

**Windows:**
- Extracts to `%TEMP%\idt-agent-portable-test`
- Starts agent on port 4799
- Verifies HTTP 200 response from `/health`
- Kills process after successful test

**macOS:**
- Extracts to `/tmp/idt-agent-portable-test`
- Makes binary executable
- Starts agent on port 4799
- Polls `/health` for 15 seconds
- Captures logs on failure for debugging

---

## Security & Trust

### Why Provenance Matters

Without provenance:
- Users can't verify downloads are genuine
- Supply chain attacks could inject malicious code
- No way to trace builds to source code

With provenance:
- **Cryptographic verification** of build authenticity
- **Tamper-proof** attestations signed by GitHub
- **Transparent** build process in public CI logs
- **Traceable** to exact source code commit

### Permissions

The release workflow uses minimal permissions:
- `contents: write` - Create releases and upload assets
- `id-token: write` - Sign provenance attestations
- `attestations: write` - Publish attestations

---

## Versioning Strategy

**Recommended:** Semantic Versioning (SemVer)

```
vMAJOR.MINOR.PATCH

v1.0.0 - Initial release
v1.0.1 - Bug fix (backward compatible)
v1.1.0 - New feature (backward compatible)
v2.0.0 - Breaking change
```

**Examples:**
- `v1.0.0` - First stable release
- `v1.0.1` - Fix ChromeDriver compatibility issue
- `v1.1.0` - Add support for new IDT parameters
- `v2.0.0` - Rewrite to use different automation library

---

## Troubleshooting

### Release Failed to Create

**Check:**
1. Tag format matches `v*.*.*` pattern
2. GitHub Actions has write permissions
3. No existing release with same tag

### Attestation Generation Failed

**Check:**
1. Repository settings allow attestation generation
2. Workflow has `id-token: write` permission
3. GitHub Actions is up to date

### Tests Failing

**Common issues:**
- ChromeDriver version mismatch
- Missing dependencies in `package.json`
- Port 4799 already in use (CI environment)

**Debug:**
- Check workflow logs for detailed error messages
- Look at smoke test output for specific failures
- Verify local build works: `npm run pkg:agent:win:with-chromedriver`

---

## Development Workflow

### Making Changes

1. Create feature branch: `git checkout -b feature/my-change`
2. Make changes to agent scripts
3. Test locally: `npm run agent`
4. Push branch: `git push origin feature/my-change`
5. Create PR → CI tests run automatically
6. Merge to `main` → CI builds and tests
7. Create release tag → Release workflow creates official release

### Local Testing

```bash
# Test agent locally
npm run agent

# Build locally (Windows)
npm run pkg:agent:win:with-chromedriver

# Build locally (macOS)
npm run pkg:agent:mac
node scripts/copy-chromedriver.js
node scripts/copy-runtime-deps.js
```

---

## Best Practices

### For Maintainers

1. **Always tag releases** - Don't manually create releases
2. **Test before tagging** - Ensure CI passes on main branch
3. **Write release notes** - Explain changes for users
4. **Verify attestations** - Download and verify your own releases
5. **Monitor dependencies** - Keep ChromeDriver updated with Chrome releases

### For Users

1. **Download from GitHub Releases** - Never use unofficial sources
2. **Verify attestations** - Use `gh attestation verify` before running
3. **Check release notes** - Understand what changed
4. **Report issues** - Use GitHub Issues for problems

---

## Links

- **Repository:** https://github.com/MMZaini/idt-react
- **Releases:** https://github.com/MMZaini/idt-react/releases
- **Actions:** https://github.com/MMZaini/idt-react/actions
- **SLSA Framework:** https://slsa.dev/
- **GitHub Attestations:** https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds

---

## Quick Reference

| Action | Command |
|--------|---------|
| Create release | `git tag v1.0.0 && git push origin v1.0.0` |
| Verify download | `gh attestation verify <file> -R MMZaini/idt-react` |
| Test locally | `npm run agent` |
| Build locally | `npm run pkg:agent:win:with-chromedriver` |
| View workflow runs | Visit GitHub Actions tab |
| Download release | Visit GitHub Releases page |

---

*Last updated: October 2025*
