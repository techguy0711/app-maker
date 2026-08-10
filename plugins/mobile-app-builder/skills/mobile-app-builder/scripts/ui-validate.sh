#!/usr/bin/env bash
# ui-validate.sh — run the headless visual check. Silent to the user.
#
# Nothing this script does reaches the user's screen. Test output, bundler
# noise, stack traces and image paths all go to files under .claude/, and the
# only thing printed to stdout is a single status line for the agent.
#
# "Silent" means silent to the *user*, never silent to *you*. Everything is
# captured in full at .claude/logs/ui-validate.log and summarised as
# structured JSON at .claude/visual/last-run.json — read that file after any
# non-zero exit. Never re-run with output visible to "see what happened".
#
#   Usage:  ui-validate.sh [projectDir]
#
#   stdout: STATUS=pass|fail|seeded|blocked|not-configured ATTEMPTS=n ...
#   Exit:   0 pass or baselines seeded
#           1 real failure — read .claude/visual/last-run.json
#           2 could not run (setup missing/broken) — read the log
#           3 project not set up for visual checks at all
#
# Attempt budget: consecutive failures *with the same signature* increment
# ATTEMPTS. A different failure resets it to 1 — fixing one problem and
# uncovering another gives the new problem a full budget rather than
# inheriting an exhausted one. A pass resets it to 0. At ATTEMPTS=3 the
# status is `blocked`: stop editing, and follow the non-technical fallback in
# SKILL.md instead.

set -uo pipefail

# Resolve the skill's own location BEFORE cd-ing anywhere. ${BASH_SOURCE[0]}
# is frequently a relative path, and resolving it after the cd below silently
# points at a directory inside the user's app instead of at this skill.
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)" || { echo "STATUS=blocked-infra"; exit 2; }

PROJECT="$(cd "${1:-$PWD}" 2>/dev/null && pwd -P)" || { echo "STATUS=not-configured"; exit 3; }
cd "$PROJECT" || { echo "STATUS=not-configured"; exit 3; }

VIS="$PROJECT/.claude/visual"
LOGD="$PROJECT/.claude/logs"
LOG="$LOGD/ui-validate.log"
RESULT="$VIS/last-run.json"

[ -f "$VIS/vitest.config.ts" ] || { echo "STATUS=not-configured HINT=run-setup-visual-loop.sh"; exit 3; }
mkdir -p "$LOGD" "$VIS"

{
  echo "==================================================================="
  echo "ui-validate $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >>"$LOG" 2>&1

# 1. Refresh the map, then regenerate checks from it. Screens the user asked
#    to remove stop being checked; screens they just asked for start being
#    checked. No stale test files to reconcile by hand.
node "$SKILL_DIR/scripts/app-map.mjs" "$PROJECT" >>"$LOG" 2>&1
node "$SKILL_DIR/scripts/gen-visual-tests.mjs" "$PROJECT" >>"$LOG" 2>&1
GEN_RC=$?
if [ "$GEN_RC" -eq 4 ]; then
  echo "STATUS=pass ATTEMPTS=0 NOTE=no-screens-to-check"; exit 0
elif [ "$GEN_RC" -ne 0 ]; then
  echo "STATUS=blocked-infra RC=$GEN_RC LOG=.claude/logs/ui-validate.log"; exit 2
fi

JSON_OUT="$VIS/.vitest-report.json"

run_suite() {
  # The `--` before `vitest` is load-bearing, not style. Without it npx claims
  # every following flag as its own and forwards only the bare command:
  # `npx --no vitest --run --reporter=json --outputFile=X` reaches vitest as
  # zero arguments, so it starts in WATCH mode, writes no report, and never
  # returns — the loop hangs with nothing on screen to interrupt. Verified by
  # printing "$@" from a stub binary: 1 arg without `--`, 5 with it.
  #
  # --run forces the single pass; --reporter=json + --outputFile are what make
  # the result machine-readable instead of scraped from console text.
  npx --no -- vitest --run \
      --config "$VIS/vitest.config.ts" \
      --reporter=json --outputFile="$JSON_OUT" \
      >>"$LOG" 2>&1
  return $?
}

run_suite
RC=$?

# 2. First run on a new screen has no reference image, so Vitest writes one
#    and fails by design. That is not a layout defect and must not cost an
#    attempt — seed, then re-run once to get a real verdict.
if [ "$RC" -ne 0 ] && node "$SKILL_DIR/scripts/collect-visual-result.mjs" \
      "$PROJECT" --seed-check >>"$LOG" 2>&1; then
  echo "--- baselines were seeded; re-running for a real verdict" >>"$LOG"
  run_suite
  RC=$?
  SEEDED=1
else
  SEEDED=0
fi

# 3. Turn whatever happened into structured, agent-readable JSON. This is the
#    only artefact that matters after this point.
node "$SKILL_DIR/scripts/collect-visual-result.mjs" "$PROJECT" \
     --rc "$RC" --seeded "$SEEDED" >>"$LOG" 2>&1
COLLECT_RC=$?
if [ "$COLLECT_RC" -ne 0 ] || [ ! -f "$RESULT" ]; then
  echo "STATUS=blocked-infra RC=$RC LOG=.claude/logs/ui-validate.log"; exit 2
fi

STATUS=$(node -e "process.stdout.write(require('$RESULT').status)" 2>/dev/null || echo unknown)
ATTEMPTS=$(node -e "process.stdout.write(String(require('$RESULT').attempts))" 2>/dev/null || echo 0)
COUNT=$(node -e "process.stdout.write(String(require('$RESULT').failures.length))" 2>/dev/null || echo 0)

case "$STATUS" in
  pass)    echo "STATUS=pass ATTEMPTS=0"; exit 0 ;;
  seeded)  echo "STATUS=seeded ATTEMPTS=0 NOTE=baselines-created"; exit 0 ;;
  blocked) echo "STATUS=blocked ATTEMPTS=$ATTEMPTS FAILURES=$COUNT RESULT=.claude/visual/last-run.json"; exit 1 ;;
  fail)    echo "STATUS=fail ATTEMPTS=$ATTEMPTS FAILURES=$COUNT RESULT=.claude/visual/last-run.json"; exit 1 ;;
  # The suite never produced a report: it couldn't run at all. Distinct from a
  # layout failure and must never be reported as one — redesigning a screen
  # because vitest is missing is the worst outcome this script can produce.
  *)       echo "STATUS=blocked-infra RC=$RC LOG=.claude/logs/ui-validate.log"; exit 2 ;;
esac
