#!/usr/bin/env bash
# Environment report for the app-maker skill.
# Detection ONLY — this script never installs or changes anything.
# Run it, read the output, then follow references/environment-setup.md
# for the exact install command for anything marked MISSING.

set -uo pipefail

OS="$(uname -s)"
ARCH="$(uname -m)"

hr() { printf '%s\n' "----------------------------------------"; }
have() { command -v "$1" >/dev/null 2>&1; }

# Same lookup make-preview-qr.sh uses, so Phase 1 and Phase 3 can never
# disagree about whether this machine has a routable address.
get_lan_ip() {
  local ip=""
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 en2; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      [ -n "$ip" ] && break
    done
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')"
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip" ]; then
    ip="$(ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)"
  fi
  echo "$ip"
}

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

echo "=== Network: can this shell reach the user's phone? ==="
# WHY THIS IS HERE AND NOT IN TROUBLESHOOTING: the answer decides how Phase 3
# delivers the app, it is knowable right now, and the fallback route needs an
# access token only the user can create. Found at Phase 1 it's a question asked
# while the app is being built. Found at Phase 3 it's a hard stop with every
# screen already written — which is exactly how it went in a real session.
LAN_IP="$(get_lan_ip)"
PREVIEW_DELIVERY="lan"

if [ -z "$LAN_IP" ]; then
  echo "[WARN]    No LAN IP address found."
  echo "          An ordinary desktop always has one. Its absence means this"
  echo "          shell is almost certainly not on the user's own network."
  PREVIEW_DELIVERY="eas-update"
else
  case "$LAN_IP" in
    192.0.2.*|198.51.100.*|203.0.113.*)
      echo "[WARN]    LAN IP is $LAN_IP — RFC 5737 TEST-NET."
      echo "          Those three ranges are reserved for documentation and can"
      echo "          never be a real host, so nothing can route to a phone from"
      echo "          here. This is a sandboxed or remote session."
      PREVIEW_DELIVERY="eas-update"
      ;;
    127.*|169.254.*)
      echo "[WARN]    LAN IP is $LAN_IP — loopback/link-local, not reachable"
      echo "          from any other device."
      PREVIEW_DELIVERY="eas-update"
      ;;
    *)
      echo "[OK]      LAN IP $LAN_IP — a phone on the same Wi-Fi can reach this"
      echo "          machine."
      ;;
  esac
fi

# Routable-to and reachable-from are two different questions, and until now
# only the first was asked. The LAN check above answers "can a phone reach this
# shell"; it says nothing about whether *this shell* can reach Expo. A
# restricted sandbox commonly fails both at once — no real LAN IP *and*
# allowlisted egress — and in that case recommending EAS Update sends the agent
# to ask the user for an access token that cannot possibly work. That is worse
# than saying nothing: it spends the one thing only the user can give on a
# route with no payoff. Probed only once the LAN route is already ruled out, so
# the normal path still makes no network call.
#
# The URL is deliberately the same one check-expo-go-sdk.sh already uses. That
# script's happy path parses `expoGoSdkVersion` out of this response, so the
# endpoint is known-good against the live API — whereas a plausible-looking
# guess (`/v2/versions`, no `/latest`) would fail `curl -f` on a 404 and report
# "unreachable" on a perfectly healthy network, suppressing a token ask that
# should have happened. Keep the two in sync; if one moves, move both.
EXPO_PROBE_URL="${EXPO_PROBE_URL:-https://api.expo.dev/v2/versions/latest}"
expo_api_reachable() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null --max-time 8 "$EXPO_PROBE_URL" >/dev/null 2>&1
  elif command -v node >/dev/null 2>&1; then
    node -e '
      const t = setTimeout(() => process.exit(1), 8000);
      require("https")
        .get(process.argv[1], (r) => {
          clearTimeout(t);
          process.exit(r.statusCode && r.statusCode < 400 ? 0 : 1);
        })
        .on("error", () => { clearTimeout(t); process.exit(1); });
    ' "$EXPO_PROBE_URL" >/dev/null 2>&1
  else
    return 1
  fi
}

if [ "$PREVIEW_DELIVERY" = "eas-update" ]; then
  if expo_api_reachable; then
    echo "[OK]      api.expo.dev is reachable — the EAS Update fallback is viable."
  else
    echo "[WARN]    api.expo.dev is NOT reachable from this shell either."
    echo "          Egress is restricted here (sandbox allowlist, proxy, or"
    echo "          simply offline). EAS Update publishes through that API, so"
    echo "          the fallback route is unavailable too. Do NOT ask the user"
    echo "          for an access token — see the preview-delivery verdict."
    PREVIEW_DELIVERY="none"
  fi
fi

if [ -n "${EXPO_TOKEN:-}" ]; then
  echo "[OK]      EXPO_TOKEN is set — non-interactive EAS auth is available."
