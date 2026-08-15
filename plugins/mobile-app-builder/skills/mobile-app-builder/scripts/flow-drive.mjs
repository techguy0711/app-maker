/**
 * flow-drive.mjs — internals of flow-validate.sh. Don't call this directly.
 *
 * Serves an already-built web export, drives it in the Chromium
 * setup-visual-loop.sh already installed, and answers one question per route:
 * can a user get from here to somewhere else and back?
 *
 * This is the half ui-validate.sh structurally cannot do. That harness aliases
 * expo-router to stubs — `router.push` is `() => {}` and every screen renders
 * in isolation with no navigator above it — which is correct for measuring
 * geometry and makes navigation untestable by construction. Here the real
 * router runs.
 *
 *   Usage: node flow-drive.mjs <projectDir> <buildDir>
 *   Exit:  0 every route passed | 1 a route failed | 2 could not run
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const projectDir = path.resolve(process.argv[2] || process.cwd());
const buildDir = path.resolve(process.argv[3] || path.join(projectDir, '.claude/flow/web-build'));

const fail = (msg, code = 2) => {
  console.error(msg);
  process.exit(code);
};

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  fail(`No index.html in ${buildDir} — the web export didn't produce one.`);
}

// Playwright lives in the project (setup-visual-loop.sh installs it there),
// not next to this script.
let chromium;
try {
  chromium = createRequire(path.join(projectDir, 'package.json'))('playwright').chromium;
} catch {
  fail('playwright is not installed in this project — run setup-visual-loop.sh first.');
}

// --- routes ----------------------------------------------------------------
const mapPath = path.join(projectDir, '.claude/app-map.json');
if (!fs.existsSync(mapPath)) fail(`No ${mapPath} — run app-map.mjs first.`);

const routes = (JSON.parse(fs.readFileSync(mapPath, 'utf8')).screens || [])
  .map(s => s.route)
  // A dynamic segment has no literal URL to visit. Reaching `/drink/[id]` is
  // what the forward hop below does anyway, via a link the app itself renders.
  .filter(r => r && !r.includes('[') && !r.includes(':'))
  .sort();

if (routes.length === 0) fail('No static routes in the app map — nothing to check.', 2);

// --- static server, SPA fallback -------------------------------------------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.join(buildDir, decodeURIComponent(url.pathname));
  // Directory traversal guard — the build dir is the whole world here.
  if (!file.startsWith(buildDir)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  // Anything that isn't a real file is a client-side route: hand back the
  // shell and let expo-router resolve it, exactly as a static host would.
  if (!fs.existsSync(file)) file = path.join(buildDir, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const base = await new Promise(resolve => {
  server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
});

// --- drive -----------------------------------------------------------------
// Launching is the one step that fails for reasons that have nothing to do
// with the app. It must exit as infrastructure, never as a stack trace — a raw
// throw here reads like a navigation defect and gets "fixed" by rewriting
// working routing code.
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (first) {
  try {
    // setup-visual-loop.sh installs `chromium --only-shell`; on some Playwright
    // versions that binary has to be named explicitly.
    browser = await chromium.launch({ headless: true, channel: 'chromium-headless-shell' });
  } catch {
    server.close();
    console.error(String(first.message || first).split('\n')[0]);
    console.error(
      'Chromium could not launch. This is infrastructure, not navigation — ' +
      'do not change routing code because of it.\n' +
      'Usual cause: the installed browser build does not match the installed ' +
      'playwright version. Re-run: npx playwright install chromium --only-shell',
    );
    process.exit(2);
  }
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('pageerror', e => consoleErrors.push(String(e.message || e)));

/**
 * Cross-origin proxy. An API with no CORS headers works perfectly on a phone
 * and fails in a browser — react-native fetch isn't subject to CORS, the DOM
 * is. Without this, a data-driven app renders its error state on every screen
 * and you spend an hour debugging an app bug that does not exist.
 *
 * Node has no CORS, so refetching there and fulfilling the request is the
 * whole fix.
 *
 * NOTE: installing any route handler at all is why nothing below waits for
 * `networkidle` — with interception active it never settles, and the wait
 * silently burns its full timeout on every single navigation.
 */
