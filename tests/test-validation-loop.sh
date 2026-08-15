#!/usr/bin/env bash
# Round-2 harness: covers the defects found by building example app #2
# (multi-screen, SDK 54) plus the independent file audit.
# Usage: test-patch2.sh <patched-skill-dir> [habitAppDir]
set -uo pipefail

PASS=0; FAIL=0; SKIP=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[33mSKIP\033[0m  %s\n' "$1"; SKIP=$((SKIP+1)); }
grp()  { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Absolute, always: section G cd's into the app directory, and a relative
# skill path silently stops resolving there — which reads as three code
# failures against a tree that is byte-identical to a passing one.
SKILL="$(cd "$1" && pwd -P)"; SCRIPTS="$SKILL/scripts"
APP="$(cd "${2:-/tmp/habit-app}" 2>/dev/null && pwd -P || echo "${2:-/tmp/habit-app}")"
unset CI CONTINUOUS_INTEGRATION
export EXPO_NO_TELEMETRY=1

grp "A. Syntax"
for f in "$SCRIPTS"/*.sh; do bash -n "$f" 2>/dev/null || bad "bash -n $(basename "$f")"; done
ok "all .sh parse"
for f in "$SCRIPTS"/*.mjs; do node --check "$f" 2>/dev/null || bad "node --check $(basename "$f")"; done
ok "all .mjs parse"

grp "B. expo-stubs: the aliases that had nothing behind them"
for sym in useSharedValue useAnimatedStyle withSpring withTiming interpolate Easing GlassView isLiquidGlassAvailable createAnimatedComponent; do
  if grep -q "$sym" "$SKILL/templates/expo-stubs.tsx"; then ok "stub exports $sym"
  else bad "stub still missing $sym"; fi
done
# Every module aliased in vitest.config.ts must have SOMETHING behind it.
for mod in reanimated glass-effect; do
  grep -q "$mod" "$SKILL/templates/expo-stubs.tsx" && ok "stub covers $mod" || bad "stub missing $mod"
done

grp "C. Template propagation (documented fix used to be a no-op)"
if grep -q '\-nt' "$SCRIPTS/ui-validate.sh"; then ok "ui-validate refreshes newer templates"
else bad "ui-validate does not refresh templates"; fi
# Executable lines only — the first version of this check matched the comment
# that explains why 'cp -u' is avoided. Same mistake as round 1's 'env -u'.
if sed 's/[[:space:]]*#.*$//' "$SCRIPTS/ui-validate.sh" | grep -q 'cp -u'; then
  bad "executes 'cp -u' (absent on older macOS)"; else ok "avoids 'cp -u' in executable code"; fi

grp "D. Unique slugs + zero-test exit"
rm -rf /tmp/slugtest; mkdir -p /tmp/slugtest/app/settings /tmp/slugtest/.claude
printf '{"name":"slugtest"}' > /tmp/slugtest/package.json
touch /tmp/slugtest/app/settings/profile.tsx /tmp/slugtest/app/settings-profile.tsx /tmp/slugtest/app/index.tsx
cat > /tmp/slugtest/.claude/app-map.json <<'J'
{"screens":[{"route":"/settings/profile","file":"app/settings/profile.tsx"},
            {"route":"/settings-profile","file":"app/settings-profile.tsx"},
            {"route":"/","file":"app/index.tsx"}]}
J
node "$SCRIPTS/gen-visual-tests.mjs" /tmp/slugtest >/dev/null 2>&1
N=$(ls /tmp/slugtest/.claude/visual/tests/ 2>/dev/null | wc -l | tr -d ' ')
[ "$N" = "3" ] && ok "colliding routes produce 3 distinct test files (was 2)" || bad "got $N test files, expected 3"

cat > /tmp/slugtest/.claude/app-map.json <<'J'
{"screens":[{"route":"/","file":"app/index.tsx","usesExpoUi":true}]}
J
node "$SCRIPTS/gen-visual-tests.mjs" /tmp/slugtest >/dev/null 2>&1
[ "$?" = "4" ] && ok "all-native-UI app exits 4 (nothing to check), not 0" || bad "exit was $?, expected 4"

grp "E. Doc defects"
grep -q 'ASCII QR block you printed' "$SKILL/references/build-flow/phase-3-preview-expo-go.md" \
  && ok "QR handoff no longer says 'the image you just sent'" || bad "QR image contradiction remains"
grep -q 'exp://u.expo.dev' "$SKILL/references/build-flow/phase-3-preview-expo-go.md" \
  && ok "fallback QR documents the exp:// scheme" || bad "exp:// scheme not documented"
grep -q 'Path A only' "$SKILL/SKILL.md" \
  && ok "check-expo-go-sdk marked Path A only" || bad "SKILL.md still says 'every fresh scaffold'"
grep -q 'brew --prefix' "$SKILL/references/environment-setup.md" \
  && ok "ANDROID_HOME uses brew --prefix (Intel-safe)" || bad "hardcoded /opt/homebrew remains"
grep -q 'LAN/QR path only' "$SKILL/references/build-flow/phase-4-iterate.md" \
  && ok "auto-reload claim qualified" || bad "phase-4 still claims blanket auto-reload"
if grep -rq 'Verification is not optional on this path' "$SKILL"; then
  bad "still cites a heading that does not exist"; else ok "heading citation corrected"; fi
BARE=$(grep -rn '[^/.]troubleshooting\.md\|[^/.]environment-setup\.md\|[^/.]plain-language\.md' \
        "$SKILL/references/build-flow/" 2>/dev/null | grep -vc '\.\./' || true)
[ "$BARE" = "0" ] && ok "no bare sibling refs left in phase files" || bad "$BARE bare refs remain"
grep -q 'type="subtitle"' "$SCRIPTS/strip-demo-scaffold.sh" \
  && ok "placeholder no longer overflows its own check" || bad "placeholder still uses 48px title"

grp "F. SDK hard stop (Expo Go pins one version — user-confirmed constraint)"
grep -q 'HARD STOP FOR PATH A' "$SCRIPTS/check-expo-go-sdk.sh" \
  && ok "unverifiable SDK is a hard stop, not an advisory" || bad "still advisory"
grep -q 'Open the Expo Go app on your phone' "$SCRIPTS/check-expo-go-sdk.sh" \
  && ok "directs a concrete question to the user" || bad "no directed action"

grp "G. Live behaviour on example app #2 (multi-screen, SDK 54)"
if [ -d "$APP/.claude/visual" ]; then
  R=$(cd "$APP" && CI=1 timeout 900 bash "$SCRIPTS/ui-validate.sh" 2>&1 | tail -1)
  grep -q "STATUS=pass" <<<"$R" && ok "3 screens incl. animated + dynamic route -> pass" || bad "ui-validate -> $R"
  F=$(cd "$APP" && timeout 900 bash "$SCRIPTS/flow-validate.sh" 2>&1)
  grep -q "NOT REACHED" <<<"$F" && ok "unreached dynamic route reported, not hidden" || bad "dynamic route still silently dropped"
  grep -q "unverified" <<<"$F" && ok "coverage gap stated in words" || bad "no coverage-gap summary"
else skip "example app #2 not present"; fi

grp "RESULT"
printf '  %d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ]
