#!/usr/bin/env node
/*
  Local agent HTTP bridge for the website (e.g., hosted on Vercel):
  - Listens on http://127.0.0.1:4599
  - POST /run { csv: string }
  - Launches puppeteer-core (via cli-runner logic) with the CSV
*/
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const PORT = process.env.IDT_AGENT_PORT ? Number(process.env.IDT_AGENT_PORT) : 4599;
// Load optional sidecar config (next to binary in packaged mode, or cwd in dev)
function loadConfig() {
  try {
    const base = process.pkg ? path.dirname(process.execPath) : process.cwd();
    const p = path.join(base, 'idt-agent.json');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}
const CFG = loadConfig();
const AGENT_VERSION = process.env.IDT_AGENT_VERSION || CFG.version || '0.1.0';
const UPDATE_MANIFEST_URL = process.env.IDT_AGENT_UPDATE_MANIFEST || CFG.updateManifest || '';

function send(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': data.length, 'Access-Control-Allow-Origin': '*' });
  res.end(data);
}

function runCsv(csv) {
  return new Promise((resolve) => {
    const b64 = Buffer.from(csv, 'utf8').toString('base64');
    const runner = path.join(process.cwd(), 'scripts', 'cli-runner.js');
    const child = spawn(process.execPath, [runner, b64], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));
    child.on('close', (code) => resolve({ code, out }));
  });
}

function openUrl(url) {
  const plat = process.platform;
  if (plat === 'win32') return spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  if (plat === 'darwin') return spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  return spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow simple redirect
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (d) => (data += d.toString()));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function checkForUpdate() {
  if (!UPDATE_MANIFEST_URL) return;
  try {
    const manifest = await fetchJson(UPDATE_MANIFEST_URL);
    const latest = manifest && manifest.version;
    if (!latest) return;
    if (String(latest).trim() !== String(AGENT_VERSION).trim()) {
      const plat = process.platform;
      const isWin = plat === 'win32';
      const url = isWin ? (manifest.win || manifest.windows || manifest.url) : (plat === 'darwin' ? (manifest.mac || manifest.macos || manifest.url) : (manifest.linux || manifest.url));
      if (url) {
        console.log(`[idt-agent] Update available ${AGENT_VERSION} -> ${latest}. Opening download: ${url}`);
        try { openUrl(url); } catch {}
      } else {
        console.log(`[idt-agent] Update available ${AGENT_VERSION} -> ${latest}. Visit project page to download.`);
      }
    }
  } catch (e) {
    // silent failure
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, version: AGENT_VERSION });
  }

  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const csv = typeof parsed.csv === 'string' ? parsed.csv : '';
        if (!csv) return send(res, 400, { ok: false, error: 'csv required' });
        const { code, out } = await runCsv(csv);
        return send(res, 200, { ok: code === 0, code, output: out });
      } catch (e) {
        return send(res, 500, { ok: false, error: String(e) });
      }
    });
    return;
  }

  send(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[idt-agent] listening on http://127.0.0.1:${PORT}`);
  checkForUpdate();
});
