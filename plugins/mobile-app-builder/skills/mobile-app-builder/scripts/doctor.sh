#!/usr/bin/env bash
# Environment report for the mobile-app-builder skill.
# Detection ONLY — this script never installs or changes anything.
# Run it, read the output, then follow references/environment-setup.md
# for the exact install command for anything marked MISSING.

set -uo pipefail

OS="$(uname -s)"
ARCH="$(uname -m)"

hr() { printf '%s\n' "----------------------------------------"; }
have() { command -v "$1" >/dev/null 2>&1; }

echo "=== System ==="
echo "OS:   $OS"
echo "Arch: $ARCH"
if [ "$OS" = "Darwin" ]; then
  sw_vers 2>/dev/null | sed 's/^/  /'
fi
case "$(pwd)" in
  *' '*)
    echo "[WARN]    Current directory path contains a space."
    echo "          Fine for the Expo Go path. For a development build (Phase"
    echo "          0.5 / Path B), a space in the project path is a known"
    echo "          source of build failures in Xcode/CocoaPods build phases"
    echo "          and in expo-constants' iOS config script — see"
    echo "          troubleshooting.md before building from here."
    ;;
esac
hr

echo "=== Core tools (needed for every path) ==="

if have node; then
  echo "[OK]      Node.js  $(node -v)"
else
  echo "[MISSING] Node.js"
fi

if have npm; then
  echo "[OK]      npm      $(npm -v)"
else
  echo "[MISSING] npm"
fi

if have git; then
  echo "[OK]      git      $(git --version | awk '{print $3}')"
else
  echo "[MISSING] git"
fi

if [ "$OS" = "Darwin" ] || [ "$OS" = "Linux" ]; then
  if have brew; then
    echo "[OK]      Homebrew $(brew --version | head -1 | awk '{print $2}')"
  else
    echo "[MISSING] Homebrew (used to install everything else below on this OS)"
  fi
fi

if [ "$OS" = "Darwin" ]; then
  if have watchman; then
    echo "[OK]      Watchman $(watchman --version 2>/dev/null)"
  else
    echo "[MISSING] Watchman (recommended, not required — speeds up file watching)"
  fi
fi
hr

echo "=== EAS / Expo CLI ==="
if have eas; then
  echo "[OK]      eas-cli  $(eas --version 2>/dev/null)"
else
  echo "[MISSING] eas-cli (needed for cloud builds / app store submission)"
fi
echo "[OK]      npx expo   (no install needed — runs on demand via npx)"
hr

echo "=== iOS (macOS only) ==="
if [ "$OS" != "Darwin" ]; then
  echo "[N/A]     iOS local simulator is only possible on macOS."
  echo "          On $OS, iOS testing works via a physical iPhone + Expo Go,"
  echo "          or a cloud simulator (EAS). No local iOS install applies here."
else
  if have xcodebuild && xcodebuild -version >/dev/null 2>&1; then
    echo "[OK]      Full Xcode.app installed — $(xcodebuild -version | head -1)"
    echo "          iOS Simulator is available locally."
  else
    echo "[MISSING] Full Xcode.app (only source: Mac App Store — cannot be scripted)"
    echo "          iOS Simulator is NOT available. Use a physical iPhone + Expo Go,"
    echo "          or the EAS cloud simulator, instead of installing Xcode."
  fi

  if xcode-select -p >/dev/null 2>&1; then
    echo "[OK]      Xcode Command Line Tools present ($(xcode-select -p))"
  else
    echo "[MISSING] Xcode Command Line Tools"
  fi

  if have pod; then
    echo "[OK]      CocoaPods $(pod --version 2>/dev/null)"
  else
    echo "[MISSING] CocoaPods (only needed for local/bare iOS builds, not for EAS cloud builds)"
  fi
fi
hr

