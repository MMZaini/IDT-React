# Verifying Your Download

## Why Verify?

Verifying your download ensures that:
- ✅ The file is an official release from this repository
- ✅ The file hasn't been tampered with
- ✅ The build is traceable to the exact source code
- ✅ You're protected against supply chain attacks

## Quick Verification (Recommended)

### Step 1: Install GitHub CLI

**macOS:**
```bash
brew install gh
```

**Windows:**
```powershell
winget install GitHub.cli
```

**Linux:**
```bash
# See: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

### Step 2: Login to GitHub

```bash
gh auth login
```

Follow the prompts to authenticate.

### Step 3: Verify Your Download

Navigate to where you downloaded the file, then run:

**Windows:**
```bash
gh attestation verify idt-agent-windows-v1.0.0.zip -R MMZaini/idt-react
```

**macOS:**
```bash
gh attestation verify idt-agent-macos-v1.0.0.zip -R MMZaini/idt-react
```

### Step 4: Check the Output

**✅ Success looks like:**
```
✓ Verification succeeded!

sha256:abc123... was attested by:
REPO                PREDICATE_TYPE                  WORKFLOW
MMZaini/idt-react  https://slsa.dev/provenance/v1  .github/workflows/release-agent.yml@refs/tags/v1.0.0
```

**❌ Failure looks like:**
```
✗ Verification failed!
Error: no attestations found
```
**Do not use the file if verification fails!**

---

## What the Verification Proves

When verification succeeds, you can be confident that:

1. **Authenticity:** The file was built by the official GitHub Actions workflow
2. **Integrity:** The file hasn't been modified since it was built
3. **Traceability:** You can see exactly which commit and workflow built it
4. **Trust:** The build process is transparent and auditable

---

## Advanced: Manual Verification

If you prefer not to use GitHub CLI, you can manually verify using the attestation bundle:

1. Download both the `.zip` file and its `.build.jsonl` attestation file from the release
2. Use the SLSA verifier tool: https://github.com/slsa-framework/slsa-verifier

---

## Troubleshooting

### "gh: command not found"

Install GitHub CLI (see Step 1 above)

### "no attestations found"

This could mean:
- The file was not downloaded from an official release
- The file name doesn't match the release artifact
- The release was created before provenance was added

**Solution:** Re-download from the official GitHub Releases page

### "attestation verification failed"

This means the file has been modified or is not authentic.

**Do not use the file!** Download a fresh copy from the official releases.

---

## Need Help?

- **Issues:** https://github.com/MMZaini/idt-react/issues
- **Discussions:** https://github.com/MMZaini/idt-react/discussions
- **Security:** Report security issues privately via GitHub Security Advisories

---

## Learn More

- [GitHub Artifact Attestations](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds)
- [SLSA Framework](https://slsa.dev/)
- [Supply Chain Security Best Practices](https://slsa.dev/spec/v1.0/requirements)

---

*Your security is important. Always verify downloads from the internet.*
