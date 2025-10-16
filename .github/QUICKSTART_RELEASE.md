# 🚀 Quick Start: Create Your First Release

This guide will walk you through creating your first provenance-verified release.

## Prerequisites

1. All changes committed to `main` branch
2. GitHub repository has Actions enabled
3. You have push access to the repository
4. GitHub CLI installed (for verification): `brew install gh` or `winget install GitHub.cli`

## Step-by-Step

### 1️⃣ Decide on a Version

Use [Semantic Versioning](https://semver.org/):
- `v1.0.0` - First stable release
- `v0.1.0` - Beta/pre-release
- `v0.0.1` - Alpha/testing

For your first release, we recommend: **`v1.0.0`**

### 2️⃣ Create the Release

```bash
# Ensure you're on main and up-to-date
git checkout main
git pull origin main

# Create and push the tag
git tag v1.0.0
git push origin v1.0.0
```

### 3️⃣ Watch the Build

1. Go to: https://github.com/MMZaini/idt-react/actions
2. Click on the "Release Agent with Provenance" workflow run
3. Watch both build jobs (build-windows and build-macos)
4. Wait for all jobs to complete (usually 3-5 minutes)

**Expected progress:**
```
✓ build-windows
  ✓ Install dependencies
  ✓ Build agent exe
  ✓ Create ZIP
  ✓ Generate attestation  ← Provenance!
  ✓ Portability smoke test
  
✓ build-macos
  ✓ Install dependencies
  ✓ Build agent
  ✓ Create ZIP
  ✓ Generate attestation  ← Provenance!
  ✓ Portability smoke test

✓ create-release
  ✓ Download artifacts
  ✓ Generate release notes
  ✓ Create GitHub Release
```

### 4️⃣ Verify the Release

1. Go to: https://github.com/MMZaini/idt-react/releases
2. You should see "Release v1.0.0"
3. Check that both ZIP files are present:
   - `idt-agent-windows-v1.0.0.zip`
   - `idt-agent-macos-v1.0.0.zip`

### 5️⃣ Test Download & Verification

```bash
# Download the Windows release
cd ~/Downloads
gh release download v1.0.0 -R MMZaini/idt-react -p "idt-agent-windows-v1.0.0.zip"

# Verify it (THIS IS THE MAGIC! ✨)
gh attestation verify idt-agent-windows-v1.0.0.zip -R MMZaini/idt-react
```

**Expected output:**
```
✓ Verification succeeded!

sha256:abc123... was attested by:
REPO                PREDICATE_TYPE                  WORKFLOW
MMZaini/idt-react  https://slsa.dev/provenance/v1  .github/workflows/release-agent.yml@refs/tags/v1.0.0
```

✅ **Success!** Your release is cryptographically verified!

### 6️⃣ Test the Agent

```bash
# Extract the ZIP
unzip idt-agent-windows-v1.0.0.zip -d idt-agent-test
cd idt-agent-test

# Run the agent (Windows)
./idt-agent.exe

# Or on macOS
chmod +x ./idt-agent
./idt-agent

# In another terminal, test it
curl http://127.0.0.1:4599/health
```

**Expected response:**
```json
{"ok":true,"version":"...","platform":"win32"}
```

### 7️⃣ Update UI Download Links (Optional)

If you want the UI to link directly to this release:

Edit `src/app/order/page.tsx` around line 66:

```typescript
const downloadWin = process.env.NEXT_PUBLIC_AGENT_WIN_URL || 
  'https://github.com/MMZaini/idt-react/releases/download/v1.0.0/idt-agent-windows-v1.0.0.zip';

const downloadMac = process.env.NEXT_PUBLIC_AGENT_MAC_URL || 
  'https://github.com/MMZaini/idt-react/releases/download/v1.0.0/idt-agent-macos-v1.0.0.zip';
```

Or better yet, use `latest` URLs:
```typescript
const downloadWin = process.env.NEXT_PUBLIC_AGENT_WIN_URL || 
  'https://github.com/MMZaini/idt-react/releases/latest/download/idt-agent-windows-v1.0.0.zip';
```

Then commit and deploy the updated UI.

---

## 🎉 You're Done!

Your first provenance-verified release is live! Users can now:

1. Download from the Releases page
2. Verify authenticity with `gh attestation verify`
3. Trust that the build is genuine and untampered

---

## What to Do Next

### Announce the Release

Share on:
- Project README (add a badge)
- Social media / team channels
- Documentation site

### Add a Badge (Optional)

Add to your README.md:

```markdown
[![Latest Release](https://img.shields.io/github/v/release/MMZaini/idt-react)](https://github.com/MMZaini/idt-react/releases/latest)
[![Release Verification](https://img.shields.io/badge/provenance-verified-green)](https://github.com/MMZaini/idt-react/blob/main/.github/VERIFY_DOWNLOAD.md)
```

### Plan Next Release

When you need to release again:

```bash
# For bug fixes
git tag v1.0.1
git push origin v1.0.1

# For new features
git tag v1.1.0
git push origin v1.1.0

# For breaking changes
git tag v2.0.0
git push origin v2.0.0
```

---

## Troubleshooting First Release

### "Tag already exists"

```bash
# Delete local and remote tag
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Create again
git tag v1.0.0
git push origin v1.0.0
```

### "Workflow didn't trigger"

Check:
1. Tag format is `v*.*.*` (e.g., `v1.0.0`, not `1.0.0`)
2. Workflow file is on main branch
3. Actions are enabled in repository settings

### "Attestation verification failed"

Check:
1. You're logged in: `gh auth login`
2. Using correct repository: `-R MMZaini/idt-react`
3. Downloaded file matches release name exactly

### "Smoke test failed"

Check workflow logs for details. Common issues:
- ChromeDriver version mismatch
- Port 4799 already in use on runner
- Missing dependencies

---

## Need Help?

- 📖 [Full Release Process Documentation](.github/RELEASE_PROCESS.md)
- 🔒 [Verification Guide](.github/VERIFY_DOWNLOAD.md)
- ✅ [Implementation Checklist](.github/CHECKLIST.md)
- 🐛 [Open an Issue](https://github.com/MMZaini/idt-react/issues)

---

**Ready to create your first release?**

```bash
git tag v1.0.0 && git push origin v1.0.0
```

Then watch the magic happen! ✨
