#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Copies a small set of node_modules into dist/node_modules so packaged exe can require them from disk.
// Adjust list below for modules needed at runtime by runner-core-selenium.

const modules = ['selenium-webdriver', 'chromedriver'];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
  return true;
}

function main() {
  const out = path.resolve(process.cwd(), 'dist', 'node_modules');
  if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
  const nm = path.resolve(process.cwd(), 'node_modules');
  for (const m of modules) {
    const src = path.join(nm, m);
    if (!fs.existsSync(src)) {
      console.error('[copy-runtime-deps] module not found in node_modules:', m);
      continue;
    }
    console.log('[copy-runtime-deps] copying', m, '->', out);
    copyDir(src, path.join(out, m));
  }

  // Also copy the runner core script next to the exe so the packaged binary can require it from disk
  try {
    const runnerSrc = path.resolve(process.cwd(), 'scripts', 'runner-core-selenium.js');
    const runnerDest = path.resolve(process.cwd(), 'dist', 'runner-core-selenium.js');
    if (fs.existsSync(runnerSrc)) {
      fs.copyFileSync(runnerSrc, runnerDest);
      console.log('[copy-runtime-deps] copied runner-core-selenium.js -> dist/');
    } else {
      console.error('[copy-runtime-deps] runner-core-selenium.js not found at', runnerSrc);
    }
  } catch (e) {
    console.error('[copy-runtime-deps] failed to copy runner-core-selenium.js:', e && e.message);
  }
}

main();
