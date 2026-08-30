#!/usr/bin/env bash
# setup-visual-loop.sh — install and configure the headless visual check.
#
# Run ONCE per project, right after scaffolding. Everything it does is
# silent: all package-manager and browser-download output goes to
# .claude/logs/setup.log, nothing reaches the user's screen. It prints one
# machine-readable status line to stdout for the agent and nothing else.
#
# Adds (as devDependencies, plus a headless Chromium):
#   vitest, @vitest/browser, @vitest/browser-playwright, vitest-browser-react,
#   playwright  ... and via `expo install` so versions match the SDK:
#   react-dom, react-native-web
#
# Writes:
#   .claude/visual/vitest.config.ts   headless config, iPhone-sized viewport
#   .claude/visual/setup.ts           test bootstrap (fonts, animations off)
#   .claude/visual/layout-checks.ts   baseline-free layout assertions
#   .claude/visual/expo-stubs.tsx     web stand-ins for native-only modules
#
# Usage:  setup-visual-loop.sh [projectDir]
# Exit:   0 ready | 1 not an app project | 2 install failed (see log)

set -uo pipefail

# Resolve the skill's own location BEFORE cd-ing anywhere. ${BASH_SOURCE[0]}
# is frequently a relative path, and resolving it after the cd below silently
# points at a directory inside the user's app instead of at this skill.
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)" || { echo "STATUS=bad-skill-dir"; exit 2; }

PROJECT="$(cd "${1:-$PWD}" 2>/dev/null && pwd -P)" || { echo "STATUS=bad-dir"; exit 1; }
cd "$PROJECT" || { echo "STATUS=bad-dir"; exit 1; }
[ -f package.json ] || { echo "STATUS=not-a-project"; exit 1; }

LOG_DIR="$PROJECT/.claude/logs"
VIS_DIR="$PROJECT/.claude/visual"
mkdir -p "$LOG_DIR" "$VIS_DIR"
LOG="$LOG_DIR/setup.log"

{
  echo "==================================================================="
  echo "visual-loop setup  $(date -u +%Y-%m-%dT%H:%M:%SZ)  project=$PROJECT"
} >>"$LOG" 2>&1

# Keep the whole apparatus out of the user's git history and out of sight.
# .claude/ holds agent-only state; screenshots and logs are noise to them.
if ! grep -q '^\.claude/$' .gitignore 2>/dev/null; then
  # .vitest-attachments/ is written at the project root, not under .claude/,
  # so it needs its own line — otherwise failed-run diff images show up as
  # untracked files in the user's project.
  printf '\n# agent-only: visual checks, logs, codebase map\n.claude/\n.vitest-attachments/\n' >>.gitignore
fi

fail() { echo "STATUS=install-failed STEP=$1 LOG=.claude/logs/setup.log"; exit 2; }

# 1. Web renderer. Recent Expo default templates (SDK 57+) already ship
#    react-dom and react-native-web, so check before installing: `expo
#    install` reaches out to Expo's API for version resolution, and making a
#    network round-trip mandatory would fail setup on a flaky connection for
#    packages that are already sitting in node_modules. Verified against a
#    real SDK 57 scaffold, where both were present from the start.
have_web_deps() {
  node -e "require.resolve('react-dom',{paths:['$PROJECT']});require.resolve('react-native-web',{paths:['$PROJECT']})" 2>/dev/null
}
if have_web_deps; then
  echo "--- react-dom + react-native-web already present, skipping expo install" >>"$LOG"
else
  echo "--- expo install react-dom react-native-web" >>"$LOG"
  npx --yes expo install react-dom react-native-web >>"$LOG" 2>&1 || true
  # Only a genuine failure if they're still missing afterwards.
  have_web_deps || fail expo-install
fi

# 2. Test tooling. Pinned to majors so a future breaking release can't
#    silently change the assertion API out from under the skill. Re-running
#    setup is a supported recovery step, and it must not turn an already-ready
#    offline project into a network-dependent `npm install`. Verify the actual
#    package manifests and skip the install only when every required major is
#    already present.
have_test_tooling() {
  node -e '
    const fs = require("fs");
    const path = require("path");
    const root = process.argv[1];
    const required = [
      ["vitest", 4],
      ["@vitest/browser", 4],
      ["@vitest/browser-playwright", 4],
      ["vitest-browser-react", 2],
      ["playwright", 1],
      ["@vitejs/plugin-react", 5],
    ];
    for (const [name, major] of required) {
      const manifest = path.join(root, "node_modules", ...name.split("/"), "package.json");
      const version = JSON.parse(fs.readFileSync(manifest, "utf8")).version;
      if (Number(version.split(".")[0]) !== major) process.exit(1);
    }
  ' "$PROJECT" 2>/dev/null
}

