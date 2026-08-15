# Phase 3, Path B — Preview via a development build

**Read this when:** Phase 0.5 said the app needs a development build.
**The QR-code flow does not apply at all on this path** — say so to the user up front rather than letting them wait for a QR code that will never come.

Say this up front, plainly, before doing anything else in this phase: "The
quick scan-a-QR-code preview isn't available for this app, because it uses
a couple of features your phone's basic preview app doesn't include. I'll
still get a real version running on your phone — it just needs one extra
build step first, which I'll walk you through." Don't let the user sit
waiting for a QR code that Path A would have produced by now but this path
never will — say why immediately, not after they ask.

### Install expo-dev-client — this is what makes it a dev build at all

Use the `expo:expo-dev-client` skill now, before scaffolding any further or
kicking off a build. Installing the `expo-dev-client` package
(`npx expo install expo-dev-client`) and letting that skill walk through its
config is the actual step that turns a plain Expo project into one that can
produce a development build — everything else in this section (EAS profiles,
`eas build`, simulators) is mechanics layered on top of that. Skipping it and
going straight to `eas build --profile development` is not a shortcut; the
build config that profile expects assumes the package and its config plugin
are already present.

One sharp edge worth knowing before it costs a debugging cycle: **`expo run:ios
--port X` / `expo run:android --port X` only takes effect if expo-dev-client
is installed.** The port a dev build connects to arrives via a deep link
baked into the client at build/launch time — without expo-dev-client, there's
no deep-link mechanism to carry it, so the flag is silently accepted and does
nothing. This compounds with the stale-server problem in `troubleshooting.md`
("A stale `expo start` from a different project silently hijacks a dev
build"): passing `--port`
looks like it should fix a port collision, and on this path it won't, with no
error telling you why.

### The decision: Android vs iOS

The two platforms are not symmetric here, in cost or in what you can do
without the user. Lay this out for them before picking a direction:

- **Android is the cheap escape hatch.** `eas build --platform android
  --profile development` (via `expo:eas-app-stores`) compiles a real,
  installable APK entirely in Expo's cloud — zero local Android tooling,
  and no paid account of any kind. Google's $25 Play Console fee is only
  for *publishing* to the Play Store later; it is not needed to build or
  install this APK. The user (or you, walking them through it) downloads
  the APK link EAS gives you and installs it directly on any Android
  phone — no store, no review, no waiting.
- **iOS on a physical device has no free path.** A development build via
  EAS needs an Apple Developer Program membership ($99/yr) to sign it,
  full stop. Xcode's own free "personal team" 7-day sideloading exists,
  but it's an Xcode-only feature — it requires full Xcode.app installed
  locally and the device connected by cable, and expires and needs
  reinstalling every 7 days. It is not a free alternative to the EAS path;
  it's a different, heavier path that still ends up needing Xcode.
- **iOS locally needs full Xcode.app**, which `environment-setup.md`
  already correctly marks USER MUST CLICK: App Store only, the user's own
  Apple ID sign-in, 10–40GB, no CLI install path at all. Surface the
  scheduling consequence of this plainly, especially if it's the only
  option on the table: if the user is iPhone-only and doesn't have Xcode
  installed, they are blocked on a multi-hour download that only *they*
  can start (the App Store sign-in gate). Say so as soon as you know it,
  so it isn't a surprise sprung in the middle of a build.
- **The `expo:eas-simulator` skill** (a paid EAS cloud service) is the way
  to verify iOS behavior without touching local Xcode at all — the
  practical answer when the user wants iOS checked but has no Mac, no
  Xcode, or no patience for the App Store download.

**Rule of thumb, and the reason Android is the sensible fallback whenever
Xcode is off the table:** Android's entire toolchain — command-line SDK,
emulator, AVD — can be bootstrapped end-to-end by you, the agent, with a
single ASK FIRST go-ahead (see `environment-setup.md`'s Android section:
no GUI wizard, no account, no human-only gate anywhere in it). iOS cannot
be bootstrapped at all — every real iOS path terminates in a step only a
human can click through (an App Store sign-in, a developer-account
sign-up). That asymmetry, not just the dollar cost, is why Android is the
default suggestion whenever the user doesn't already have Xcode sitting
there installed.

### Verification is not required for Path A. It is not optional for Path B.

`SKILL.md` says "never hand a broken bundle to a non-technical user." On
Path A, `tsc` and `ui-validate.sh` mostly cover this, and the user's own
phone is right there catching anything left over within seconds of a
reload. Path B quietly breaks that promise if you let it: with no simulator
or emulator in the loop, you have no way to catch a runtime bug before the
user does, and *they* become the test harness — exactly what this skill
exists to prevent.

So on Path B, obtaining some target you can actually drive yourself — a
local iOS Simulator, the `expo:eas-simulator` cloud simulator, or an
Android emulator — and tapping through the app's real features on it is a
required step before you tell the user it's ready, not an optional nicety.
This is not hypothetical: in one real session, two runtime bugs surfaced
only this way, and both would otherwise have reached the user as silent,
unexplained failure —

- A `setAudioModeAsync` option that threw at call time and silently killed
  the entire recording flow. `tsc --noEmit` and `expo-doctor` both stayed
  clean; the button just did nothing.
- A screen that called `player.pause()` inside its unmount cleanup, after
  the native player object had already been released by the platform —
  invisible until you actually navigated away from that screen on a real
  runtime and watched it happen.

Neither is a type error or a dependency mismatch, so neither shows up in
any check this skill runs before Phase 3. A simulator you can actually
drive is the only thing standing between a bug like this and the user
concluding the app — or the whole idea of an AI-built app — just doesn't
work.

---

**Next → `phase-4-iterate.md`** — take their feedback and turn it into changes.
