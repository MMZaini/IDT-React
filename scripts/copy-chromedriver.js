#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// This script tries to copy a chromedriver binary into the dist/ folder next to the packaged exe.
// Usage: node scripts/copy-chromedriver.js [sourcePath]
// If sourcePath is omitted, it will try to locate chromedriver under node_modules/chromedriver/lib/chromedriver

function findChromedriverInNodeModules() {
  try {
    const nm = path.resolve(__dirname, '..', 'node_modules', 'chromedriver', 'lib', 'chromedriver');
    const exe = process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
    const candidate = path.join(nm, exe);
    if (fs.existsSync(candidate)) return candidate;
  } catch (e) {}
  return null;
}

function main() {
  const outDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const arg = process.argv[2];
  let src = arg ? path.resolve(process.cwd(), arg) : null;
  if (!src || !fs.existsSync(src)) {
    src = findChromedriverInNodeModules();
  }
  if (!src || !fs.existsSync(src)) {
    console.error('[copy-chromedriver] No chromedriver binary found. Provide a path as an argument.');
    process.exit(2);
  }

  const dest = path.join(outDir, process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver');
  try {
    fs.copyFileSync(src, dest);
    try { fs.chmodSync(dest, 0o755); } catch (e) {}
    console.log('[copy-chromedriver] Copied', src, '->', dest);
    process.exit(0);
  } catch (e) {
    console.error('[copy-chromedriver] Failed to copy chromedriver:', e && e.message);
    process.exit(3);
  }
}

main();
