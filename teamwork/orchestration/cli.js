#!/usr/bin/env node
// Shim for node teamwork/orchestration/cli.js — delegates to TS implementation via tsx
// This exists because prompts reference cli.js for `node teamwork/orchestration/cli.js`
// but source is cli.ts. This shim ensures both `node .../cli.js` and `npx tsx .../cli.ts` work.

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsCli = path.join(__dirname, 'cli.ts');

if (existsSync(tsCli)) {
  // Prefer tsx if available, else fallback to Node --experimental-strip-types (Node 22+)
  const hasTsx = (() => {
    try {
      const r = spawnSync('npx', ['tsx', '--version'], { stdio: 'ignore' });
      return r.status === 0;
    } catch { return false; }
  })();
  const args = process.argv.slice(2);
  let result;
  if (hasTsx) {
    result = spawnSync('npx', ['tsx', tsCli, ...args], { stdio: 'inherit' });
  } else {
    // Node 22+ supports --experimental-strip-types for TS
    result = spawnSync(process.execPath, ['--experimental-strip-types', tsCli, ...args], { stdio: 'inherit' });
  }
  process.exit(result.status ?? 0);
} else {
  console.error('cli.ts not found at', tsCli);
  process.exit(1);
}
