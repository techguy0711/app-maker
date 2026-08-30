#!/usr/bin/env node
/**
 * design-constraint.mjs — the project's ledger of layouts that don't work.
 *
 * Written only after a layout has failed visual validation three times and
 * the user has picked one of the two alternatives you offered. Read before
 * writing any layout code in this project.
 *
 * The point is not record-keeping. Without it, the next time the user asks
 * for something similar you will reach for the same failing pattern, burn
 * three more attempts, and hand them the same apology a second time — which
 * reads to a non-technical user as the tool being unreliable.
 *
 * Usage:
 *   design-constraint.mjs list [projectDir]
 *   design-constraint.mjs add [projectDir] \
 *     --file app/index.tsx --pattern "three cards side by side" \
 *     --checks overflow-right,small-tap-target \
 *     --styles '{"flexDirection":"row","gap":24}' \
 *     --chose "One card per row, full width" \
 *     [--instead-of "side-by-side columns at phone width"]
 */

import fs from 'node:fs';
import path from 'node:path';

const [, , cmd, ...rest] = process.argv;

// Walk the args so a flag's *value* is never mistaken for the project dir
// (`--pattern app/foo.tsx` would otherwise silently repoint the ledger).
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) i++;      // skip the flag and its value
  else positional.push(rest[i]);
}
const projectDir = path.resolve(positional[0] || process.cwd());
const arg = (n, d = null) => { const i = rest.indexOf('--' + n); return i === -1 ? d : rest[i + 1]; };

const LEDGER = path.join(projectDir, '.claude', 'design-constraints.json');

const EMPTY = {
  version: 1,
  note: 'Layout patterns that failed visual validation 3 times in this project. Never attempt these again here.',
  constraints: [],
};

function read() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { ...EMPTY }; }
}

function write(data) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(data, null, 2));
}

if (cmd === 'list') {
  const d = read();
  if (!d.constraints.length) { console.log('No design constraints recorded.'); process.exit(0); }
  for (const c of d.constraints) {
    console.log(`- [${c.id}] ${c.file}: avoid "${c.pattern}" (${(c.failedChecks || []).join(', ') || 'visual failure'})`);
    console.log(`      use instead: ${c.userChoice}`);
  }
  process.exit(0);
}

if (cmd !== 'add') {
  console.error('usage: design-constraint.mjs list|add [projectDir] [--file --pattern --checks --styles --chose]');
  process.exit(2);
}

const file = arg('file');
const pattern = arg('pattern');
const chose = arg('chose');
if (!file || !pattern || !chose) {
  console.error('design-constraint: --file, --pattern and --chose are all required');
  process.exit(2);
}

let styles = null;
try { styles = arg('styles') ? JSON.parse(arg('styles')) : null; } catch {
  console.error('design-constraint: --styles must be valid JSON');
  process.exit(2);
}

const data = read();

// Re-recording the same pattern for the same file would let the list grow
// without bound across a long session; update in place instead.
const key = `${file}::${pattern}`;
const existing = data.constraints.find(c => `${c.file}::${c.pattern}` === key);

const entry = {
  id: existing?.id || `c${data.constraints.length + 1}`,
  recordedAt: new Date().toISOString(),
  file,
  pattern,
  failedChecks: (arg('checks') || '').split(',').map(s => s.trim()).filter(Boolean),
  styles,
  insteadOf: arg('instead-of') || pattern,
  userChoice: chose,
  attempts: 3,
};

if (existing) Object.assign(existing, entry);
else data.constraints.push(entry);

write(data);
console.log(`design-constraint: recorded ${entry.id} for ${file} — avoid "${pattern}", use "${chose}"`);
