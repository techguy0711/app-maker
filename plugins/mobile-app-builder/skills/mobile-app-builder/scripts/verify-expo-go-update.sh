#!/usr/bin/env bash
# verify-expo-go-update.sh [projectId|projectDir] [channel] [sdkMajor]
#
# Asks Expo's update server for a bundle EXACTLY the way Expo Go asks for one,
# and reports whether the user's phone would actually receive it.
#
# WHY THIS EXISTS: on the EAS Update fallback (build-flow.md Phase 3, "When the
# dev server can't reach the phone at all") every command in the publish
# sequence reports success — `eas update` prints "✔ Published!" — while the
# update can still be unloadable on the phone. The whole failure lives on the
# user's device: the QR scans, Expo Go opens, and nothing happens. Nothing is
# printed anywhere you can see.
#
# Confirmed live: `eas update:configure` writes a runtime version of
# {"policy":"appVersion"}, which stamps updates `1.0.0`. Expo Go only ever asks
# for `exposdk:NN.0.0`. The mismatch answers HTTP 204 No Content — not an error
# status, no message, no body. A missing channel answers 404 with a message you
# also never see, because nothing on the publish side reads this endpoint.
#
# So run this before handing the user a QR code, every time. It is to Phase 3
# what check-expo-go-sdk.sh is to Phase 2: the cheap check that stops a
# confidently-wrong handoff.
#
#   Exit: 0  the phone will get a bundle
#         1  it will not — the reason and the fix are printed
#         2  the check could not run (bad arguments, no network)

set -uo pipefail

ARG1="${1:-.}"
CHANNEL="${2:-preview}"
SDK_MAJOR="${3:-}"

UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

# A project ID is a UUID; anything else is a directory to read one out of.
if printf '%s' "$ARG1" | grep -Eq "$UUID_RE"; then
  PROJECT_ID="$ARG1"
  PROJECT_DIR="$PWD"
else
  PROJECT_DIR="$(cd "$ARG1" 2>/dev/null && pwd -P)" || {
    echo "[ERROR] Not a project ID and not a directory: $ARG1" >&2
    exit 2
  }
  # eas init writes the ID to app.json in one of two shapes depending on CLI
  # version — extra.eas.projectId, or the tail of updates.url. Read both.
  PROJECT_ID="$(node -e '
    const fs = require("fs");
    const p = process.argv[1] + "/app.json";
    try {
      const e = (JSON.parse(fs.readFileSync(p, "utf8")).expo) || {};
      const id = e?.extra?.eas?.projectId
        || (e?.updates?.url || "").split("/").filter(Boolean).pop();
      if (id) process.stdout.write(id);
    } catch {}
  ' "$PROJECT_DIR" 2>/dev/null)"

  if [ -z "$PROJECT_ID" ]; then
    echo "[ERROR] No EAS project ID in $PROJECT_DIR/app.json." >&2
    echo "        The project isn't linked to EAS yet — run" >&2
    echo "        'eas init --non-interactive --force' first (build-flow.md," >&2
    echo "        Phase 3, the EAS Update fallback)." >&2
    exit 2
  fi
fi

# Expo Go asks for the runtime version of the SDK it ships, so the SDK the
# project is pinned to is the thing to ask about.
if [ -z "$SDK_MAJOR" ]; then
  SDK_MAJOR="$(node -e '
    const fs = require("fs");
    for (const rel of ["/node_modules/expo/package.json", "/package.json"]) {
      try {
        const j = JSON.parse(fs.readFileSync(process.argv[1] + rel, "utf8"));
        const v = rel.includes("node_modules") ? j.version : (j.dependencies || {}).expo;
        const m = String(v || "").match(/\d+/);
        if (m) { process.stdout.write(m[0]); break; }
      } catch {}
    }
  ' "$PROJECT_DIR" 2>/dev/null)"
fi

if [ -z "$SDK_MAJOR" ]; then
  echo "[ERROR] Could not work out which Expo SDK this project uses." >&2
  echo "        Pass it explicitly: verify-expo-go-update.sh <id> <channel> 54" >&2
  exit 2
fi

RUNTIME="exposdk:${SDK_MAJOR}.0.0"
URL="https://u.expo.dev/$PROJECT_ID"

echo "Expo Go update check"
echo "  project: $PROJECT_ID"
echo "  channel: $CHANNEL"
echo "  runtime: $RUNTIME   (what Expo Go asks for — not what appVersion sets)"
echo ""

ask() {
  # Every header here matters: without the protocol/api version headers the
  # server answers a legacy manifest shape and the status stops being a
  # trustworthy answer to "would the phone load this".
  curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" \
    -H "expo-platform: $1" \
    -H "expo-runtime-version: $RUNTIME" \
    -H "expo-channel-name: $CHANNEL" \
    -H "expo-protocol-version: 1" \
    -H "expo-api-version: 1" \
    -H "accept: multipart/mixed" 2>/dev/null
}

RC=0
SAW_204=0
SAW_404=0
SAW_OTHER=""

for PLATFORM in ios android; do
  CODE="$(ask "$PLATFORM")"
  case "$CODE" in
    200)
      printf '  %-8s %s  OK — Expo Go will load this update\n' "$PLATFORM" "$CODE"
      ;;
    204)
      printf '  %-8s %s  NO UPDATE — runtime version mismatch\n' "$PLATFORM" "$CODE"
      SAW_204=1; RC=1
      ;;
    404)
      printf '  %-8s %s  NO CHANNEL named "%s"\n' "$PLATFORM" "$CODE" "$CHANNEL"
      SAW_404=1; RC=1
      ;;
    000|"")
      printf '  %-8s ---  could not reach %s\n' "$PLATFORM" "$URL"
      RC=2
      ;;
    *)
      printf '  %-8s %s  unexpected — treat as "do not hand over the QR yet"\n' "$PLATFORM" "$CODE"
      SAW_OTHER="$CODE"; RC=1
      ;;
  esac
done

echo ""
if [ "$RC" -eq 0 ]; then
  echo "[OK] Safe to build the QR code and hand it to the user."
  exit 0
fi

if [ "$RC" -eq 2 ]; then
  echo "[WARN] The check itself couldn't run (network). This is NOT a pass —"
  echo "       do not hand over a QR code on the strength of 'Published!'."
  exit 2
fi

echo "[FAIL] The QR code would open Expo Go and then do nothing. Don't send it."
echo ""

if [ "$SAW_204" -eq 1 ]; then
  echo "  204 — published fine, but under a runtime version Expo Go never asks"
  echo "        for. eas update:configure sets {\"policy\":\"appVersion\"}, which"
  echo "        stamps updates 1.0.0. Publish with the Expo Go runtime version"
  echo "        instead (the app.config.js override in build-flow.md Phase 3),"
  echo "        then re-run this check."
  echo ""
fi

if [ "$SAW_404" -eq 1 ]; then
  echo "  404 — the branch exists but the channel doesn't. 'eas update --branch X'"
  echo "        creates a BRANCH; Expo Go asks for a CHANNEL. Run"
  echo "        'eas channel:create $CHANNEL --non-interactive', then re-run."
  echo ""
fi

if [ -n "$SAW_OTHER" ]; then
  echo "  $SAW_OTHER — not a status this check knows how to explain. A 400 usually"
  echo "        means the project ID is wrong or the project doesn't exist;"
  echo "        401/403 means EXPO_TOKEN is missing, wrong, or lacks access."
  echo "        Confirm the ID against app.json's expo.updates.url, then re-run."
  echo ""
fi

exit 1
