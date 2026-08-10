#!/usr/bin/env node
/**
 * collect-visual-result.mjs — turn a Vitest run into one agent-readable file.
 *
 * Called only by ui-validate.sh. Two modes:
 *
 *   --seed-check          exit 0 if every failure is "no reference screenshot
 *                         existed yet" (baselines were just created), 1 if any
 *                         failure is a genuine defect. Lets the caller tell
 *                         "first run on a new screen" apart from "broken
 *                         layout" without spending an attempt on it.
 *
 *   --rc N --seeded 0|1   write .claude/visual/last-run.json and update the
 *                         attempt counter.
 *
 * The attempt counter keys on a *signature* of what failed, not just a count.
 * Fixing one problem and uncovering a different one starts a fresh budget
 * instead of inheriting an exhausted one — otherwise a screen with two
 * unrelated issues would be declared impossible after fixing the first.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const projectDir = path.resolve(process.argv[2] || process.cwd());
const argv = process.argv.slice(3);
const flag = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const seedCheck = argv.includes('--seed-check');
const rc = Number(flag('--rc', '1'));
const seeded = flag('--seeded', '0') === '1';

const VIS = path.join(projectDir, '.claude', 'visual');
const REPORT = path.join(VIS, '.vitest-report.json');
const RESULT = path.join(VIS, 'last-run.json');
const COUNTER = path.join(VIS, 'attempts.json');
const BUDGET = 3;

// --- read the run -----------------------------------------------------------
let report = null;
try { report = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* handled below */ }

