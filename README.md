This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

NOTE: This repository was trimmed to the frontend-only UI and its dependencies. Backend API routes, automation runners, and end-to-end tests were removed to keep a minimal frontend deliverable. If you need the automation/backend restored, let me know and I can re-add them.

## Deploying for end users (minimal installs)

You have two practical options:

1) Host the website anywhere, run automation locally per-user (recommended for “one quick exe”).
	- Host the Next.js site (Vercel/Netlify/Static export + any Node host). The website only collects lines and calls the API.
	- Give users a tiny Windows exe (built from `scripts/cli-runner.js`) that launches their installed Edge/Chrome and completes the IDT bulk entry.
	- Pros: No chromedriver to install, minimal downloads, works on any Windows machine with Edge or Chrome installed.

2) Host the website and automation together on a Windows VM/server.
	- Run Next.js API on a Windows machine with Chrome (or Edge) installed; the server runs the automation. Users need nothing locally.
	- Pros: Zero local setup for users; Cons: You maintain a Windows host with a desktop browser and UI automation in the backend.

### Build the one-file Windows runner (no chromedriver)

We include a `puppeteer-core`-based runner (`scripts/cli-runner.js`) that controls the system’s Edge/Chrome, avoiding chromedriver. Package it as a single exe with `pkg`:

```powershell
# From repo root
npm install
npm run pkg:win
# Output: dist/idt-runner.exe
```

Distribute `dist/idt-runner.exe` to users. It requires Edge or Chrome installed (no other downloads).

How it wires to the site: the API route `POST /api/run-selenium` now prefers `scripts/cli-runner.js` (the same logic the exe uses) and falls back to `scripts/selenium-runner.js` if needed.

### Hosting the website

Local development:
```powershell
npm run dev
```

Production build:
```powershell
npm run build
npm start
```

On Vercel/Netlify or any Node host, deploy as a standard Next.js app. For client-side only usage (no automation on the host), keep the API route disabled or return a message instructing users to run the EXE for automation.

### Cross-platform and update model

- Cross-platform: The runner and local agent use `puppeteer-core` and auto-detect Chrome/Edge on Windows, macOS, and Linux. Chrome is preferred if found.
- Local agent bridge: `scripts/local-agent.js` exposes `POST http://127.0.0.1:4599/run` so a Vercel-hosted site can trigger the local automation.
	- Start locally: `npm run agent`
	- Package for Windows: `npm run pkg:agent:win` -> `dist/idt-agent.exe`
	- Package for macOS: `npm run pkg:agent:mac` -> `dist/idt-agent`
	- The website can call the local agent with `fetch('http://127.0.0.1:4599/run', { method: 'POST', body: JSON.stringify({ csv }) })`.
- Updates: Host the website on Vercel (instant updates). The local agent/runner can be updated less frequently. For zero-install updates you can:
	- Keep the agent tiny and stable; most changes ship via the website.
	- Add an auto-updater to the agent (download new binary if version mismatch) if needed.

### Alternative: Agent hosts the UI

If you prefer one binary with everything, package a small server that serves the built Next.js UI and runs automation on the same machine. This avoids Vercel but requires distributing a larger binary and updating it per change.

### Server-side automation (optional)

If you want the server to perform the browser automation (no EXE for users):
- Use a Windows VM (Azure/AWS/GCP/On-prem) with Edge/Chrome installed.
- Keep `scripts/cli-runner.js` as the backend runner. The Next.js API will spawn it directly.
- Ensure the VM runs the app under a user session (desktop available) because UI automation in headful mode requires it.

### Notes

- The runner targets `https://eu.idtdna.com/site/order/oligoentry`. Switch to your region if needed.
- The runner uses absolute XPaths and may need updates if IDT changes their markup.
- Add login steps if your use-case requires authenticated ordering.
