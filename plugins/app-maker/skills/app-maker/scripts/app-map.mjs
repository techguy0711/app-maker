#!/usr/bin/env node
/**
 * app-map.mjs — build a queryable map of an Expo/React Native project.
 *
 * Writes two files:
 *   .claude/app-map.md    an annotated tree — routes, imports, style names,
 *                         risky patterns, constraints. THE ONE TO READ.
 *   .claude/app-map.json  the same map plus every resolved StyleSheet value
 *                         and the full import/used-by graph. For lookups.
 *
 * Purpose: let the agent answer "what screens exist / what uses this /
 * where is this style defined / what did I already try" from ONE file
 * instead of grepping the tree. Read-only. Never modifies source.
 *
 * The split exists because the JSON is read before every layout edit and the
 * resolved style values dominate it — roughly 6× the digest's tokens on a
 * two-screen app, and the gap widens with every screen. Scripts consume the
 * JSON; the agent should be reading the digest.
 *
 * Uses the project's own `typescript` dependency (every Expo TS template
 * ships one) — adds no dependency of its own. If typescript can't be
 * resolved it exits 3 and the caller should just fall back to file reads.
 *
 * Usage:  node app-map.mjs [projectDir]      # default: cwd
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = path.resolve(process.argv[2] || process.cwd());

// --- resolve the project's typescript, not ours -----------------------------
let ts;
try {
  const require = createRequire(path.join(projectDir, 'package.json'));
  ts = require('typescript');
} catch {
  console.error('app-map: no local typescript; falling back to file reads');
  process.exit(3);
}

// --- collect source files ---------------------------------------------------
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.expo', 'dist', 'build', 'ios', 'android',
  '.claude', '__screenshots__', '.vitest-attachments', 'coverage', 'scripts',
]);
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
// Tooling config, not app code — never part of the map.
const SKIP_FILE = /(^|\/)(eslint|babel|metro|jest|vitest|tailwind|prettier)\.config\.[cm]?[jt]s$/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') {
      if (SKIP_DIRS.has(e.name)) continue;
    }
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(e.name)) && !e.name.endsWith('.d.ts')
             && !SKIP_FILE.test(full.replace(/\\/g, '/'))) out.push(full);
  }
  return out;
}

const files = walk(projectDir);
if (files.length === 0) {
  console.error('app-map: no source files found under ' + projectDir);
  process.exit(4);
}

// --- where does routing live? ----------------------------------------------
const appRootRel = fs.existsSync(path.join(projectDir, 'src', 'app'))
  ? path.join('src', 'app')
  : fs.existsSync(path.join(projectDir, 'app')) ? 'app' : null;

function routeFor(rel) {
  if (!appRootRel || !rel.startsWith(appRootRel + path.sep)) return null;
  let r = rel.slice(appRootRel.length + 1).replace(/\\/g, '/');
  r = r.replace(/\.(tsx|ts|jsx|js)$/, '');
  if (/(^|\/)_layout$/.test(r)) return null;          // layouts aren't routes
  r = r.replace(/\([^/]*\)\//g, '');                   // (tabs)/ groups vanish
  r = r.replace(/\/?index$/, '');
  return '/' + r.replace(/^\/+/, '');
}

// --- layout patterns that break on a real device ---------------------------
// Each: [test(styleObject), reason]. Deliberately narrow — every rule here is
// a near-certain bug, not a style opinion. A rule that fires on healthy code
// (e.g. "row with gap and no flexWrap", which flags every ordinary two-button
// row) trains the agent to ignore the list, which is worse than no list.
const RISKY_RULES = [
  [s => s.position === 'fixed',
    "position:'fixed' does not exist in React Native — the element renders unpositioned"],
  [s => s.position === 'absolute' && !('width' in s) && !('height' in s)
      && !(('left' in s || 'right' in s) && ('top' in s || 'bottom' in s)),
    'position:absolute with neither explicit size nor two opposing offsets — collapses to zero on device',
    'skipIfDynamic'],
  [s => s.flex === 1 && s.position === 'absolute',
    'flex:1 on an absolutely positioned element — flex is ignored, size is undefined'],
  [s => 'height' in s && typeof s.height === 'number' && s.height > 640,
    'fixed height taller than a short phone viewport — content will be clipped'],
  [s => 'width' in s && typeof s.width === 'number' && s.width > 390,
    'fixed width wider than a standard phone — causes horizontal overflow'],
  [s => 'lineHeight' in s && 'fontSize' in s
      && typeof s.lineHeight === 'number' && typeof s.fontSize === 'number'
      && s.lineHeight < s.fontSize,
    'lineHeight below fontSize — clips descenders on Android'],
  [s => ['marginTop', 'marginLeft', 'marginBottom', 'marginRight', 'margin']
      .some(k => typeof s[k] === 'number' && s[k] <= -24),
    'large negative margin — pulls content outside its parent, untappable on device'],
];

// --- parse ------------------------------------------------------------------
const components = [];
const screens = [];
const imports = {};
const styles = [];
const risky = [];

// Resolve a style value to a literal. `consts` carries this file's top-level
// `const FOO = 88` declarations so the very common `width: BUTTON_SIZE` and
// `borderRadius: BUTTON_SIZE / 2` patterns don't read as unknown.
function literalValue(node, consts) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isIdentifier(node) && consts && consts.has(node.text)) return consts.get(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const v = literalValue(node.operand, consts);
    return typeof v === 'number' ? -v : undefined;
  }
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression, consts);
  if (ts.isBinaryExpression(node)) {
    const l = literalValue(node.left, consts), r = literalValue(node.right, consts);
    if (typeof l !== 'number' || typeof r !== 'number') return undefined;
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.PlusToken: return l + r;
      case ts.SyntaxKind.MinusToken: return l - r;
      case ts.SyntaxKind.AsteriskToken: return l * r;
      case ts.SyntaxKind.SlashToken: return r === 0 ? undefined : l / r;
      default: return undefined;
    }
  }
  return undefined; // computed/derived — not statically knowable, skip it
}

// Top-level `const NAME = <literal>` declarations in one file.
function collectConsts(sf, consts) {
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      const v = literalValue(d.initializer, consts);
      if (v !== undefined) consts.set(d.name.text, v);
    }
  }
}

for (const abs of files) {
  const rel = path.relative(projectDir, abs).replace(/\\/g, '/');
  const text = fs.readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true,
    /\.tsx?$/.test(abs) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);

  const fileImports = [];
  const exportNames = [];
  const testIds = [];
  let usesExpoUi = false;
  const consts = new Map();
  collectConsts(sf, consts);
  // Style keys that get merged with an inline object at the call site —
  // `style={[styles.block, { width: b.w, height: b.h }]}`. Their size is
  // supplied at runtime, so the static "absolute with no size" rules would
  // fire on perfectly correct code. Verified: without this, a normal
  // absolutely-positioned game sprite produces a false positive every time.
  const dynamicStyles = new Set();
  const pendingRules = [];

  const visit = (node) => {
    // imports
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      fileImports.push(spec);
      if (spec === '@expo/ui' || spec.startsWith('@expo/ui/')) usesExpoUi = true;
    }
    // exported component-ish declarations
    const mods = ts.canHaveModifiers(node) ? (ts.getModifiers(node) || []) : [];
    const isExported = mods.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isExported && ts.isFunctionDeclaration(node) && node.name) {
      exportNames.push(isDefault ? `default (${node.name.text})` : node.name.text);
    }
    if (isExported && ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) exportNames.push(d.name.text);
      }
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      exportNames.push(ts.isIdentifier(node.expression)
        ? `default (${node.expression.text})` : 'default');
    }
    // style={[styles.a, styles.b, { ...inline }]} — note which keys are
    // augmented at runtime.
    if (ts.isJsxAttribute(node) && node.name.getText() === 'style'
        && node.initializer && ts.isJsxExpression(node.initializer)
        && node.initializer.expression
        && ts.isArrayLiteralExpression(node.initializer.expression)) {
      const els = node.initializer.expression.elements;
      const hasInline = els.some(e =>
        ts.isObjectLiteralExpression(e)
        || (ts.isConditionalExpression(e) || ts.isBinaryExpression(e)));
      if (hasInline) {
        for (const e of els) {
          if (ts.isPropertyAccessExpression(e)) dynamicStyles.add(e.name.text);
        }
      }
    }
    // testID props — the handle the visual checks need
    if (ts.isJsxAttribute(node) && node.name.getText() === 'testID'
        && node.initializer && ts.isStringLiteralLike(node.initializer)) {
      testIds.push(node.initializer.text);
    }
    // StyleSheet.create({...})
    if (ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'create'
        && node.expression.expression.getText() === 'StyleSheet'
        && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      for (const rule of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(rule) || !ts.isObjectLiteralExpression(rule.initializer)) continue;
        const name = rule.name.getText().replace(/['"]/g, '');
        const props = {};
        for (const p of rule.initializer.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const v = literalValue(p.initializer, consts);
          if (v !== undefined) props[p.name.getText().replace(/['"]/g, '')] = v;
        }
        const { line } = sf.getLineAndCharacterOfPosition(rule.getStart(sf));
        styles.push({ file: rel, name, line: line + 1, props });
        // Deferred: StyleSheet.create almost always sits at the bottom of the
        // file, but not always. Evaluating rules after the whole file is
        // walked guarantees dynamicStyles is complete either way.
        pendingRules.push({ file: rel, name, line: line + 1, props });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  for (const { file, name, line, props } of pendingRules) {
    for (const [test, reason, skipIfDynamic] of RISKY_RULES) {
      if (skipIfDynamic && dynamicStyles.has(name)) continue;
      let hit = false;
      try { hit = test(props); } catch { hit = false; }
      if (hit) risky.push({ file, style: name, line, reason });
    }
  }

  imports[rel] = [...new Set(fileImports)];

  const entry = {
    name: path.basename(rel).replace(/\.(tsx|ts|jsx|js)$/, ''),
    file: rel,
    exports: [...new Set(exportNames)],
    testIDs: [...new Set(testIds)],
    usesExpoUi,
  };
  const route = routeFor(path.relative(projectDir, abs));
  if (route !== null) screens.push({ route, ...entry });
  else components.push(entry);
}

// --- used-by (reverse import graph), local paths only -----------------------
const usedBy = {};
for (const [from, specs] of Object.entries(imports)) {
  for (const spec of specs) {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    // `@/x` is the tsconfig alias, which points at src/ on templates that
    // have one and at the root on those that don't. Note the trailing slash
    // in the test: a bare '@' prefix would also catch scoped packages.
    const aliasBase = fs.existsSync(path.join(projectDir, 'src'))
      ? path.join(projectDir, 'src') : projectDir;
    const base = spec.startsWith('@/')
      ? path.join(aliasBase, spec.slice(2))
      : path.resolve(projectDir, path.dirname(from), spec);
    for (const cand of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
      const p = base + cand;
      if (fs.existsSync(p)) {
        const key = path.relative(projectDir, p).replace(/\\/g, '/');
        (usedBy[key] ||= []).push(from);
        break;
      }
    }
  }
}

// --- carry the constraints ledger inline so one read answers everything -----
let constraints = [];
const ledger = path.join(projectDir, '.claude', 'design-constraints.json');
if (fs.existsSync(ledger)) {
  try { constraints = JSON.parse(fs.readFileSync(ledger, 'utf8')).constraints || []; } catch {}
}

const out = {
  generatedAt: new Date().toISOString(),
  projectDir,
  appRoot: appRootRel,
  counts: {
    screens: screens.length, components: components.length,
    styles: styles.length, risky: risky.length, constraints: constraints.length,
  },
  screens: screens.sort((a, b) => a.route.localeCompare(b.route)),
  components: components.sort((a, b) => a.file.localeCompare(b.file)),
  imports,
  usedBy,
  styles,
  risky,
  constraints,
};

const outDir = path.join(projectDir, '.claude');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'app-map.json'), JSON.stringify(out, null, 2));

// --- the digest: app-map.md -------------------------------------------------
// WHY THIS EXISTS: app-map.json is read before every layout edit, and it is
// dominated by resolved StyleSheet values — on a two-screen example app it is
// already ~4.4k tokens, and it grows with every screen. Almost every read only
// needs "what exists, what's a route, what's shared, what already failed."
// This file answers exactly that in roughly a tenth of the tokens; the JSON
// stays for the times you need a specific value or the full graph.
//
// Anything truncated here is marked, and marked truncation is the point: it
// tells you when to open the JSON instead of guessing that you have it all.
const uses = {};
for (const [target, froms] of Object.entries(usedBy)) {
  for (const from of froms) (uses[from] ||= []).push(target);
}

const baseName = f => path.basename(f).replace(/\.(tsx|ts|jsx|js)$/, '');
const routeOf = new Map(screens.map(s => [s.file, s.route]));
const compName = e => {
  const def = (e.exports || []).find(x => x.startsWith('default ('));
  return def ? def.slice(9, -1) : (e.exports || [])[0] || '';
};

// Group every mapped file under its directory, so the shape of the project is
// visible without a single directory listing.
const byDir = new Map();
for (const e of [...screens, ...components]) {
  const dir = path.dirname(e.file) === '.' ? '(root)' : path.dirname(e.file) + '/';
  if (!byDir.has(dir)) byDir.set(dir, []);
  byDir.get(dir).push(e);
}

const stylesByFile = new Map();
for (const s of styles) {
  if (!stylesByFile.has(s.file)) stylesByFile.set(s.file, []);
  stylesByFile.get(s.file).push(s.name);
}

const L = [];
L.push(`# App map — ${path.basename(projectDir)}`);
L.push('');
L.push(`${out.counts.screens} screens · ${out.counts.components} components · ` +
  `${out.counts.styles} styles · ${out.counts.risky} risky · ${out.counts.constraints} constraints`);
L.push('');
L.push('## Tree');
L.push('');
L.push('```');
for (const dir of [...byDir.keys()].sort()) {
  L.push(dir);
  for (const e of byDir.get(dir).sort((a, b) => a.file.localeCompare(b.file))) {
    const route = routeOf.get(e.file);
    const usedByN = (usedBy[e.file] || []).length;
    const localUses = (uses[e.file] || []).map(baseName);
    const shown = localUses.slice(0, 6).join(', ');
    const more = localUses.length > 6 ? ` +${localUses.length - 6}` : '';

    let line = '  ' + path.basename(e.file).padEnd(26);
    line += (route ? `→ ${route}` : '').padEnd(16);
    line += compName(e).padEnd(20);
    // Fixed-width, so the `uses:` column lines up whether or not a file has
    // importers. Trailing padding is stripped below.
    line += (usedByN ? `←${usedByN}` : '').padEnd(5);
    if (localUses.length) line += ` uses: ${shown}${more}`;
    if (e.usesExpoUi) line += '  [@expo/ui — skipped by ui-validate]';
    L.push(line.replace(/\s+$/, ''));
  }
}
L.push('```');
L.push('');
L.push('`→` route · `←N` imported by N files · `uses:` local imports only');
L.push('');

L.push('## Style names (values are in app-map.json)');
L.push('');
L.push('```');
for (const [file, names] of [...stylesByFile.entries()].sort()) {
  const shown = names.slice(0, 14).join(', ');
  const more = names.length > 14 ? ` … +${names.length - 14} more` : '';
  L.push(`${file}: ${shown}${more}`);
}
if (stylesByFile.size === 0) L.push('(none)');
L.push('```');
L.push('');

// Never truncated. These two are the "don't do it again" record, and a partial
// version of either is worse than none — it reads as complete.
L.push('## Risky patterns');
L.push('');
if (risky.length === 0) L.push('None.');
else for (const r of risky) {
  L.push(`- \`${r.file}\`${r.style ? ` → \`${r.style}\`` : ''}${r.line ? ` (line ${r.line})` : ''}: ${r.reason}`);
}
L.push('');

L.push('## Constraints already hit in this project');
L.push('');
if (constraints.length === 0) L.push('None yet.');
else for (const c of constraints) {
  L.push(`- \`${c.file}\` — ${c.pattern}${c.chose ? ` → user chose: ${c.chose}` : ''}`);
}
L.push('');
L.push('---');
L.push('');
L.push('Read this file first. Open `app-map.json` only for a specific resolved');
L.push('style value, or the full import/used-by graph — everything else is above.');
L.push('');

const md = L.join('\n');
fs.writeFileSync(path.join(outDir, 'app-map.md'), md);

console.log(`app-map: ${out.counts.screens} screens, ${out.counts.components} components, ` +
  `${out.counts.styles} styles, ${out.counts.risky} risky, ${out.counts.constraints} constraints ` +
  `(digest ${Math.round(md.length / 1024 * 10) / 10}KB vs json ${Math.round(JSON.stringify(out, null, 2).length / 1024 * 10) / 10}KB)`);
