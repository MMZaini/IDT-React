const path = require('path');
const fs = require('fs');
const os = require('os');

// Resolve modules explicitly from sidecar node_modules next to the exe (portable)
function getBaseModulePaths() {
  const bases = [];
  try {
    if (process.pkg) bases.push(path.join(path.dirname(process.execPath), 'node_modules'));
  } catch {}
  try { bases.push(path.join(process.cwd(), 'node_modules')); } catch {}
  try { bases.push(path.join(__dirname, 'node_modules')); } catch {}
  return bases;
}

function requireFromBases(spec) {
  const paths = getBaseModulePaths();
  try {
    const resolved = require.resolve(spec, { paths });
    return require(resolved);
  } catch (e) {
    // final fallback to normal require
    return require(spec);
  }
}

const { Builder, By, until } = requireFromBases('selenium-webdriver');
const chrome = requireFromBases('selenium-webdriver/chrome');

// Get persistent Chrome profile directory
function getPersistentProfileDir() {
  const homeDir = os.homedir();
  const profileDir = path.join(homeDir, '.idt-agent', 'chrome-profile');
  
  // Create directory if it doesn't exist
  try {
    fs.mkdirSync(profileDir, { recursive: true });
  } catch (err) {
    console.warn('Could not create profile directory:', err.message);
  }
  
  return profileDir;
}

// Discover possible runtime bases so the agent works when moved anywhere.
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

// Helper: prefer a chromedriver binary placed next to the exe or runner file; walk up parents; else fall back to npm package.
function getChromeServiceBuilder() {
  try {
    const bases = getRuntimeBases();
    const maxUp = 5;
    const rels = [];
    if (process.platform === 'win32') {
      rels.push('chromedriver.exe');
    } else {
      rels.push('chromedriver');
    }
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

// Try to bring Chrome to the foreground using OS-specific tools
function tryFocusChrome(log, titleHint) {
  try {
    const { spawn } = require('child_process');
    const plat = process.platform;
    if (plat === 'win32') {
      // Use WScript.Shell.AppActivate via PowerShell with more aggressive attempts
      const ps = `$sh = New-Object -ComObject WScript.Shell; 1..10 | ForEach-Object { Start-Sleep -Milliseconds 100; $null = $sh.AppActivate('${titleHint.replace(/'/g, "''")}') }`;
      spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { detached: true, stdio: 'ignore' }).unref();
      // Also try focusing by process name as backup
      const ps2 = `Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class WinFocus {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern IntPtr FindWindow(string className, string windowName);
        }
"@; $hwnd = [WinFocus]::FindWindow($null, '${titleHint.replace(/'/g, "''")}'); if ($hwnd) { [WinFocus]::SetForegroundWindow($hwnd) }`;
      setTimeout(() => {
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps2], { detached: true, stdio: 'ignore' }).unref();
      }, 300);
    } else if (plat === 'darwin') {
      // Ask Chrome to activate via AppleScript
      spawn('osascript', ['-e', 'tell application "Google Chrome" to activate'], { detached: true, stdio: 'ignore' }).unref();
    } else {
      // Linux: best-effort with wmctrl or xdotool if available
      // wmctrl -a can match by window title
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
      // Reduced wait time to 500ms for faster detection
      await driver.wait(until.elementLocated(By.xpath(xp)), 500);
      const btn = await driver.findElement(By.xpath(xp));
      await robustClick(driver, btn, log);
      log.log('Accepted cookies');
      return;
    } catch {
      // Element not found, try next XPath
    }
  }
  log.log('No cookie banner detected (likely already accepted)');
}

async function runSelenium({ csv, test }, log = createLogger()) {
  log.log(`CSV length: ${String(csv ? csv.length : 0)}`);

  // Get persistent profile directory
  const profileDir = getPersistentProfileDir();
  log.log(`Using Chrome profile: ${profileDir}`);

  let options = new chrome.Options();
  options = options.addArguments('--start-maximized');
  // These flags help ensure the window appears in the foreground
  options = options.addArguments('--new-window');
  options = options.addArguments('--force-app-mode');
  options = options.addArguments(`--user-data-dir=${profileDir}`);
  // Use a named profile to avoid "Default" profile conflicts
  options = options.addArguments('--profile-directory=IDT-Agent');

  let driver;
  try {
    log.log('Launching Chrome');
    const service = getChromeServiceBuilder();
    const builder = new Builder().forBrowser('chrome');
    if (service) builder.setChromeService(service);
    driver = await builder.setChromeOptions(options).build();
    log.log('Chrome ready');
    // Initial focus attempt (no title yet)
    tryFocusChrome(log, 'Google Chrome');
  } catch (err) {
    log.log('Failed to create driver', err && err.message);
    return { ok: false, output: log.output() };
  }
  try {
  await driver.get('https://eu.idtdna.com/site/order/oligoentry');
    // Set a unique title hint to help activation by title
    try { await driver.executeScript('document.title = "IDT Agent — Automation | " + (document.title || "")'); } catch {}
    // Multiple focus attempts with delays
    tryFocusChrome(log, 'IDT Agent — Automation');
    await driver.sleep(300);
    tryFocusChrome(log, 'IDT Agent — Automation');
    // JavaScript window focus as additional measure
    try { await driver.executeScript('window.focus();'); } catch {}
    await acceptCookiesIfPresent(driver, log);

    if (test) {
      await driver.sleep(3000);
      return { ok: true, output: log.output() };
    }

    // Bulk input button
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button')), 10000);
  const bulkBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[5]/div/div[1]/div[1]/div/div[3]/button'));
    await robustClick(driver, bulkBtn, log);
  log.log('Selected bulk input');
    await driver.sleep(600);

    // Delimiter dropdown
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select')), 10000);
    const delim = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[3]/div[1]/select'));
    await robustClick(driver, delim, log);
    try { const opt = await delim.findElement(By.css('option:nth-child(2)')); await robustClick(driver, opt, log); }
    catch { await delim.sendKeys(','); }
  log.log('Set delimiter to comma');
    await driver.sleep(300);

    // Bulk textarea
    await driver.wait(until.elementLocated(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea')), 10000);
    const ta = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[2]/div[4]/div[1]/div[1]/textarea'));
    await ta.clear();
    await ta.sendKeys(csv);
  log.log('Entered CSV lines');
    await driver.sleep(300);

    // Update
    const updateBtn = await driver.findElement(By.xpath('/html/body/div[3]/div[3]/div[3]/div/div[7]/div/div/div[3]/div/div[1]/button'));
    await robustClick(driver, updateBtn, log);
  log.log('Updated lines');
    await driver.sleep(1000);

    // Add to cart
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
}

module.exports = { runSelenium };
