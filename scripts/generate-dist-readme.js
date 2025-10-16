#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const out = path.resolve(process.cwd(), 'dist', 'README.txt');
const txt = `IDT Agent - Automated DNA Oligonucleotide Ordering
====================================================

This folder contains the packaged idt-agent and supporting files.

FILES INCLUDED
--------------
- idt-agent.exe / idt-agent : Packaged agent executable
- chromedriver.exe / chromedriver : ChromeDriver binary for browser automation
- node_modules/           : Runtime dependencies (selenium-webdriver, tmp, jszip, ws, etc.)
- runner-core-selenium.js : Selenium automation runner script

HOW TO RUN
----------
1. Ensure Google Chrome is installed on your system
2. Run the agent:
   
   Windows:
     Double-click idt-agent.exe
     OR run in PowerShell/CMD: .\\idt-agent.exe
   
   macOS/Linux:
     Open Terminal and run: ./idt-agent
   
3. The agent will start and show: "listening on http://127.0.0.1:4599"
4. Open the IDT web UI in your browser and start submitting orders

TESTING THE AGENT
-----------------
You can test if the agent is running:
  curl http://127.0.0.1:4599/health

Expected response: {"ok":true,"version":"...","platform":"..."}

TROUBLESHOOTING
---------------
- ChromeDriver version mismatch: Ensure ChromeDriver matches your Chrome version
- Module not found errors: Keep all files in this folder together (don't move individual files)
- Windows security warning: Right-click chromedriver.exe → Properties → Check "Unblock"
- Port already in use: Set custom port with: IDT_AGENT_PORT=4600 ./idt-agent.exe
- macOS "unidentified developer": Right-click → Open, then confirm

BUILD PROVENANCE
----------------
Official releases include cryptographic attestations verifying the build integrity.
Verify downloaded releases using GitHub CLI:
  gh attestation verify <zip-file> -R MMZaini/idt-react

Learn more: https://github.com/MMZaini/idt-react

REQUIREMENTS
------------
- Google Chrome browser
- Windows 10+ or macOS 10.15+
- Network access to eu.idtdna.com

This README was generated automatically by the build pipeline.
For issues or questions: https://github.com/MMZaini/idt-react/issues
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, txt, 'utf8');
console.log('[generate-dist-readme] written', out);
