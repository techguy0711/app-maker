#!/usr/bin/env bash
# Prints the Expo SDK version currently supported by the published Expo Go
# app (App Store / Play Store), and the exact create-expo-app flag to
# scaffold a new project directly at that version.
#
# WHY THIS EXISTS: `npx create-expo-app@latest` always scaffolds against the
# newest SDK. Apple/Google review new Expo Go builds after every SDK release,
# and that review can lag the SDK release by weeks — during that window,
# every phone running the store version of Expo Go is stuck on the PREVIOUS
# SDK. Scaffolding at the newest SDK during that window produces a project
# that can never open in Expo Go until either the store catches up or you
# rescaffold at the compatible version. Checking this before every fresh
# scaffold avoids the entire failure class. Verified live in testing:
# SDK 57 shipped June 30, 2026; as of Aug 2026 the store Expo Go still only
# supports SDK 54 — exactly this gap, exactly this failure mode.

set -uo pipefail

RESPONSE="$(curl -fsS --max-time 10 https://api.expo.dev/v2/versions/latest 2>/dev/null)"
CURL_EXIT=$?

if [ $CURL_EXIT -ne 0 ] || [ -z "$RESPONSE" ]; then
  echo "[WARN] Could not reach api.expo.dev to check the store-compatible SDK" >&2
  echo "       (offline, or the API is down). Do not silently fall back to" >&2
  echo "       --template default (@latest) — that risks the exact failure" >&2
  echo "       this check exists to prevent." >&2
  echo "" >&2
  echo "       Options: retry once network is back, or tell the user plainly" >&2
  echo "       that you can't verify Expo Go compatibility right now and ask" >&2
  echo "       whether they'd rather wait or proceed at their own risk." >&2
  exit 1
fi

SDK_VERSION="$(echo "$RESPONSE" | node -e "
let d='';process.stdin.on('data',x=>d+=x);process.stdin.on('end',()=>{
  try {
    const v = JSON.parse(d).data.expoGoSdkVersion;
    if (!v) { process.exit(1); }
    console.log(v);
  } catch (e) { process.exit(1); }
});" 2>/dev/null)"

if [ -z "$SDK_VERSION" ]; then
  echo "[WARN] api.expo.dev responded but 'expoGoSdkVersion' was missing or" >&2
  echo "       unparsable — the API may have changed shape. Don't guess; tell" >&2
  echo "       the user you couldn't verify Expo Go compatibility." >&2
  exit 1
fi

SDK_MAJOR="${SDK_VERSION%%.*}"

echo "Expo Go (App Store / Play Store) currently supports: SDK $SDK_VERSION"
echo ""
echo "Scaffold new projects with:"
echo "  npx create-expo-app@latest <app-name> --template default@sdk-$SDK_MAJOR"
echo ""
echo "Do NOT use --template default (no tag) or --template blank without a tag"
echo "right now — either will silently pull the newest SDK instead, which may"
echo "be ahead of what Expo Go on the user's phone can open."
