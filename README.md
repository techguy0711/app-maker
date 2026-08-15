<div align="center">

# 📱 App Maker

### Build a real iPhone or Android app just by describing it — no coding required.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
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
6. `npx tsc --noEmit` and `scripts/ui-validate.sh` must both pass before
   anything is shown to the user — the second renders every screen headless
   at phone size and checks real geometry, so "it looks weird" never has to
   be the user's job to report.
7. `scripts/flow-validate.sh` drives the real router in a browser and checks
   that a user can get from screen to screen *and back*. The layout check
   deliberately can't cover this — it stubs the router out — so a broken back
   button passes every other check in the skill.
8. `scripts/make-preview-qr.sh` builds a scannable connection code so the
   user can preview the app live on their own phone via the free Expo Go
   app — no simulator, no local Xcode/Android Studio required. When the
   session can't reach the user's network at all (a cloud session, say),
   `scripts/verify-expo-go-update.sh` confirms the cloud-published bundle
   will actually load before a QR code is handed over — that path fails
   silently otherwise.
9. Iterate on feedback in plain language.
10. Shipping to the actual App Store/Play Store goes through EAS Build (cloud
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

This is also how the example apps below get built and how the skill itself
gets developed — `plugins/mobile-app-builder/` is the single copy of this
skill; there's no separate working copy to keep in sync.

### Example apps built with it

[`examples/`](examples/) holds five apps the skill actually produced,
checked in so you can read the source without building anything — see
[`examples/README.md`](examples/README.md) for the full list (a counter, a
camera app, a Tetris clone, a physics game, and an Apple Music charts
browser) and how to run them.

Note this is a deliberate exception to how the skill treats apps in normal
use: an app you build for yourself gets its own **isolated git repo** so its
history stays scoped to that project (see
[`build-flow.md`](plugins/mobile-app-builder/skills/mobile-app-builder/references/build-flow.md)).
These five were flattened into this repo's history on purpose so they can
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

MIT licensed — see [`LICENSE`](LICENSE).

</div>
