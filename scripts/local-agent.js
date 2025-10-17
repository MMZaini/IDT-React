#!/usr/bin/env node
/*
  Local agent HTTP bridge for the website (e.g., hosted on Vercel):
  - Listens on http://127.0.0.1:4599
  - POST /run { csv: string }
  - Uses in-process Selenium (chromedriver) to launch Chrome and run the automation
*/
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const DEBUG = String(process.env.IDT_AGENT_DEBUG || '').toLowerCase() === '1' || String(process.env.IDT_AGENT_DEBUG || '').toLowerCase() === 'true';
let lastRunnerErrors = { disk: null, snapshot: null };
let runSeleniumCore;
// Helper base path: when packaged, prefer the directory next to the exe; otherwise use this file's dirname
const realBase = process.pkg ? path.dirname(process.execPath) : __dirname;

// In packaged mode, set CWD to the exe folder to make all relative lookups portable
try { if (process.pkg) process.chdir(realBase); } catch {}

// Prime Node's module resolution to include sidecar node_modules next to the exe
function primeModulePaths() {
  try {
    const nm = path.join(realBase, 'node_modules');
    if (DEBUG) console.log('[idt-agent][debug] primeModulePaths: realBase=', realBase, 'node_modules exists=', fs.existsSync(nm));
    try {
      const Module = require('module');
      if (Module && Array.isArray(Module.globalPaths)) {
        if (!Module.globalPaths.includes(nm)) Module.globalPaths.unshift(nm);
        process.env.NODE_PATH = [nm, process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
        if (typeof Module._initPaths === 'function') Module._initPaths();
      }
    } catch {}
    if (!module.paths.includes(nm)) module.paths.unshift(nm);
  } catch {}
}
if (process.pkg) primeModulePaths();

// Ensure chromedriver sidecar exists next to the exe by self-extracting from pkg snapshot (if bundled as an asset)
function ensureChromedriverSidecar() {
  if (!process.pkg) return;
  try {
    const isWin = process.platform === 'win32';
    const binName = isWin ? 'chromedriver.exe' : 'chromedriver';
    const dest = path.join(realBase, binName);
    if (fs.existsSync(dest)) return; // already present

    // Asset location inside snapshot relative to this script
    const assetDir = path.resolve(__dirname, '..', 'node_modules', 'chromedriver', 'lib', 'chromedriver');
    const assetPath = path.join(assetDir, binName);
    const data = fs.readFileSync(assetPath); // will succeed only if asset was bundled
    fs.writeFileSync(dest, data);
    if (!isWin) {
      try { fs.chmodSync(dest, 0o755); } catch {}
    }
  } catch {}
}

// Generic snapshot -> disk extraction helpers (to keep the agent portable when moved)
function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}
function copyFileFromSnapshot(src, dest) {
  try {
    const data = fs.readFileSync(src);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, data);
    return true;
  } catch { return false; }
}
function copyDirFromSnapshot(srcDir, destDir) {
  try {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    ensureDir(destDir);
    for (const e of entries) {
      const s = path.join(srcDir, e.name);
      const d = path.join(destDir, e.name);
      if (e.isDirectory()) copyDirFromSnapshot(s, d);
      else copyFileFromSnapshot(s, d);
    }
    return true;
  } catch { return false; }
}

function ensureRuntimeSidecars() {
  if (!process.pkg) return;
  // runner-core-selenium.js next to exe
  try {
    const runnerSrc = path.resolve(__dirname, 'runner-core-selenium.js');
    const runnerDest = path.join(realBase, 'runner-core-selenium.js');
    if (!fs.existsSync(runnerDest)) {
      copyFileFromSnapshot(runnerSrc, runnerDest);
    }
  } catch {}
  // selenium-webdriver module (JS only)
  try {
    const swdSrc = path.resolve(__dirname, '..', 'node_modules', 'selenium-webdriver');
    const swdDest = path.join(realBase, 'node_modules', 'selenium-webdriver');
    const swdIndex = path.join(swdDest, 'index.js');
    const swdLib = path.join(swdDest, 'lib');
    if (!fs.existsSync(swdDest) || !fs.existsSync(swdIndex) || !fs.existsSync(swdLib)) {
      copyDirFromSnapshot(swdSrc, swdDest);
    }
  } catch {}
  // chromedriver binary (extracted separately)
  ensureChromedriverSidecar();
}

