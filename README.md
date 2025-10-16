This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

IDT React — Automated, Improved DNA Oligonucleotide and Probes Ordering

A modern web application for bulk ordering DNA oligonucleotides and probes from Integrated DNA Technologies (IDT), with browser automation via a local agent.

### 🚀 Quick Start

**For Users:**
1. Download the latest agent for your OS from [Releases](https://github.com/MMZaini/idt-react/releases)
2. Verify your download (recommended): See [Verification Guide](.github/VERIFY_DOWNLOAD.md)
3. Extract and run the agent
4. Visit the web UI @ https://idt-react.vercel.app/ and start ordering!

**For Developers:**

First, install dependencies and run the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
- **Automation** (`scripts/runner-core-selenium.js`) - Selenium-based IDT website automation
gh attestation verify idt-agent-windows-v1.0.0.zip -R MMZaini/idt-react
```

Where to look next
- `src/app/` — Next.js app and UI
- `scripts/` — Local agent + packaging scripts (pkg, chromedriver copy, etc.)
- `.github/workflows/` — CI and release workflows
- `.github/VERIFY_DOWNLOAD.md` — Short user guide for verification (kept as reference)

If you need the long step-by-step release process or implementation notes they were consolidated into this README — the original `.github/*.md` files are removed to avoid duplication.

# Run agent locally for testing
npm run agent
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.