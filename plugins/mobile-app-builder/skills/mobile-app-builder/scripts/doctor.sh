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

echo "=== Verdict ==="
echo "The DEFAULT path needs none of the [MISSING] items above except Node.js,"
echo "npm, and git under 'Core tools': scaffold with npx create-expo-app, run"
echo "npx expo start, and preview live on a physical phone with the Expo Go app"
echo "(free, from the App Store / Play Store). No Xcode, no Android Studio,"
echo "no simulators required — for building OR for the final app-store release"
echo "(EAS Build compiles in the cloud)."
echo ""
echo "Only chase the other [MISSING] items if the user specifically wants a"
echo "local on-screen simulator/emulator instead of using their own phone."
echo "See references/environment-setup.md for exact, copy-pasteable install"
echo "commands and which ones can run unattended vs need the user to click"
echo "something themselves."