if have_test_tooling; then
  echo "--- compatible test tooling already present, skipping npm install" >>"$LOG"
else
  echo "--- npm install test tooling" >>"$LOG"
  # @vitejs/plugin-react is not optional: vitest.config.ts imports it to
  # transform JSX. Without it the whole suite dies at config load with a
  # module-not-found, before a single screen renders.
  npm install --save-dev --no-fund --no-audit \
    vitest@^4 @vitest/browser@^4 @vitest/browser-playwright@^4 \
    vitest-browser-react@^2 playwright@^1 @vitejs/plugin-react@^5 >>"$LOG" 2>&1 || fail npm-install
fi

# 3. Headless Chromium. --only-shell is the smaller headless-only build;
#    it is all `toMatchScreenshot` needs and downloads noticeably faster.
#
#    Two rules here, both learned the hard way.
#
#    Don't download what's already there. Sandboxes and CI images routinely
#    pre-bake a Playwright browser and point PLAYWRIGHT_BROWSERS_PATH at it,
#    and `playwright install` ignores PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD because
#    it's an explicit install command — so it reaches for a CDN that a
#    restricted environment blocks, to fetch something already on disk. The
#    only check worth trusting is launching it: a browser that opens and
#    closes is usable, whatever its revision number claims.
browser_usable() {
  node -e "require('playwright').chromium.launch({headless:true}).then(b=>b.close()).then(()=>process.exit(0),()=>process.exit(1))" 2>/dev/null
}

echo "--- checking for a usable headless chromium" >>"$LOG"
if browser_usable; then
  echo "--- chromium already usable, skipping download" >>"$LOG"
  BROWSER_STATUS=ok
else
  echo "--- playwright install chromium" >>"$LOG"
  if npx --yes playwright install chromium --only-shell >>"$LOG" 2>&1 && browser_usable; then
    BROWSER_STATUS=ok
  else
    BROWSER_STATUS=missing
  fi
fi

#    And don't let a missing browser cancel the rest of setup. Aborting here
#    used to leave .claude/visual/ empty, so every later ui-validate.sh call
#    reported `not-configured` — which reads as "this project was never set
#    up" and hides the real, single, fixable cause. Steps 4-6 are local file
#    copies that cost nothing and cannot fail for network reasons; run them
#    regardless, and report the browser problem at the end.

# 4. Config + helpers. Copied, not generated, so they stay reviewable.
cp "$SKILL_DIR/templates/vitest.config.ts"  "$VIS_DIR/vitest.config.ts"
cp "$SKILL_DIR/templates/setup.ts"          "$VIS_DIR/setup.ts"
cp "$SKILL_DIR/templates/layout-checks.ts"  "$VIS_DIR/layout-checks.ts"
cp "$SKILL_DIR/templates/expo-stubs.tsx"    "$VIS_DIR/expo-stubs.tsx"

# 5. Constraints ledger — created empty so the agent always has a file to
#    read rather than a "does it exist" branch on every single build.
LEDGER="$PROJECT/.claude/design-constraints.json"
[ -f "$LEDGER" ] || cat >"$LEDGER" <<'EOF'
{
  "version": 1,
  "note": "Layout patterns that failed visual validation 3 times in this project. Never attempt these again here. Written by scripts/design-constraint.mjs, read before writing any layout code.",
  "constraints": []
}
EOF

if [ "$BROWSER_STATUS" != "ok" ]; then
  # Config is on disk, so this is recoverable: install a browser later and the
  # loop works with no further setup. CONFIG=written is what tells the agent
  # that, rather than making it re-run setup and hit the same download.
  echo "STATUS=install-failed STEP=browser-install CONFIG=written LOG=.claude/logs/setup.log"
  exit 2
fi

echo "STATUS=ready VISUAL_DIR=.claude/visual LOG=.claude/logs/setup.log"