else
  echo "[MISSING] EXPO_TOKEN is not set. Only needed if preview delivery falls"
  echo "          back to EAS Update — see the preview-delivery verdict below."
fi
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
  echo "          installed. Only needed for local Android builds, not EAS cloud"
  echo "          builds — but if the command-line SDK tools path is in use (the"
  echo "          default, no Android Studio.app), this is a hard prerequisite, not"
  echo "          optional: sdkmanager is itself a Java program and won't run at all"
  echo "          without a JDK. See environment-setup.md's Android section, step 3.)"
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

echo "=== Verdict: preview delivery (how Phase 3 gets the app onto the phone) ==="
case "$PREVIEW_DELIVERY" in
  lan)
    echo "LAN — the normal route, and the fast one."
    echo "  npx expo start, then make-preview-qr.sh <port>. The phone and this"
    echo "  machine have to be on the same Wi-Fi. If a scan fails, try"
    echo "  'npx expo start --tunnel' next — not EAS Update; a tunnel is much"
    echo "  cheaper and needs no account."
    ;;
  eas-update)
    echo "EAS Update — LAN and tunnel are both structurally unavailable here."
    echo "Don't spend any of Phase 3 trying them. They cannot work from this"
    echo "shell, and confirming that by trial and error only costs the user a"
    echo "wait for something that was never going to succeed."
    echo ""
    echo "ASK FOR THE TOKEN NOW, NOT AT PHASE 3. This route authenticates with"
    echo "an Expo access token, and only the user can create one. Asking while"
    echo "the app is still being built costs them a minute; leaving it until"
    echo "Phase 3 makes it a hard stop with every screen already written."
    echo ""
    echo "  Say roughly: \"One thing only you can do, whenever you get a"
    echo "  minute — go to expo.dev, sign in (free), open Settings then Access"
    echo "  Tokens, click Create token, and paste it back to me. I'll keep"
    echo "  building meanwhile.\""
    echo ""
    echo "  Then: export EXPO_TOKEN=\"<what they paste>\""
    echo ""
    echo "Full command sequence: build-flow/phase-3-preview-expo-go.md, 'When the dev server"
    echo "can't reach the phone at all'. Run verify-expo-go-update.sh before"
    echo "handing over a QR code — a successful publish is not evidence the"
    echo "phone can load it."
    ;;
  none)
    echo "NONE — this shell cannot put a preview on the phone by any route."
    echo "LAN and tunnel are structurally unavailable (no routable address to"
    echo "this machine), and api.expo.dev is unreachable, so EAS Update is out"
    echo "as well. All three of Phase 3's options are gone."
    echo ""
    echo "DO NOT ASK FOR AN EXPO ACCESS TOKEN. It changes nothing from here,"
    echo "and asking spends the user's attention on a task with no payoff."
    echo ""
    echo "What does still work, and is worth saying out loud early:"
    echo "  1. Everything up to Phase 3 runs fine offline. Scaffolding, tsc,"
    echo "     ui-validate.sh and flow-validate.sh all work against the npm"
    echo "     registry alone. A web export ('npx expo export --platform web')"
    echo "     rendered in the visual loop's own Chromium gives you real"
    echo "     screenshots of the real app to show the user in conversation —"
    echo "     that is the substitute for the phone here, and it is a decent"
    echo "     one for everything except native fidelity."
    echo "  2. The phone step moves to the user's own machine, where LAN, QR,"
    echo "     simulators and EAS all behave normally:"
    echo "       npm install && npx expo start"
    echo ""
    echo "Tell the user this at Phase 1, in one plain sentence — that they'll"
    echo "run the last step themselves and you'll show them pictures until"
    echo "then. A non-technical user who is waiting for a QR code that was"
    echo "never coming reads the silence as the thing being broken."
    ;;
esac
hr

echo "=== Verdict: development-build path (Phase 0.5 said this app needs one) ==="
echo "This is a different tooling story — read build-flow/phase-3-preview-dev-build.md before"
echo "acting on any of this. Summary of what each route actually needs:"
echo ""
echo "Android (the cheap route):"
echo "  eas-cli is the only thing required locally, and EAS Build compiles"
echo "  the development APK in the cloud — no Android Studio, no SDK, no"
echo "  paid account. Install the APK straight on any Android phone."
echo "  The expo-dev-client package still needs to be installed IN THE"
echo "  PROJECT first (via the expo:expo-dev-client skill) — that's what"
echo "  makes it a dev build at all, not just the EAS profile."
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
echo "see 'Verification is not required for Path A. It is not optional for Path B.' in build-flow/phase-3-preview-dev-build.md."
echo ""
echo "See references/environment-setup.md for exact, copy-pasteable install"
echo "commands and which ones can run unattended vs need the user to click"
echo "something themselves."
