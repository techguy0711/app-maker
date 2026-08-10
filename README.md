<div align="center">

# 📱 App Maker

### Build a real iPhone or Android app just by describing it — no coding required.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](plugins/mobile-app-builder/LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-plugin-5A4FCF)](https://claude.com/claude-code)

</div>

---

## Install it

Open [Claude Code](https://claude.com/claude-code), paste these two lines
in, and press enter:

```
/plugin marketplace add techguy0711/app-maker
/plugin install mobile-app-builder@mobile-app-builder-marketplace
```

That's it. Nothing to download, nothing to configure by hand.

## Then just say what you want

> "I want an app where I can track my daily water intake with a big plus button."

Claude will ask a couple of plain-language questions, build it, and hand you
a QR code to scan with your phone — the app runs live in a free app called
**Expo Go** while you're building it, and updates instantly every time you
ask for a change.

## What it takes care of for you

- ✅ Installing anything your computer needs (it'll ask before anything big)
- ✅ Getting the app running on your own phone to preview, live
- ✅ Keeping the app compatible with your phone automatically
- ✅ Publishing to the Apple App Store / Google Play, when you're ready

The only thing it *can't* do for you: Apple and Google both require a real
person to sign up for a developer account before your app can go live in
their stores ($99/year for Apple, $25 once for Google). Everything else —
including the actual building — Claude handles.

## Before you start

- You'll need [Claude Code](https://claude.com/claude-code) installed.
- This plugin also uses Expo's official plugin to build screens — install it
  too, the same way:
  ```
  /plugin install expo@claude-plugins-official
  ```

---

<details>
<summary><strong>For developers — how this repo is organized</strong></summary>

### The plugin

[`plugins/mobile-app-builder/`](plugins/mobile-app-builder/) is the actual
plugin, packaged the standard Claude Code way (`.claude-plugin/plugin.json`
+ `skills/`). [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
at the repo root is what makes `/plugin marketplace add` work.

**How the skill works, briefly** (full detail in its own
[`build-flow.md`](plugins/mobile-app-builder/skills/mobile-app-builder/references/build-flow.md)):

1. A short plain-language conversation to understand what the app should do.
2. `scripts/doctor.sh` checks the machine's dev environment once per session.
3. `scripts/check-expo-go-sdk.sh` checks which Expo SDK version the App
   Store/Play Store build of Expo Go currently supports, and scaffolds a new
   Expo project pinned exactly to that version — not the newest SDK, which
   is often ahead of what's actually installable on a phone.
4. `scripts/strip-demo-scaffold.sh` removes the template's demo tabs/explore
   content and drops to a clean single-screen stack.
5. The real screens get built using Expo's own skills (routing, native UI,
   data fetching).
6. `npx tsc --noEmit` must pass before anything is shown to the user.
7. `scripts/make-preview-qr.sh` builds a scannable connection code so the
   user can preview the app live on their own phone via the free Expo Go
   app — no simulator, no local Xcode/Android Studio required.
8. Iterate on feedback in plain language.
9. Shipping to the actual App Store/Play Store goes through EAS Build (cloud
   compilation, still no local native SDKs).

Every one of those steps encodes something that broke in real testing and
got fixed — see
[`troubleshooting.md`](plugins/mobile-app-builder/skills/mobile-app-builder/references/troubleshooting.md)
for the specifics (SDK version mismatches, QR codes that silently never
reach the user in a terminal session, a git-repo detection bug that nearly
staged an unrelated directory tree, template shape differences between SDK
versions).

### Testing the plugin locally, without reinstalling

```
claude --plugin-dir plugins/mobile-app-builder
```

### The `.claude/skills/` copy

There's a second, separate copy of this skill at
[`.claude/skills/mobile-app-builder/`](.claude/skills/mobile-app-builder/SKILL.md) —
that's the working copy used to actually build the example apps below and
develop the skill itself, using this project's own path conventions rather
than `${CLAUDE_PLUGIN_ROOT}`. The two aren't kept in sync automatically; if
you change one, mirror the change in the other.

### Example apps built with it

[`examples/`](examples/) holds apps the skill actually produced, checked in
here so you can read the source without building anything. Each one is a
complete Expo project — `cd` into it, `npm install && npx expo start`, and
scan the QR code with Expo Go.

- **[`examples/counter/`](examples/counter/)** — plus/minus buttons
  incrementing a number. The smallest end-to-end case.
- **[`examples/camera/`](examples/camera/)** — live camera preview, flip
  front/back, capture and retake a photo. Exercises a real native module
  (`expo-camera`) and a runtime permission flow.
- **[`examples/tetris/`](examples/tetris/)** — full game: rotation, line
  clears, scoring, increasing speed. Game rules live in a pure
  `src/engine.js` with 26 tests (`node test-engine.cjs`) separate from the
  screen.

Their `node_modules/`, `.expo/` and other build output stay untracked (see
each app's own `.gitignore` plus the one at the repo root), so a fresh clone
needs `npm install` in whichever example you want to run.

Note this is a deliberate exception to how the skill treats apps in normal
use: an app you build for yourself gets its own **isolated git repo** so its
history stays scoped to that project (see
[`build-flow.md`](plugins/mobile-app-builder/skills/mobile-app-builder/references/build-flow.md)).
These three were flattened into this repo's history on purpose so they can
ship as readable examples.

(A `tic-tac-toe/` app was also built and later deleted during testing.)

### Repo hygiene notes

This repo's own git history is intentionally separate from any ambient repo
that might exist above `~/Documents` on the machine it was developed on —
see the "near-miss" story in `troubleshooting.md` for why that separation
matters. Never run git commands here expecting them to reach outside this
folder, and vice versa.

</details>

---

<div align="center">

MIT licensed — see [`plugins/mobile-app-builder/LICENSE`](plugins/mobile-app-builder/LICENSE).

</div>