echo "=== Android ==="
ANDROID_APP_MAC="/Applications/Android Studio.app"
if [ "$OS" = "Darwin" ] && [ -d "$ANDROID_APP_MAC" ]; then
  echo "[OK]      Android Studio.app installed"
elif [ "$OS" = "Linux" ] && have android-studio; then
  echo "[OK]      Android Studio installed"
else
  echo "[MISSING] Android Studio (GUI app — optional, only needed to SEE a local emulator window)"
fi

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -n "$ANDROID_SDK" ] && [ -d "$ANDROID_SDK" ]; then
  echo "[OK]      Android SDK found at $ANDROID_SDK"
else
  echo "[MISSING] Android SDK (ANDROID_HOME not set / not found)"
fi

if have adb; then
  echo "[OK]      adb (Android Debug Bridge)"
else
  echo "[MISSING] adb"
fi

if have emulator; then
  echo "[OK]      Android emulator binary"
else
  echo "[MISSING] Android emulator binary"
fi

if have java && java -version >/dev/null 2>&1; then
  echo "[OK]      Java $(java -version 2>&1 | head -1)"
else
  echo "[MISSING] Java (macOS ships a stub at /usr/bin/java that fails until a JDK is"
  echo "          installed — it's bundled with Android Studio; only needed for local"
  echo "          Android builds, not for EAS cloud builds)"
fi
hr

echo "=== Verdict: Expo Go path (Phase 0.5 said this app fits Expo Go) ==="
echo "Needs none of the [MISSING] items above except Node.js, npm, and git"
echo "under 'Core tools': scaffold with npx create-expo-app, run npx expo"
echo "start, and preview live on a physical phone with the Expo Go app (free,"
echo "from the App Store / Play Store). No Xcode, no Android Studio, no"
echo "simulators required — for building OR for the final app-store release"
echo "(EAS Build compiles in the cloud)."
echo ""
echo "Only chase the other [MISSING] items on this path if the user"
echo "specifically wants a local on-screen simulator/emulator instead of"
echo "using their own phone."
hr

echo "=== Verdict: development-build path (Phase 0.5 said this app needs one) ==="
echo "This is a different tooling story — read build-flow.md's Path B before"
echo "acting on any of this. Summary of what each route actually needs:"
echo ""
echo "Android (the cheap route):"
echo "  eas-cli is the only thing required locally, and EAS Build compiles"
echo "  the development APK in the cloud — no Android Studio, no SDK, no"
echo "  paid account. Install the APK straight on any Android phone."
echo ""
echo "iOS on a physical device:"
echo "  No free path exists. An Apple Developer Program membership (\$99/yr)"
echo "  is required to sign a development build, whether built via EAS or"
echo "  locally with Xcode."
echo ""
echo "iOS verification without a paid Apple account or local Xcode:"
echo "  Use the expo:eas-simulator cloud service (also paid, separately from"
echo "  the Apple account) instead of installing Xcode."
echo ""
echo "iOS locally (full Xcode.app):"
if have xcodebuild && xcodebuild -version >/dev/null 2>&1; then
  echo "  [OK] Already installed on this machine — local iOS Simulator is"
  echo "  available as a drivable verification target for Path B."
else
  echo "  [MISSING] This machine has no local iOS Simulator available. Getting"
  echo "  one requires the full Xcode.app install, which is USER MUST CLICK"
  echo "  (App Store sign-in, 10-40GB, no CLI path — see environment-setup.md)."
  echo "  If the user is iPhone-only with no Xcode, that download is a"
  echo "  scheduling blocker only they can start — say so early, not mid-build."
fi
echo ""
echo "Whichever route is used, Path B requires actually driving a real"
echo "target (simulator or emulator) yourself before calling the app ready —"
echo "see 'Verification is not optional on this path' in build-flow.md."
echo ""
echo "See references/environment-setup.md for exact, copy-pasteable install"
echo "commands and which ones can run unattended vs need the user to click"
echo "something themselves."
