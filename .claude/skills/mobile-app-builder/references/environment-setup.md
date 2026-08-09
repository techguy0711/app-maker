# Environment setup — exact commands, per tool

Run `scripts/doctor.sh` first. Only act on items it marks `[MISSING]`, and only
the ones the chosen path (see `build-flow.md`) actually needs. Never install
something "just in case."

Every command below is annotated:
- **AUTO** — safe to just run, then tell the user one sentence about what you did. Small, fast, fully reversible (uninstall with `brew uninstall` / `npm uninstall -g`).
- **ASK FIRST** — large download, long wait, or meaningful disk usage. Tell the user what it is, roughly how big/long, and get a go-ahead before running.
- **USER MUST CLICK** — Apple/Google gate this behind a GUI step or account login. You can kick it off and give exact instructions, but you cannot finish it for them. Say so plainly, don't pretend otherwise, and don't loop retrying it.

## Core tools (macOS)

**Homebrew** — ASK FIRST (installs to `/opt/homebrew`, needs the user's admin password in Terminal, takes a few minutes).
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Node.js** — AUTO (via Homebrew, ~30s).
```bash
brew install node
```

**Watchman** — AUTO (via Homebrew, ~10s). Optional but removes a class of "file changes aren't showing up" bugs.
```bash
brew install watchman
```

**git** — AUTO if missing (rare on macOS; ships with Xcode CLT).
```bash
brew install git
```

**eas-cli** — AUTO (npm global install, ~10s). Needed once the user wants a cloud build or store submission.
```bash
npm install -g eas-cli
```
Note: `npx expo` never needs installing — it downloads the right version on demand per project.

## iOS (macOS only — there is no Windows/Linux equivalent)

**Xcode Command Line Tools** — AUTO to *kick off*, but **USER MUST CLICK** to finish. Running this pops a native macOS dialog; the user has to click "Install" and accept a license themselves. You cannot click it for them.
```bash
xcode-select --install
```
Tell the user: "A macOS popup will appear — click Install, accept the license, and let me know when it's done."

**Full Xcode.app (needed only for a local iOS Simulator)** — **USER MUST CLICK**, full stop. It only ships through the Mac App Store, is 10–40GB, and requires the user's own Apple ID sign-in. There is no CLI install path. You can open the store page for them:
```bash
open "macappstore://apps.apple.com/app/xcode/id497799835"
```
Then say: "I've opened the App Store to Xcode's page — click Get/Install, it'll take a while to download. In the meantime we can keep working using your phone instead of a simulator."

**Default recommendation: skip this entirely.** Use a physical iPhone with the Expo Go app, or the EAS cloud simulator (see `build-flow.md`). Only go through the full Xcode install if the user explicitly wants a local on-screen simulator and doesn't have an iPhone handy.

**CocoaPods** — AUTO, but only needed for local/bare-workflow iOS builds (not for EAS cloud builds or Expo Go).
```bash
brew install cocoapods
```

## Android (macOS, Apple Silicon and Intel)

The GUI app (Android Studio) and the actual SDK/emulator are separate. You can
get a fully working Android emulator **without ever opening a GUI setup
wizard** by installing the command-line SDK tools directly. This is the
reliable path — it doesn't depend on the user clicking through a wizard
correctly.

**1. Android Studio app** — ASK FIRST (~1GB download, several minutes). Optional — only needed if the user wants the visual Android Studio IDE / emulator window manager. Skip if going fully headless.
```bash
brew install --cask android-studio
```

**2. Command-line SDK tools** — ASK FIRST (downloads several hundred MB to a few GB depending on what you install below).
```bash
brew install --cask android-commandlinetools
```
This installs to `/opt/homebrew/share/android-commandlinetools`.

**3. Point environment variables at it** — AUTO. Add to the user's shell profile (`~/.zshrc` on modern macOS):
```bash
ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
{
  echo "export ANDROID_HOME=\"$ANDROID_HOME\""
  echo "export PATH=\"\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator\""
} >> ~/.zshrc
source ~/.zshrc
```

**4. Accept licenses and install SDK packages** — AUTO once the download size has been confirmed with the user (ASK FIRST for the download itself, since system images run 1–2GB). Pick the image matching the chip:
```bash
ARCH_TAG="arm64-v8a"   # Apple Silicon (M1/M2/M3/M4). Use "x86_64" on Intel Macs.
API_LEVEL="35"          # keep in sync with the Expo SDK's target — check `npx expo install --check` output, or use the latest stable

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-$API_LEVEL" \
  "system-images;android-$API_LEVEL;google_apis;$ARCH_TAG" "emulator"
```

**5. Create the virtual phone (AVD)** — AUTO.
```bash
avdmanager create avd -n Pixel_8 \
  -k "system-images;android-$API_LEVEL;google_apis;$ARCH_TAG" -d pixel_8
```

**6. Boot it** — AUTO.
```bash
emulator -avd Pixel_8
```
A real emulator window opens on screen — friendlier for a non-technical user
than a terminal-only flow, and this whole sequence never required them to
click through an install wizard.

**Java** — do not install separately. Android Studio and the command-line
tools both bundle a working JVM; only reach for a standalone JDK
(`brew install openjdk@17`) if a build error specifically demands it.

## Windows / Linux notes

- iOS: there is no local simulator on Windows/Linux, period — not even with
  Xcode, since Xcode is macOS-only. The only iOS testing options are a
  physical iPhone with Expo Go, or EAS's cloud iOS simulator/cloud build.
  Say this plainly and early if the user is on Windows/Linux and wants an
  iPhone app — don't let them expect a local iOS simulator.
- Android on Windows: `winget install Google.AndroidStudio`, then the same
  `sdkmanager`/`avdmanager` steps above work from PowerShell (adjust paths).
- Android on Linux: Android Studio via each distro's package manager or
  `snap install android-studio --classic`; same `sdkmanager` flow after.

## Never do this

- Never run `sudo` installs without telling the user first and explaining why.
- Never attempt to silently script around Apple's App Store login gate (App
  Store password prompts, 2FA) — that's an account-security boundary, not a
  technical inconvenience to route around.
- Never re-run a failed GUI-gated step in a retry loop hoping it completes
  itself. If it needs a click, stop and ask for the click.
