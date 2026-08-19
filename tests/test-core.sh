#!/usr/bin/env bash
# Test harness for the restricted-egress patch. Every check states what it
# proves; anything unproven is reported as SKIP, never quietly as a pass.
set -uo pipefail

PASS=0; FAIL=0; SKIP=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[33mSKIP\033[0m  %s\n' "$1"; SKIP=$((SKIP+1)); }
grp()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$seconds" "$@"
  else
    perl -e '$seconds = shift; alarm $seconds; exec @ARGV' "$seconds" "$@"
  fi
}

check() { # check <desc> <expected-substring> <<< actual
  local desc="$1" want="$2" got; got="$(cat)"
  if grep -qF -- "$want" <<<"$got"; then ok "$desc"; else
    bad "$desc"; printf '        wanted: %s\n        got:    %s\n' "$want" "$(head -c 200 <<<"$got")"
  fi
}

# The live checks cd into the example project, so keep the skill path absolute
# or every script call silently starts resolving relative to the app instead.
SKILL="$(cd "$1" && pwd -P)" # path to the PATCHED skill dir
SCRIPTS="$SKILL/scripts"

grp "1. Static checks"
for f in doctor.sh ui-validate.sh setup-visual-loop.sh; do
  if bash -n "$SCRIPTS/$f" 2>/dev/null; then ok "bash -n $f"; else bad "bash -n $f"; fi
done
if command -v shellcheck >/dev/null 2>&1; then
  for f in doctor.sh ui-validate.sh setup-visual-loop.sh; do
    if shellcheck -S error "$SCRIPTS/$f" >/dev/null 2>&1; then ok "shellcheck (errors) $f"
    else bad "shellcheck (errors) $f"; fi
  done
else
  skip "shellcheck not installed"
fi
# The two scripts that hit Expo must agree on the endpoint, or the probe can
# report unreachable on a healthy network.
# Compare only the URL, stripping any shell-expansion punctuation around it.
urlof() { grep -oE 'https://api\.expo\.dev[A-Za-z0-9/._-]*' "$1" | head -1; }
D_URL=$(urlof "$SCRIPTS/doctor.sh"); C_URL=$(urlof "$SCRIPTS/check-expo-go-sdk.sh")
if [ -n "$D_URL" ] && [ "$D_URL" = "$C_URL" ]; then
  ok "probe endpoint matches check-expo-go-sdk.sh ($D_URL)"
else bad "endpoint drift: doctor=$D_URL check=$C_URL"; fi
# env -u is a GNU/BSD portability trap on macOS. Check EXECUTABLE lines only —
# the first version of this test matched the comment that explains the choice.
nocomment() { sed 's/[[:space:]]*#.*$//' "$1"; }
if nocomment "$SCRIPTS/ui-validate.sh" | grep -q 'env -u'; then
  bad "ui-validate.sh executes 'env -u' (BSD/macOS portability risk)"
else ok "ui-validate.sh avoids 'env -u' in executable code (macOS-safe)"; fi
# And prove the mechanism it uses instead actually clears the var.
R=$(CI=1 bash -c '( unset CI CONTINUOUS_INTEGRATION; node -e "process.stdout.write(String(process.env.CI))" )')
[ "$R" = "undefined" ] && ok "subshell unset removes CI from the child env" \
  || bad "subshell unset left CI=$R in child env"

grp "2. doctor.sh — probe branches"
# Make the branch deterministic: a developer machine normally has a LAN IP,
# while a sandbox may or may not have network. Neither should decide whether
# this unit test reaches the code it is meant to check.
PROBE_STUB="$(mktemp -d)"
sed 's#^get_lan_ip() {#get_lan_ip() { return 0; #' "$SCRIPTS/doctor.sh" > "$PROBE_STUB/doctor.sh"
mkdir -p "$PROBE_STUB/bin"
cat > "$PROBE_STUB/bin/curl" <<'SH'
#!/usr/bin/env bash
for arg in "$@"; do URL="$arg"; done
case "${URL:-}" in
  *reachable.test*) exit 0 ;;
  *) exit 1 ;;
esac
SH
chmod +x "$PROBE_STUB/bin/curl"
PATH="$PROBE_STUB/bin:$PATH" EXPO_PROBE_URL=https://unreachable.invalid \
  bash "$PROBE_STUB/doctor.sh" 2>&1 | check "unreachable probe -> WARN" "api.expo.dev is NOT reachable"
PATH="$PROBE_STUB/bin:$PATH" EXPO_PROBE_URL=https://unreachable.invalid \
  bash "$PROBE_STUB/doctor.sh" 2>&1 | check "unreachable probe -> NONE verdict" "NONE — this shell cannot put a preview"
PATH="$PROBE_STUB/bin:$PATH" EXPO_PROBE_URL=https://unreachable.invalid \
  bash "$PROBE_STUB/doctor.sh" 2>&1 | check "unreachable probe -> forbids token ask" "DO NOT ASK FOR AN EXPO ACCESS TOKEN"
