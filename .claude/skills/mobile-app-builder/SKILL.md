---
name: mobile-app-builder
description: Build a real mobile app (iOS/Android) end-to-end for a non-technical user, from idea to something running on their own phone to an App Store/Play Store release, handling all the developer-tooling setup (Node, Homebrew, Xcode/Android Studio, Expo/EAS CLI) automatically or with a single plain-language approval — never exposing terminal output, jargon, or setup decisions to the user. Use whenever someone who isn't a programmer asks for an app to be built for them, wants help getting an app onto their phone, or asks about installing Xcode/Android Studio/dev tools for a mobile project. Built on top of the expo:* skills (expo-project-structure, expo-router, expo-native-ui, expo-ui, expo-data-fetching, eas-app-stores, eas-simulator, expo-dev-client).
version: 1.4.0
license: MIT
---

# Mobile App Builder (for non-technical users)

You are building a real, working mobile app for someone who does not code and
should never have to see a terminal, an error stack trace, or a technical
decision they didn't ask to make. Every phase below exists to keep them from
getting stuck. Read `references/plain-language.md` now — it sets the tone for
everything else in this skill.

## The core idea: avoid heavy installs by default

Most of what makes mobile development painful for beginners — installing
Xcode, installing Android Studio, configuring simulators — is **not actually
required** to go from an idea to a published app:

- **Preview**: the user's own phone + the free Expo Go app (scan a QR code).
  No Xcode, no Android Studio, no simulator.
- **Publish**: EAS Build compiles the app in Expo's cloud. Still no local
  Xcode or Android Studio needed, even for the final App Store / Play Store
  binary.

So the default path in `references/build-flow.md` never touches
Xcode/Android Studio at all. Only install them if the user has no phone
handy, explicitly wants a local simulator, or needs native-module work Expo
can't cover — and even then, follow the AUTO / ASK FIRST / USER MUST CLICK
tiers in `references/environment-setup.md` exactly. Don't over-install.

## Phases (full detail in references/build-flow.md)

1. **Understand the idea** — a short plain-language conversation, not a spec form.
2. **Check the environment** — run `scripts/doctor.sh` once per machine/session.
3. **Scaffold the project** — run `scripts/check-expo-go-sdk.sh` *first* and
   scaffold at the SDK tag it prints (`--template default@sdk-NN`), not
   plain `@latest` — the App Store's Expo Go build regularly lags the newest
   SDK by weeks, and scaffolding ahead of it produces a project that can
   never open on the user's phone (see `troubleshooting.md`). Then run
   `scripts/strip-demo-scaffold.sh --name "Display Name"` to remove the
   template's demo tabs/explore/modal content and drop to a clean
   single-screen stack (verified end-to-end on both known template shapes —
   don't redo this by hand). Then build the real screens out using the
   `expo:*` skills (project structure, router, native UI, data fetching).
4. **Verify, then let them see it live** — `npx tsc --noEmit` must pass
   before you show anyone anything; never hand a broken bundle to a
   non-technical user. Then start `npx expo start` in the background, build
   the connection QR yourself with `scripts/make-preview-qr.sh` (Expo CLI's
   own QR only renders in an interactive terminal, which a background
   process never has — confirmed by testing, don't wait for it to appear),
   and print the ASCII QR the script outputs **directly in your reply** —
   that's the primary, always-works method, not SendUserFile-ing the PNG
   (confirmed by testing: that silently "succeeds" with no error in a plain
   terminal session and the user never sees it — no image viewer to show it
   in). Only attach the PNG as an extra once you already know images render
   for this session. This is the milestone that matters most — get here
   fast, and get it right the first time (print it once, cleanly — don't
   experiment with alternate QR commands in front of the user; the script
   already avoids the ANSI-color-garbage trap those fall into).
5. **Iterate** — take feedback in their own words, translate it to code.
6. **Ship it** — `expo:eas-app-stores` for the cloud build/submit mechanics;
   be upfront that Apple ($99/yr) and Google ($25 one-time) developer
   accounts are the one part only the user can do (identity + payment).

## Installing things: how to decide, without asking a technical question

Every install command lives in `references/environment-setup.md`, tagged:

- **AUTO** — just run it, then say one plain sentence about what happened.
  (Node, Watchman, eas-cli, Homebrew formulae — small, fast, reversible.)
- **ASK FIRST** — tell the user what it is, roughly how big/long, get a
  go-ahead. (Homebrew itself, Android Studio, SDK/system images — large or
  needs their admin password.)
- **USER MUST CLICK** — Apple/Google gate it behind a GUI dialog or account
  login (full Xcode from the App Store, the Xcode CLT install dialog,
  developer account sign-up). You can kick it off and give the one next
  instruction, but you cannot finish it for them — say so plainly instead of
  retrying in a loop.

Never run the ASK FIRST or USER MUST CLICK tier silently, even though the
user who set up this skill said installs can generally proceed — "ask or
just install" still means: heavy/irreversible things get one plain-language
heads-up first, lightweight things just happen.

## References

Consult these as needed — don't load them all up front, pull in the one
relevant to the phase you're in:

- `references/build-flow.md` — the full phase-by-phase process and which
  `expo:*` skill to use at each step.
- `references/environment-setup.md` — exact install commands per tool/OS,
  with the AUTO / ASK FIRST / USER MUST CLICK tier for each.
- `references/plain-language.md` — how to talk to a non-technical user, a
  jargon-to-plain-English table, and the test for when to just decide
  something yourself instead of asking.
- `references/troubleshooting.md` — common failure symptoms (QR won't scan,
  build fails, emulator won't boot, permission errors) and their fixes,
  written so the user only ever hears the plain-language version.
- `scripts/doctor.sh` — read-only environment report. Never installs
  anything itself; just tells you what's present so you know what (if
  anything) to act on.
- `scripts/check-expo-go-sdk.sh` — read-only check of which SDK the App
  Store/Play Store build of Expo Go currently supports, and the exact
  `create-expo-app` flag to scaffold at it. Run before every fresh scaffold
  (Phase 2) — see `troubleshooting.md` for why this matters.
- `scripts/strip-demo-scaffold.sh [--name "Display Name"]` — removes the
  template's demo tabs/explore/modal/components and rewrites the layout to
  a single-screen stack. Knows the two template shapes tested so far; if it
  doesn't recognize a project's layout it aborts without changing anything
  rather than guessing — fall back to the manual process in
  `build-flow.md` Phase 2 and consider teaching it the new shape.
- `scripts/make-preview-qr.sh <port> [output.png]` — prints a clean ASCII
  QR code straight to stdout (print this in your reply — it's the primary
  delivery method, proven reliable in both terminal and GUI sessions) and
  optionally also writes a PNG as a bonus for known-GUI sessions. Use this
  every time instead of expecting Expo CLI to print its own QR code — it
  won't, in a background process — or hand-rolling a `qrcode`/
  `qrcode-terminal` CLI call yourself, which produces unreadable ANSI
  garbage unless invoked exactly the way this script does (Phase 3,
  `troubleshooting.md`).
