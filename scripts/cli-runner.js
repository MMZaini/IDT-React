#!/usr/bin/env node
/*
  Lightweight local runner using puppeteer-core.
  - No chromedriver required
  - Uses installed Edge or Chrome via executablePath
  - Accepts base64-encoded CSV as first argument

  Usage:
    node scripts/cli-runner.js <base64-csv>

  Packaging to a single .exe is supported via `pkg` using only puppeteer-core
  (it relies on the system's Edge/Chrome browser). See README for steps.
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-core');

function getCsvFromArg() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: idt-runner.exe <base64-csv | path-to-csv>');
    process.exit(2);
  }
  // If arg looks like a file path and exists, read it
  const possiblePath = path.resolve(process.cwd(), arg);
  if (fileExists(possiblePath)) {
    try {
      const content = fs.readFileSync(possiblePath, 'utf8');
      return content;
    } catch (e) {
      console.error('Failed to read CSV file:', e && e.message);
      process.exit(2);
    }
  }
  // else treat as base64
  try {
    return Buffer.from(arg, 'base64').toString('utf8');
  } catch (e) {
    console.error('Argument is neither an existing file nor valid base64');
    process.exit(2);
  }
}

function getModeFromArg() {
  const mode = (process.argv[3] || '').toLowerCase();
  return mode === 'test' ? 'test' : 'run';
}

function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function findWindowsChrome() {
  // Prefer Edge (present on all supported Windows versions), fallback to Chrome
  const guesses = [
    process.env['ProgramFiles'] && path.join(process.env['ProgramFiles'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['LOCALAPPDATA'] && path.join(process.env['LOCALAPPDATA'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  for (const g of guesses) {
    if (fileExists(g)) return g;
  }
  return null;
}

function findMacChrome() {
  const guesses = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
  ];
  for (const g of guesses) {
    if (fileExists(g)) return g;
  }
  return null;
}

function findLinuxChrome() {
  const guesses = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const g of guesses) {
    if (fileExists(g)) return g;
  }
  return null;
}

function findBrowserExecutable() {
  const plat = process.platform;
  const override = process.env.IDT_CHROME_PATH;
  if (override && fileExists(override)) return override;
  if (plat === 'win32') return findWindowsChrome();
  if (plat === 'darwin') return findMacChrome();
  return findLinuxChrome();
}

async function robustClick(page, handle) {
  try { await handle.evaluate(el => el.scrollIntoView({ block: 'center' })); } catch {}
  await handle.click({ delay: 10 }).catch(async () => {
    // Fallback to JS click
    try { await page.evaluate(el => el.click(), handle); } catch (e) { throw e; }
  });
}

async function tryClickXPath(page, xpaths) {
  for (const xp of xpaths) {
    try {
      await page.waitForXPath(xp, { timeout: 2000 });
      const [el] = await page.$x(xp);
      if (!el) continue;
      await robustClick(page, el);
      return true;
    } catch (e) {}
  }
  return false;
}

async function main() {
  const csv = getCsvFromArg();
  const mode = getModeFromArg();
  console.log('CSV length', csv.length);

  const exe = findBrowserExecutable();
  if (!exe) {
    console.error('Could not find Google Chrome on this system. Please install Google Chrome or set IDT_CHROME_PATH to the Chrome executable.');
    process.exit(3);
  }

  /** @type {import('puppeteer-core').LaunchOptions & import('puppeteer-core').BrowserLaunchArgumentOptions} */
  const launchOpts = {
    headless: false, // show browser to user
    executablePath: exe,
    defaultViewport: null,
    args: ['--start-maximized'],
  };

  let browser;
  try {
    console.log('Launching browser:', exe);
    browser = await puppeteer.launch(launchOpts);
    const [page] = await browser.pages();
    const p = page || await browser.newPage();

    await p.goto('https://eu.idtdna.com/site/order/oligoentry', { waitUntil: 'domcontentloaded' });

    if (mode === 'test') {
      const keepOpenMs = Number(process.env.IDT_KEEP_OPEN_MS || '4000');
      await p.waitForTimeout(Math.max(0, keepOpenMs));
      try { await browser.disconnect(); } catch {}
      process.exit(0);
      return;
    }

    // Try to accept cookies if present
    try {
      const cookieXPaths = [
        '//button[contains(., "Accept") or contains(., "agree") or contains(., "I agree")]',
        '/html/body/div[7]/div[2]/div/div/div[2]/div/div/button',
        '/html/body/div[6]/div[2]/div/div/div[2]/div/div/button',
      ];
      await tryClickXPath(p, cookieXPaths);
    } catch {}

    // Open bulk input
    await p.waitForTimeout(600);
    await p.waitForXPath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button', { timeout: 7000 });
    const [bulkBtn] = await p.$x('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button');
    await robustClick(p, bulkBtn);
    console.log('Clicked bulk input');
    await p.waitForTimeout(600);

    // Select comma delimiter
  await p.waitForXPath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select', { timeout: 10000 });
    const [delim] = await p.$x('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select');
    if (delim) {
      await delim.select(',').catch(async () => {
        // Fallback: set value via DOM
        try { await p.evaluate(el => { el.value = ','; el.dispatchEvent(new Event('change', { bubbles: true })); }, delim); } catch {}
      });
    }
    console.log('Selected comma delimiter');
    await p.waitForTimeout(300);

    // Enter CSV in textarea
  await p.waitForXPath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea', { timeout: 10000 });
    const [ta] = await p.$x('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea');
    await ta.click({ clickCount: 3 }).catch(() => {});
    await p.keyboard.press('Backspace').catch(() => {});
    await ta.type(csv, { delay: 0 });
    console.log('Entered CSV');
    await p.waitForTimeout(300);

    // Click update
    const [updateBtn] = await p.$x('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[3]/div/div[1]/button');
    await robustClick(p, updateBtn);
    console.log('Clicked update');
  await p.waitForTimeout(1500);

    // Click add to cart
    const [addBtn] = await p.$x('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[2]/div[1]/div[2]/div[3]/div/button[1]');
    await robustClick(p, addBtn);
    console.log('Clicked add to cart');

    // Wait for a few seconds to allow action to complete/visual confirmation
    const keepOpenMs = Number(process.env.IDT_KEEP_OPEN_MS || '6000');
    await p.waitForTimeout(Math.max(0, keepOpenMs));

    console.log('Done');
    // Disconnect so browser can remain open; then exit
    try { await browser.disconnect(); } catch {}
    process.exit(0);
  } catch (err) {
    console.error('Runner error:', err && err.message);
    process.exit(3);
  }
}

main();