await page.route('**/*', async route => {
  const req = route.request();
  const url = req.url();
  if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) {
    return route.continue();
  }
  try {
    const headers = { ...req.headers() };
    for (const h of ['host', 'origin', 'referer', 'sec-fetch-mode', 'sec-fetch-site']) delete headers[h];
    const method = req.method();
    const upstream = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : (req.postData() ?? undefined),
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    await route.fulfill({
      status: upstream.status,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      },
      body,
    });
  } catch {
    await route.abort();
  }
});

const pathOf = () => page.evaluate(() => location.pathname + location.search);

/** Wait for the app to actually paint something, without networkidle. */
async function waitForApp() {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root') || document.body;
      return root && root.innerText.trim().length > 0;
    },
    null,
    { timeout: 15_000 },
  ).catch(() => {});
}

/** The app's own back affordance, if it renders one we can find. */
async function pressBack() {
  const candidates = [
    '[aria-label*="back" i]',
    '[data-testid*="back" i]',
    'button:has-text("Back")',
    '[role="button"][aria-label*="go back" i]',
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => {});
      return 'app-control';
    }
  }
  // No in-app control found. Browser back still exercises the router's history
  // handling, which is most of what a header back button does — but say so in
  // the report rather than claiming the button itself was tested.
  await page.goBack().catch(() => {});
  return 'browser-back';
}

const results = [];

for (const route of routes) {
  const r = { route, renders: false, forward: null, back: null, via: null, ok: false, note: '' };
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await waitForApp();

    const landed = await pathOf();
    r.renders = true;
    if (landed.replace(/\/$/, '') !== route.replace(/\/$/, '')) {
      r.note = `redirected to ${landed}`;
    }

    // Find a link the app itself renders that goes somewhere else in the app.
    const href = await page.evaluate(orig => {
      const here = location.pathname;
      for (const a of Array.from(document.querySelectorAll('a[href]'))) {
        try {
          const u = new URL(a.getAttribute('href'), location.href);
          if (u.origin === location.origin && u.pathname !== here) return u.pathname;
        } catch { /* not a URL we can use */ }
      }
      return null;
    }, base);

    if (!href) {
      r.ok = true;
      r.note = r.note || 'no in-app link on this screen — round trip not exercised';
      results.push(r);
      continue;
    }

    await page.locator(`a[href$="${href}"]`).first().click({ timeout: 5000 });
    await page.waitForFunction(
      p => location.pathname !== p,
      landed.split('?')[0],
      { timeout: 10_000 },
    ).catch(() => {});
    await waitForApp();
    r.forward = await pathOf();

    r.via = await pressBack();
    await page.waitForFunction(
      p => location.pathname === p,
      route,
      { timeout: 10_000 },
    ).catch(() => {});
    await waitForApp();
    r.back = await pathOf();

    r.ok = r.back.replace(/\/$/, '') === route.replace(/\/$/, '');
    if (!r.ok) r.note = `back landed on ${r.back}`;
  } catch (e) {
    r.note = String(e.message || e).split('\n')[0];
    r.ok = false;
  }
  results.push(r);
}

await browser.close();
server.close();

// --- report ----------------------------------------------------------------
const width = Math.max(...results.map(r => r.route.length), 8);
const pad = s => String(s).padEnd(width);

console.log('');
for (const r of results) {
  const mark = r.ok ? '✓' : '✗';
  const back = r.back ? `after back: ${pad(r.back)}` : 'round trip not run  ';
  console.log(`  ${pad(r.route)}  ${back}  ${mark}${r.note ? `  (${r.note})` : ''}`);
}
console.log('');

const outDir = path.join(projectDir, '.claude/flow');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'last-run.json'),
  JSON.stringify({ when: new Date().toISOString(), base, routes: results, pageErrors: consoleErrors }, null, 2),
);

const failed = results.filter(r => !r.ok);
if (failed.length > 0) {
  console.log(`STATUS=fail ROUTES=${results.length} FAILED=${failed.length} RESULT=.claude/flow/last-run.json`);
  process.exit(1);
}
console.log(`STATUS=pass ROUTES=${results.length}`);
