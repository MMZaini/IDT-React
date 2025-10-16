This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## IDT Orderer - Automated DNA Oligonucleotide Ordering

A modern web application for bulk ordering DNA oligonucleotides from Integrated DNA Technologies (IDT), with browser automation via a local agent.

### 🚀 Quick Start

**For Users:**
1. Download the latest agent for your OS from [Releases](https://github.com/MMZaini/idt-react/releases)
2. Verify your download (recommended): See [Verification Guide](.github/VERIFY_DOWNLOAD.md)
3. Extract and run the agent
4. Visit the web UI and start ordering!

**For Developers:**

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### 🔒 Build Provenance

All official releases include cryptographic attestations to verify authenticity. Learn how to verify your downloads in our [Verification Guide](.github/VERIFY_DOWNLOAD.md).

```bash
# Verify a download
gh attestation verify idt-agent-windows-v1.0.0.zip -R MMZaini/idt-react
```

### 📦 Project Structure

- **Web UI** (`src/app/`) - Next.js React application for creating orders
- **Local Agent** (`scripts/local-agent.js`) - Desktop app that automates browser interaction
- **Automation** (`scripts/runner-core-selenium.js`) - Selenium-based IDT website automation

### 🛠️ Building the Agent

```bash
# Build Windows agent
npm run pkg:agent:win:with-chromedriver

# Build macOS agent  
npm run pkg:agent:mac
node scripts/copy-chromedriver.js
node scripts/copy-runtime-deps.js

# Run agent locally for testing
npm run agent
```

### 📖 Documentation

- [Release Process](.github/RELEASE_PROCESS.md) - How releases and CI/CD work
- [Verify Downloads](.github/VERIFY_DOWNLOAD.md) - How to verify release authenticity

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.