// Extract sidecars before requiring the runner so disk fallback always works
if (process.pkg) ensureRuntimeSidecars();
if (process.pkg) primeModulePaths();

function attemptLoadRunner() {
  try {
    const diskRunnerJs = path.join(realBase, 'runner-core-selenium.js');
    if (DEBUG) console.log('[idt-agent][debug] attemptLoadRunner: disk path:', diskRunnerJs, 'exists=', fs.existsSync(diskRunnerJs));
    if (process.pkg) primeModulePaths();
    runSeleniumCore = require(diskRunnerJs).runSelenium;
    if (DEBUG) console.log('[idt-agent][debug] attemptLoadRunner: loaded from disk');
    lastRunnerErrors = { disk: null, snapshot: null };
    return true;
  } catch (e) {
    lastRunnerErrors.disk = e && (e.stack || e.message || String(e));
    if (DEBUG) console.log('[idt-agent][debug] attemptLoadRunner: disk load failed:', e && e.message);
    try {
      runSeleniumCore = require('./runner-core-selenium').runSelenium;
      if (DEBUG) console.log('[idt-agent][debug] attemptLoadRunner: loaded from snapshot');
      lastRunnerErrors.snapshot = null;
      return true;
    } catch (e2) {
      lastRunnerErrors.snapshot = e2 && (e2.stack || e2.message || String(e2));
      if (DEBUG) {
        console.log('[idt-agent][debug] attemptLoadRunner: snapshot load failed:', e2 && e2.message);
        // Print quick fs check to aid diagnosis
        try {
          const nmSwd = path.join(realBase, 'node_modules', 'selenium-webdriver');
          console.log('[idt-agent][debug] fs check:', {
            realBase,
            runnerDiskExists: fs.existsSync(path.join(realBase, 'runner-core-selenium.js')),
            nmSwdExists: fs.existsSync(nmSwd),
            chromedriverDiskExists: fs.existsSync(path.join(realBase, process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver')),
          });
        } catch {}
      }
      runSeleniumCore = null;
      return false;
    }
  }
}

// Now load the core runner: prefer disk next to exe (works regardless of folder), fallback to snapshot
attemptLoadRunner();

// Final safety fallback: if runner could not be loaded, define an internal implementation
if (!runSeleniumCore) {
  try {
    if (DEBUG) console.log('[idt-agent][debug] using internal runner fallback');
    function requireFromBases(spec) {
      try {
        const bases = [];
        try { if (process.pkg) bases.push(path.join(path.dirname(process.execPath), 'node_modules')); } catch {}
        try { bases.push(path.join(process.cwd(), 'node_modules')); } catch {}
        try { bases.push(path.join(__dirname, 'node_modules')); } catch {}
        const resolved = require.resolve(spec, { paths: bases });
        return require(resolved);
      } catch (e) {
        return require(spec);
      }
    }
    const { Builder, By, until } = requireFromBases('selenium-webdriver');
    const chrome = requireFromBases('selenium-webdriver/chrome');
  const { spawn } = require('child_process');

    function getRuntimeBases() {
      const bases = new Set();
      if (process.env.IDT_AGENT_BASE) {
        try { bases.add(path.resolve(process.env.IDT_AGENT_BASE)); } catch {}
      }
      try { if (process.pkg) bases.add(path.dirname(process.execPath)); } catch {}
      try { if (require.main && require.main.filename) bases.add(path.dirname(require.main.filename)); } catch {}
      try { bases.add(process.cwd()); } catch {}
      bases.add(__dirname);
      return Array.from(bases);
    }

    function getChromeServiceBuilder() {
      try {
        const bases = getRuntimeBases();
        const maxUp = 5;
        const rels = [];
        if (process.platform === 'win32') rels.push('chromedriver.exe'); else rels.push('chromedriver');
        rels.push(path.join('node_modules', 'chromedriver', 'lib', 'chromedriver'));
        if (process.platform === 'win32') rels.push(path.join('node_modules', 'chromedriver', 'lib', 'chromedriver.exe'));
        for (const base of bases) {
          for (let up = 0; up <= maxUp; up++) {
            const prefix = up === 0 ? base : path.resolve(base, ...Array(up).fill('..'));
            for (const r of rels) {
              const candidate = path.join(prefix, r);
              try { if (fs.existsSync(candidate)) return new chrome.ServiceBuilder(candidate); } catch {}
            }
          }
        }
      } catch {}
      try { requireFromBases('chromedriver'); return new chrome.ServiceBuilder(); } catch {}
      return null;
    }

    function createLogger() {
      const lines = [];
      return {
        log: (...args) => { const s = args.map(a => String(a)).join(' '); lines.push(s); },
        output: () => lines.join('\n')
      };
    }

    function tryFocusChrome(log, titleHint) {
      try {
        const plat = process.platform;
        if (plat === 'win32') {
          const ps = `$sh = New-Object -ComObject WScript.Shell; 1..5 | ForEach-Object { Start-Sleep -Milliseconds 200; $null = $sh.AppActivate('${titleHint.replace(/'/g, "''")}') }`;
          spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { detached: true, stdio: 'ignore' }).unref();
        } else if (plat === 'darwin') {
          spawn('osascript', ['-e', 'tell application "Google Chrome" to activate'], { detached: true, stdio: 'ignore' }).unref();
        } else {
          const wmctrl = spawn('wmctrl', ['-a', titleHint], { detached: true, stdio: 'ignore' });
          wmctrl.on('error', () => {
            const xdotool = spawn('xdotool', ['search', '--name', titleHint, 'windowactivate'], { detached: true, stdio: 'ignore' });
            xdotool.unref();
          });
          wmctrl.unref();
        }
        log && log.log('Focus attempt issued');
      } catch {}
    }

    async function robustClick(driver, el, log) {
      try { await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', el); } catch {}
      try { await driver.wait(until.elementIsVisible(el), 5000); } catch {}
      try {
        await driver.wait(async () => {
          try { return await el.isEnabled(); } catch { return false; }
        }, 5000);
      } catch {}
      try { await el.click(); }
      catch (e) {
        try { await driver.executeScript('arguments[0].click()', el); }
        catch (err) { throw err; }
      }
    }

    async function acceptCookiesIfPresent(driver, log) {
      const cookieXPaths = [
        '/html/body/div[7]/div[2]/div/div/div[2]/div/div/button',
        '/html/body/div[6]/div[2]/div/div/div[2]/div/div/button',
        "//button[contains(., 'Accept') or contains(., 'accept') or contains(., 'Agree') or contains(., 'I agree')]",
      ];
      for (const xp of cookieXPaths) {
        try {
          await driver.wait(until.elementLocated(By.xpath(xp)), 2000);
          const btn = await driver.findElement(By.xpath(xp));
          await robustClick(driver, btn, log);
          log.log('Accepted cookies');
          return;
        } catch {}
      }
    }

    runSeleniumCore = async function runSelenium({ csv, test }, log = createLogger()) {
      log.log(`CSV length: ${String(csv ? csv.length : 0)}`);
      let options = new chrome.Options();
      options = options.addArguments('--start-maximized');
      let driver;
      try {
        log.log('Launching Chrome');
        const service = getChromeServiceBuilder();
        const builder = new Builder().forBrowser('chrome');
        if (service) builder.setChromeService(service);
        driver = await builder.setChromeOptions(options).build();
        log.log('Chrome ready');
        tryFocusChrome(log, 'Google Chrome');
      } catch (err) {
        log.log('Failed to create driver', err && err.message);
        return { ok: false, output: log.output() };
      }
      try {
  await driver.get('https://eu.idtdna.com/site/order/oligoentry');
  try { await driver.executeScript('document.title = "IDT Agent — Automation | " + (document.title || "")'); } catch {}
  tryFocusChrome(log, 'IDT Agent — Automation');
        await acceptCookiesIfPresent(driver, log);
        if (test) {
          await driver.sleep(3000);
          return { ok: true, output: log.output() };
        }
        await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button')), 10000);
        const bulkBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button'));
        await robustClick(driver, bulkBtn, log);
        log.log('Selected bulk input');
        await driver.sleep(600);
        await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select')), 10000);
        const delim = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select'));
        await robustClick(driver, delim, log);
        try { const opt = await delim.findElement(By.css('option:nth-child(2)')); await robustClick(driver, opt, log); }
        catch { await delim.sendKeys(','); }
        log.log('Set delimiter to comma');
        await driver.sleep(300);
        await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea')), 10000);
        const ta = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea'));
        await ta.clear();
        await ta.sendKeys(csv);
        log.log('Entered CSV lines');
        await driver.sleep(300);
        const updateBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[3]/div/div[1]/button'));
        await robustClick(driver, updateBtn, log);
        log.log('Updated lines');
        await driver.sleep(1000);
        const addBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[2]/div[1]/div[2]/div[3]/div/button[1]'));
        await robustClick(driver, addBtn, log);
        log.log('Added to cart');
        await driver.sleep(Number(process.env.IDT_KEEP_OPEN_MS || '4000'));
        log.log('Automation complete');
        return { ok: true, output: log.output() };
      } catch (err) {
        log.log(`Error: ${err && err.message}`);
        return { ok: false, output: log.output() };
      } finally {
        // leave window open by not calling driver.quit();
      }
    };
  } catch (e) {
    if (DEBUG) console.log('[idt-agent][debug] internal runner fallback init failed:', e && e.message);
  }
}

const PORT = process.env.IDT_AGENT_PORT ? Number(process.env.IDT_AGENT_PORT) : 4599;
// Load optional sidecar config (next to binary in packaged mode, or cwd in dev)
function loadConfig() {
  try {
    const base = process.env.IDT_AGENT_BASE
      ? path.resolve(process.env.IDT_AGENT_BASE)
      : (process.pkg ? path.dirname(process.execPath) : process.cwd());
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

async function runCsv(csv) {
  // Always prefer in-process core; do not fallback to legacy runner path
  if (runSeleniumCore) {
    try {
      const res = await runSeleniumCore({ csv, test: false });
      return { code: res.ok ? 0 : 1, out: res.output || '' };
    } catch (e) {
      return { code: 1, out: String(e && e.message || e) };
    }
  }
  return { code: 1, out: '[agent] Core runner missing. Please update the agent to a version that bundles runner-core-selenium.' };
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
    return send(res, 200, { ok: true, version: AGENT_VERSION, platform: process.platform, haveCore: !!runSeleniumCore });
  }

  if (req.method === 'POST' && req.url === '/test') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const csv = 'NAME,SEQUENCE,SCALE,PURIFICATION';
        if (!runSeleniumCore) {
          if (process.pkg) ensureRuntimeSidecars();
          attemptLoadRunner();
        }
        if (!runSeleniumCore) {
          const diag = {
            realBase,
            cwd: process.cwd(),
            runnerDiskPath: path.join(realBase, 'runner-core-selenium.js'),
            runnerDiskExists: fs.existsSync(path.join(realBase, 'runner-core-selenium.js')),
            nmSwdExists: fs.existsSync(path.join(realBase, 'node_modules', 'selenium-webdriver')),
            chromedriverDiskExists: fs.existsSync(path.join(realBase, process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver')),
            lastRunnerErrors
          };
          return send(res, 500, { ok: false, error: 'Core runner missing. Update agent.', diag });
        }
        const result = await runSeleniumCore({ csv, test: true });
        return send(res, 200, { ok: !!result.ok, code: result.ok ? 0 : 1, output: result.output || '' });
      } catch (e) {
        return send(res, 500, { ok: false, error: String(e && e.message || e) });
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/test') {
    try {
      const csv = 'NAME,SEQUENCE,SCALE,PURIFICATION';
      if (!runSeleniumCore) {
        if (process.pkg) ensureRuntimeSidecars();
        attemptLoadRunner();
      }
      if (!runSeleniumCore) {
        const diag = {
          realBase,
          cwd: process.cwd(),
          runnerDiskPath: path.join(realBase, 'runner-core-selenium.js'),
          runnerDiskExists: fs.existsSync(path.join(realBase, 'runner-core-selenium.js')),
          nmSwdExists: fs.existsSync(path.join(realBase, 'node_modules', 'selenium-webdriver')),
          chromedriverDiskExists: fs.existsSync(path.join(realBase, process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver')),
          lastRunnerErrors
        };
        return send(res, 500, { ok: false, error: 'Core runner missing. Update agent.', diag });
      }
      const result = await runSeleniumCore({ csv, test: true });
      return send(res, 200, { ok: !!result.ok, code: result.ok ? 0 : 1, output: result.output || '' });
    } catch (e) {
      return send(res, 500, { ok: false, error: String(e && e.message || e) });
    }
    return;
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
        return send(res, 500, { ok: false, error: String(e && e.message || e) });
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
