# Auto-Release System

## How It Works

The agent automatically releases on every push to `main` that changes agent-related files.

### Auto-Release Triggers

Releases are created automatically when you push changes to:
- `scripts/local-agent.js`
- `scripts/runner-core-selenium.js`
- `scripts/copy-chromedriver.js`
- `scripts/copy-runtime-deps.js`
- `scripts/generate-dist-readme.js`
- `package.json`
- `package-lock.json`

### Versioning Strategy

**Auto-releases (from main branch):**
- Format: `v{package.json version}-{commit-sha}`
- Example: `v0.1.0-a3b5c7d`
- Marked as **pre-release** on GitHub
- Updated on every relevant push

**Stable releases (from git tags):**
- Format: `v{major}.{minor}.{patch}`
- Example: `v1.0.0`
- Marked as **stable release**
- Created manually via git tags

### Workflow

```
Push to main → Auto-build → Auto-release (pre-release)
              ↓
         Tests pass
              ↓
    Ready for users to test
              ↓
    When stable, tag it
              ↓
    Git tag → Build → Stable release
```

## Usage

### For Development (Automatic)

Just push your changes:

```bash
git add .
git commit -m "fix: improve ChromeDriver detection"
git push origin main
```

Result:
- Automatic build in ~3-5 minutes
- Pre-release created: `v0.1.0-a3b5c7d`
- Users can test the latest version
- Provenance attestations included

### For Stable Release (Manual)

When ready for a stable version:

```bash
# Update version in package.json first
npm version patch  # or minor, or major

# Push the version bump
git push origin main

# Wait for auto-release to complete and test it

# Create stable release tag
git tag v1.0.1
git push origin v1.0.1
```

Result:
- Stable release created: `v1.0.1`
- NOT marked as pre-release
- Recommended for end users

## Release Notes Format

All releases now use a concise, agent-focused format:

```markdown
## IDT Local Agent

Desktop automation agent for bulk DNA oligonucleotide ordering...

### 📦 Download & Install
1. Download ZIP for your OS
2. Extract to any folder
3. Run the agent
4. Use the web UI

### 🔒 Verify Download
gh attestation verify ...

### ⚙️ How It Works
- Listens for orders
- Automates browser
- Fills IDT forms
- Adds to cart

### 📋 Requirements
- Chrome browser
- Windows 10+ or macOS 10.15+
```

Clean, focused, no fluff.

## Benefits

### For Developers
✅ No manual release process  
✅ Every change automatically available  
✅ Easy to test latest builds  
✅ Still can create stable tags when ready  

### For Users
✅ Can test cutting-edge features  
✅ Clear distinction: pre-release vs stable  
✅ Same provenance verification  
✅ Concise release notes  

## Example Workflow

**Day 1:** Fix ChromeDriver bug
```bash
git commit -m "fix: ChromeDriver version detection"
git push
# Auto-release: v0.1.0-f5a3b2c (pre-release)
```

**Day 2:** Add new feature
```bash
git commit -m "feat: support custom port"
git push
# Auto-release: v0.1.0-d7e9a4f (pre-release)
```

**Day 3:** Ready for stable
```bash
npm version minor  # v0.1.0 → v0.2.0
git push
# Auto-release: v0.2.0-c3f8b1a (pre-release)

# Test it, looks good!
git tag v0.2.0
git push origin v0.2.0
# Stable release: v0.2.0 (recommended)
```

## GitHub UI

**Pre-releases:**
- Labeled "Pre-release" 🟡
- Collapsed by default
- For testing/development

**Stable releases:**
- Labeled "Latest" 🟢
- Shown prominently
- For production use

## Disabling Auto-Release

If you want to disable auto-releases temporarily:

```yaml
# In .github/workflows/release-agent.yml
# Comment out the push trigger:

# on:
#   push:
#     branches:
#       - main
#     paths:
#       - 'scripts/...'
```

## Summary

- **Push to main** → Auto pre-release
- **Git tag** → Stable release
- **Concise notes** → Easy to read
- **Provenance** → Always verified
- **No manual work** → Automated

Simple, efficient, professional. ✨
