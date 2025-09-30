#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function removeIfExists(p) {
  try {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      console.log(`[pkg-prune] removed ${p}`);
    }
  } catch (e) {
    console.warn(`[pkg-prune] failed to remove ${p}: ${e && e.message}`);
  }
}

const root = process.cwd();
const patterns = [
  path.join(root, 'node_modules', 'typed-query-selector', 'shim.d.ts'),
  path.join(root, 'node_modules', 'typed-query-selector', '**', '*.d.ts'),
];

// Minimal glob: expand only the known top-level file; ignore deep glob if not necessary
removeIfExists(patterns[0]);

// Optional: aggressively remove all .d.ts under typed-query-selector
try {
  const tqsDir = path.join(root, 'node_modules', 'typed-query-selector');
  if (fs.existsSync(tqsDir)) {
    const stack = [tqsDir];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(p);
        else if (entry.isFile() && p.endsWith('.d.ts')) removeIfExists(p);
      }
    }
  }
} catch {}

console.log('[pkg-prune] done');