// Vitest colourises failure messages even through the JSON reporter, so a
// naive path capture picks up the trailing reset sequence and yields a
// filename that doesn't exist ("…-diff.png[22m"). Strip first, parse after.
const ANSI = /\[[0-9;]*m/g;

/** Every failure message across every test, with the test it came from. */
function failureMessages() {
  const out = [];
  for (const file of report?.testResults ?? []) {
    for (const a of file.assertionResults ?? []) {
      if (a.status !== 'failed') continue;
      for (const m of a.failureMessages ?? []) {
        out.push({
          title: String(a.title || a.fullName || file.name).replace(ANSI, ''),
          message: String(m).replace(ANSI, ''),
        });
      }
    }
  }
  return out;
}

const RE_NO_REF = /No existing reference screenshot found/i;
const RE_MISMATCH = /Screenshot does not match the stored reference\.\s*([\s\S]*?)differ\./i;
const RE_LAYOUT = /LAYOUT_VIOLATIONS in ([^\s(]+)/;
const RE_LAYOUT_JSON = /JSON:\s*(\[[\s\S]*?\])\s*$/m;
const pathAfter = (msg, label) => {
  const m = new RegExp(label + ':\\s*\\n\\s*(\\S+)', 'i').exec(msg);
  return m ? m[1] : null;
};

const msgs = failureMessages();

// --- mode: seed check -------------------------------------------------------
if (seedCheck) {
  const anyFailure = msgs.length > 0;
  const allSeeding = anyFailure && msgs.every(m => RE_NO_REF.test(m.message));
  process.exit(allSeeding ? 0 : 1);
}

// --- classify ---------------------------------------------------------------
const failures = [];
const images = [];

for (const { title, message } of msgs) {
  if (RE_NO_REF.test(message)) continue; // already handled by the seed pass

  const layout = RE_LAYOUT.exec(message);
  if (layout) {
    let violations = [];
    const j = RE_LAYOUT_JSON.exec(message);
    if (j) { try { violations = JSON.parse(j[1]); } catch { /* keep the text */ } }
    failures.push({
      kind: 'layout',
      screen: title,
      file: layout[1],
      violations,
      // Fallback so the agent still has something actionable if the JSON
      // tail was truncated by a reporter.
      raw: violations.length ? undefined : message.split('\n').slice(0, 12).join('\n'),
    });
    continue;
  }

  const mismatch = RE_MISMATCH.exec(message);
  if (mismatch || /toMatchScreenshot/.test(message)) {
    const diff = pathAfter(message, 'Diff image');
    const actual = pathAfter(message, 'Actual screenshot');
    const reference = pathAfter(message, 'Reference screenshot');
    for (const p of [diff, actual, reference]) if (p) images.push(p);
    failures.push({
      kind: 'screenshot',
      screen: title,
      amount: mismatch ? mismatch[1].trim().replace(/\s+/g, ' ') : null,
      diff, actual, reference,
    });
    continue;
  }

  // Anything else — usually a module that failed to resolve (a native-only
  // Expo package with no stub). Not a layout problem; do not redesign for it.
  failures.push({
    kind: 'error',
    screen: title,
    raw: message.split('\n').slice(0, 12).join('\n'),
  });
}

// `retry: 1` means a genuine failure is reported twice, identically. Reporting
// it twice would misstate how many things are wrong and inflate FAILURES in
// the status line.
const seen = new Set();
const deduped = failures.filter(f => {
  const k = JSON.stringify([f.kind, f.screen, f.file, f.violations, f.raw, f.diff]);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
failures.length = 0;
failures.push(...deduped);

// Sweep for diff images the message parser missed, so the agent always has
// something to look at when a screenshot comparison failed.
(function sweep(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sweep(full);
    else if (/-diff\.png$/.test(e.name) && !images.includes(full)) images.push(full);
  }
})(VIS);

// --- status + attempt budget ------------------------------------------------
let status;
if (report && rc === 0) status = seeded ? 'seeded' : 'pass';
else if (!report) status = 'error';
else status = 'fail';

const signature = crypto.createHash('sha1').update(JSON.stringify(
  failures.map(f => [
    f.kind, f.screen, f.file,
    (f.violations ?? []).map(v => `${v.check}:${v.element}`).sort(),
  ]),
)).digest('hex').slice(0, 12);

let prev = { attempts: 0, signature: null };
try { prev = JSON.parse(fs.readFileSync(COUNTER, 'utf8')); } catch { /* first run */ }

let attempts;
if (status === 'pass' || status === 'seeded') attempts = 0;
// An infrastructure error is not a failed design attempt. Letting it consume
// the budget would march a perfectly good layout toward the "your design
// doesn't work" conversation because a config file was broken.
else if (status === 'error') attempts = prev.attempts || 0;
else if (prev.signature === signature) attempts = (prev.attempts || 0) + 1;
else attempts = 1;

if (attempts >= BUDGET && status === 'fail') status = 'blocked';

fs.mkdirSync(VIS, { recursive: true });
fs.writeFileSync(COUNTER, JSON.stringify(
  { attempts, signature: attempts ? signature : null, updatedAt: new Date().toISOString() }, null, 2));

const rel = p => (p && p.startsWith(projectDir) ? path.relative(projectDir, p) : p);

fs.writeFileSync(RESULT, JSON.stringify({
  status,
  ranAt: new Date().toISOString(),
  attempts,
  budget: BUDGET,
  signature,
  note:
    status === 'blocked'
      ? `Same failure ${attempts} times. Stop editing this layout. Follow the non-technical fallback: ` +
        `offer the user two simpler alternatives in plain English, then record the outcome with design-constraint.mjs.`
      : status === 'seeded'
        ? 'Reference screenshots were created on this run. Nothing to fix.'
        : status === 'fail'
          ? 'Fix the listed violations, then run ui-validate.sh again. Look at the diff images before changing layout code.'
          : status === 'error'
            ? 'The suite could not run. This is an infrastructure problem, not a layout problem — do not redesign anything.'
            : 'Layout is structurally sound.',
  failures,
  images: images.map(rel),
}, null, 2));

console.log(`collect: status=${status} attempts=${attempts} failures=${failures.length} images=${images.length}`);
