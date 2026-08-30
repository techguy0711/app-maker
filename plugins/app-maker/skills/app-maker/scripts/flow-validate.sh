#!/usr/bin/env bash
# flow-validate.sh — can a user get from A to B and back?
#
# The sibling of ui-validate.sh, and deliberately a separate capability:
#
#   ui-validate.sh    does this screen hold together?   (geometry, one screen,
#                     rendered in isolation with the router stubbed out)
#   flow-validate.sh  can a user get from A to B and    (the real router, real
#                     back?                              navigation, real data)
#
# WHY THIS EXISTS: ui-validate.sh cannot answer navigation questions, and not
# by oversight — its config aliases expo-router to the stubs, where
# `router.push` is `() => {}` and `useLocalSearchParams` returns `{}`, and it
# renders each screen alone with no navigator above it. That's correct for
# measuring geometry and it makes flows structurally untestable there. So a
# broken back button passes every check this skill had, and the first person to
# find it is the user.
#
# The browser this needs is already installed — setup-visual-loop.sh puts
# Playwright and a headless Chromium in the project. This adds no dependency;
# it uses the half that was already sitting there.
#
#   Usage:  flow-validate.sh [projectDir]
#
#   stdout: a per-route table, then STATUS=pass|fail|blocked-infra
#   Exit:   0 every route round-trips
#           1 a route failed — read .claude/flow/last-run.json
#           2 could not run (no export, no browser) — read the log
#
# Run it after ui-validate.sh passes, whenever navigation changed or a control
# is reported as unresponsive. It is not part of the per-edit loop: the export
# step takes a minute or so, which is too slow to run on every keystroke and
# far too fast to skip before handing the app to someone.

set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)" || { echo "STATUS=blocked-infra"; exit 2; }

PROJECT="$(cd "${1:-$PWD}" 2>/dev/null && pwd -P)" || { echo "STATUS=blocked-infra REASON=bad-dir"; exit 2; }
cd "$PROJECT" || { echo "STATUS=blocked-infra REASON=bad-dir"; exit 2; }
[ -f package.json ] || { echo "STATUS=blocked-infra REASON=not-a-project"; exit 2; }

FLOW_DIR="$PROJECT/.claude/flow"
LOG_DIR="$PROJECT/.claude/logs"
LOG="$LOG_DIR/flow-validate.log"
BUILD_DIR="$FLOW_DIR/web-build"
mkdir -p "$FLOW_DIR" "$LOG_DIR"

{
  echo "==================================================================="
  echo "flow-validate $(date -u +%Y-%m-%dT%H:%M:%SZ)  project=$PROJECT"
} >>"$LOG" 2>&1

# 1. Fresh route list. The driver reads this to know what to visit.
node "$SKILL_DIR/scripts/app-map.mjs" "$PROJECT" >>"$LOG" 2>&1

# 2. Build the web bundle. --clear stops a stale export from silently passing
#    a check against code that no longer exists.
rm -rf "$BUILD_DIR"
npx --yes expo export --platform web --clear --output-dir "$BUILD_DIR" >>"$LOG" 2>&1
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "STATUS=blocked-infra REASON=export-failed LOG=.claude/logs/flow-validate.log"
  echo "  (this is infrastructure, not a layout or navigation problem — do not"
  echo "   redesign anything on the strength of it)"
  exit 2
fi

# 3. Drive it. Everything noisy goes to the log; the table and status line are
#    the only things on stdout.
node "$SKILL_DIR/scripts/flow-drive.mjs" "$PROJECT" "$BUILD_DIR" 2>>"$LOG"
RC=$?

if [ "$RC" -eq 2 ]; then
  echo "STATUS=blocked-infra LOG=.claude/logs/flow-validate.log"
  exit 2
fi
exit "$RC"