PATH="$PROBE_STUB/bin:$PATH" EXPO_PROBE_URL=https://reachable.test \
  bash "$PROBE_STUB/doctor.sh" 2>&1 \
  | check "reachable probe -> OK line" "api.expo.dev is reachable"
PATH="$PROBE_STUB/bin:$PATH" EXPO_PROBE_URL=https://reachable.test \
  bash "$PROBE_STUB/doctor.sh" 2>&1 \
  | check "reachable probe -> keeps eas-update verdict" "ASK FOR THE TOKEN NOW"
# A verdict must never contain both instructions.
OUT=$(PATH="$PROBE_STUB/bin:$PATH" EXPO_PROBE_URL=https://reachable.test \
  bash "$PROBE_STUB/doctor.sh" 2>&1)
if grep -qF "DO NOT ASK FOR AN EXPO ACCESS TOKEN" <<<"$OUT"; then
  bad "reachable probe ALSO printed the do-not-ask verdict (mutually exclusive branches leaked)"
else ok "verdicts are mutually exclusive"; fi
# Exit status must stay 0 — it is a report, not a gate.
bash "$SCRIPTS/doctor.sh" >/dev/null 2>&1 && ok "doctor.sh exits 0" || bad "doctor.sh non-zero exit"

grp "3. doctor.sh — LAN path makes no Expo call (claimed in a comment)"
# If a routable LAN IP is found, PREVIEW_DELIVERY stays 'lan' and the probe
# must be skipped entirely. Force it by stubbing an unroutable-but-normal IP.
STUB=$(mktemp -d)
sed 's#^get_lan_ip() {#get_lan_ip() { echo 10.1.2.3; return; #' "$SCRIPTS/doctor.sh" > "$STUB/doctor.sh"
if bash -n "$STUB/doctor.sh" 2>/dev/null; then
  OUT=$(EXPO_PROBE_URL=https://this-host-does-not-exist.invalid bash "$STUB/doctor.sh" 2>&1)
  if grep -qF "LAN IP 10.1.2.3" <<<"$OUT" && ! grep -qF "api.expo.dev is" <<<"$OUT"; then
    ok "LAN verdict reached and probe skipped (no needless network call)"
  else
    bad "LAN path did not skip the probe"
  fi
else skip "could not stub get_lan_ip"; fi

grp "4. ui-validate.sh — the CI=1 regression"
# Was hardcoded to one project path that happened to exist on the machine this
# was written on; when that directory went away, two whole sections silently
# reported SKIP and the suite still looked green.
PROJ="${E2E_DIR:-${2:-}}"
[ -n "$PROJ" ] && PROJ="$(cd "$PROJ" && pwd -P)"
if [ -d "$PROJ/.claude/visual" ]; then
  rm -f "$PROJ/.claude/visual/attempts.json"
  R=$(cd "$PROJ" && CI=1 run_with_timeout 600 bash "$SCRIPTS/ui-validate.sh" 2>&1 | tail -1)
  grep -q "STATUS=pass" <<<"$R" && ok "CI=1 -> STATUS=pass (was: fail/0 forever)" || bad "CI=1 -> $R"
  R=$(cd "$PROJ" && CONTINUOUS_INTEGRATION=1 run_with_timeout 600 bash "$SCRIPTS/ui-validate.sh" 2>&1 | tail -1)
  grep -q "STATUS=pass" <<<"$R" && ok "CONTINUOUS_INTEGRATION=1 -> STATUS=pass" || bad "CONT_INT=1 -> $R"
  R=$(cd "$PROJ" && run_with_timeout 600 bash "$SCRIPTS/ui-validate.sh" 2>&1 | tail -1)
  grep -q "STATUS=pass" <<<"$R" && ok "no CI -> STATUS=pass (no regression)" || bad "clean -> $R"
  # CI must not leak back out of the subshell into the caller's environment.
  R=$(cd "$PROJ" && CI=1 bash -c 'bash "$0" >/dev/null 2>&1; echo "CI=$CI"' "$SCRIPTS/ui-validate.sh")
  [ "$R" = "CI=1" ] && ok "CI not clobbered in caller env (subshell contained)" || bad "CI leaked: $R"
else skip "no built project to validate against"; fi

grp "5. setup-visual-loop.sh"
if [ -d "$PROJ" ]; then
  cp -r "$PROJ/.claude/visual" /tmp/vis-backup-$$ 2>/dev/null
  R=$(cd "$PROJ" && run_with_timeout 600 bash "$SCRIPTS/setup-visual-loop.sh" 2>&1 | tail -1)
  grep -q "STATUS=ready" <<<"$R" && ok "browser present -> ready" || bad "browser present -> $R"
  grep -q "chromium already usable, skipping download" "$PROJ/.claude/logs/setup.log" \
    && ok "reuses preinstalled browser (no CDN fetch)" || bad "did not reuse preinstalled browser"
  # Idempotent: running twice must not corrupt or duplicate anything.
  R=$(cd "$PROJ" && run_with_timeout 600 bash "$SCRIPTS/setup-visual-loop.sh" 2>&1 | tail -1)
  grep -q "STATUS=ready" <<<"$R" && ok "idempotent on second run" || bad "second run -> $R"
  GI=$(grep -c '^\.claude/$' "$PROJ/.gitignore")
  [ "$GI" = "1" ] && ok ".gitignore entry not duplicated" || bad ".gitignore has $GI '.claude/' lines"
  # Browser missing -> config must still land.
  rm -rf "$PROJ/.claude/visual"; mkdir -p /tmp/empty-br-$$ /tmp/no-browser-bin-$$
  cat > /tmp/no-browser-bin-$$/npx <<'SH'
#!/usr/bin/env bash
# The branch under test is the config-written fallback, not Playwright's CDN.
exit 1
SH
  chmod +x /tmp/no-browser-bin-$$/npx
  R=$(cd "$PROJ" && PATH="/tmp/no-browser-bin-$$:$PATH" \
      PLAYWRIGHT_BROWSERS_PATH=/tmp/empty-br-$$ \
      run_with_timeout 600 bash "$SCRIPTS/setup-visual-loop.sh" 2>&1 | tail -1)
  grep -q "CONFIG=written" <<<"$R" && ok "browser missing -> CONFIG=written" || bad "browser missing -> $R"
  N=$(ls "$PROJ/.claude/visual" 2>/dev/null | wc -l)
  [ "$N" -ge 4 ] && ok "all 4 config files written despite browser failure" || bad "only $N config files written"
  rm -rf "$PROJ/.claude/visual" && cp -r /tmp/vis-backup-$$ "$PROJ/.claude/visual"
else skip "no project"; fi

grp "6. End-to-end on a FRESH scaffold (the path all earlier tests skipped)"
E2E="${E2E_DIR:-}"
if [ -z "$E2E" ]; then skip "end-to-end (set E2E_DIR to run)"; else
  cd "$E2E" || exit 1
  # Write a minimal VALID screen first. The placeholder that
  # strip-demo-scaffold.sh leaves behind fails ui-validate.sh on its own
  # (pre-existing, reproduced identically on unpatched scripts), so leaving it
  # in place would test that defect instead of this patch.
  # Template profile differs by SDK: 57 uses src/app/, 54 uses app/. Hardcoding
  # one made this section silently write nowhere on the other.
  APPDIR=$([ -d src/app ] && echo src/app || echo app)
  cat > "$APPDIR/index.tsx" <<'TSX'
import { StyleSheet, Text, View } from 'react-native';

export default function Screen() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>Ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  label: { fontSize: 24, lineHeight: 30 },
});
TSX
  rm -rf .vitest-attachments .claude/visual/tests
  R=$(run_with_timeout 900 bash "$SCRIPTS/setup-visual-loop.sh" 2>&1 | tail -1)
  grep -q "STATUS=ready" <<<"$R" && ok "e2e: setup-visual-loop -> ready" || bad "e2e: setup -> $R"
  npx tsc --noEmit >/dev/null 2>&1 && ok "e2e: tsc --noEmit clean" || bad "e2e: tsc failed"
  R=$(CI=1 run_with_timeout 900 bash "$SCRIPTS/ui-validate.sh" 2>&1 | tail -1)
  grep -qE "STATUS=(pass|seeded)" <<<"$R" && ok "e2e: ui-validate under CI=1 -> $R" || bad "e2e: ui-validate -> $R"
  R=$(run_with_timeout 900 bash "$SCRIPTS/flow-validate.sh" 2>&1 | tail -1)
  grep -q "STATUS=pass" <<<"$R" && ok "e2e: flow-validate -> pass" || bad "e2e: flow-validate -> $R"
  # The patch must not have broken the unrelated scripts it sits beside.
  # Exit 1 offline is the CONTRACT, not a defect: Expo Go pins one SDK, so
  # "couldn't determine" must not read as success. The original assertion here
  # expected exit 0 and was simply wrong about what the script promises.
  OUT=$(bash "$SCRIPTS/check-expo-go-sdk.sh" 2>&1); RC=$?
  [ "$RC" = "1" ] && ok "e2e: check-expo-go-sdk exits 1 when it cannot verify" \
    || bad "e2e: check-expo-go-sdk exit was $RC, expected 1"
  grep -q "HARD STOP FOR PATH A" <<<"$OUT" \
    && ok "e2e: ...and says so as a hard stop, not an advisory" \
    || bad "e2e: unverifiable SDK not escalated to a hard stop"
  node "$SCRIPTS/app-map.mjs" >/dev/null 2>&1 && ok "e2e: app-map.mjs runs" || bad "e2e: app-map failed"
  cd - >/dev/null
fi

grp "RESULT"
printf '  %d passed, %d failed, %d skipped\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ]
