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
- ✅ Checking every screen actually looks right before you ever see it
- ✅ Publishing to the Apple App Store / Google Play, when you're ready

The only thing it *can't* do for you: Apple and Google both require a real
person to sign up for a developer account before your app can go live in
their stores ($99/year for Apple, $25 once for Google). Everything else —
including the actual building — Claude handles.

## What Claude might ask you

Not much, and never anything technical. Two things come up often enough to
be worth knowing about in advance:

- **"What version does Expo Go show?"** Expo Go only runs one version of the
  underlying tools at a time, so building for the wrong one produces an app
  your phone simply refuses to open. Usually Claude can look this up itself.
  When it can't, it asks you instead of guessing — open Expo Go, read the
  number on the home screen, done.
- **"Which of these two designs do you prefer?"** If a layout won't fit on a
  phone screen no matter how it's arranged, Claude stops rearranging it and
  offers you two simpler options that will work, described in plain language.
  It also writes the dead end down, so it won't walk into the same one again
  later in your project.

## Before you start

- You'll need [Claude Code](https://claude.com/claude-code) installed.
- Install the free **Expo Go** app on your phone from the App Store or Play
  Store — that's what your app will run inside while you build it.
- This plugin also uses Expo's official plugin to build screens — install it
  too, the same way:
  ```
  /plugin install expo@claude-plugins-official
  ```

---

<details>
<summary><strong>For developers — how this actually works</strong></summary>

### The plugin

[`plugins/mobile-app-builder/`](plugins/mobile-app-builder/) is the actual
plugin, packaged the standard Claude Code way (`.claude-plugin/plugin.json`
+ `skills/`). [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
at the repo root is what makes `/plugin marketplace add` work.

### The build flow

Full detail in
[`build-flow.md`](plugins/mobile-app-builder/skills/mobile-app-builder/references/build-flow.md);
each phase is its own file so an agent loads only the one it's in.

| Phase | What happens |
|---|---|
| 0 | Plain-language conversation about what the app should do. |
| 0.5 | **Does this fit Expo Go?** Decided *before* scaffolding. Anything needing Bluetooth, HealthKit, background location, speech recognition or most native modules can't preview in Expo Go at all, and discovering that at Phase 3 means rebuilding. |
| 1 | `doctor.sh` — read-only environment report. Three verdicts: what the Expo Go path needs, what a dev build would need, and **how Phase 3 will actually reach the phone** (`lan`, `eas-update`, or `none`). |
| 2 | `check-expo-go-sdk.sh` → `create-expo-app` pinned to that SDK → `strip-demo-scaffold.sh` → build screens → both gates. |
| 3 | `make-preview-qr.sh` prints a scannable code; the app runs live on a real phone. |
| 4 | Iterate on feedback given in one sentence by someone who can't see a stack trace. |
| 5 | EAS Build compiles in the cloud — no local Xcode or Android Studio, even for the store binary. |

### The parts that exist because something broke

Nearly every guard here is a postmortem. The specifics live in
[`troubleshooting.md`](plugins/mobile-app-builder/skills/mobile-app-builder/references/troubleshooting.md).

**Expo Go pins exactly one SDK version.** `create-expo-app@latest` always
grabs the newest SDK, and the store build of Expo Go can lag it by weeks
while Apple and Google review. Scaffold ahead of the store and the project
can never open on the user's phone. `check-expo-go-sdk.sh` resolves this
against Expo's API and pins the scaffold to the answer. If it can't reach the
API it is a **hard stop on Path A**, not a warning — guessing high and
guessing low both produce an unopenable app, and reasoning about how mature
an SDK looks on npm predicts the wrong variable entirely (the gate is the
review queue, not the SDK's age). It directs one concrete question at the
user instead. On Path B it's skipped outright: following it there can pin the
project *below* the SDK a required native package needs.

**Two validation loops, answering different questions.**
`ui-validate.sh` asks *does this screen hold together* — renders every screen
headless at phone size in react-native-web and checks real geometry: nothing
off-screen, nothing collapsed, no clipped text, no tap target under 44×44, no
content stranded below the fold. `flow-validate.sh` asks *can a user get from
A to B and back* — real router, real navigation, driven in Chromium. The
first deliberately stubs the router out, so a broken back button passes it
every time; that's what the second is for. Both are silent to the user and
write structured JSON for the agent.

A pass means "structurally sound", never "this is what the phone shows".
Platform fonts, safe-area insets, native shadows, keyboard avoidance,
gestures and `@expo/ui` controls are all outside what a browser can prove.

**The attempt budget.** Three failures on the same problem and the layout is
declared `blocked` — stop editing, offer the user two concrete simpler
alternatives, record the choice in `design-constraints.json`, which
`app-map.mjs` inlines so the next similar request doesn't walk into the same
wall. The budget keys on the distinct *check types* per file, deliberately:
keying on individual elements meant partial progress read as a new problem
and reset the counter, so the loop could run forever — measured at five
consecutive failures with the counter stuck at 1.

**Statuses are load-bearing.** `blocked-infra` means the harness couldn't
run — never redesign a layout because of it. `stub-gap` means a screen failed
to *import* and was therefore never checked at all; the fix is a missing
export in `expo-stubs.tsx`, and it costs no attempt. A `fail` carrying zero
violations is treated as infrastructure, because that combination is not a
layout defect and acting on it as one leads to apologising to a user about a
design constraint that doesn't exist.

**Restricted networks.** In a sandboxed or cloud session the shell often
can't reach the user's phone *or* Expo. `doctor.sh` probes both and reports
`none` rather than sending the agent to ask for an Expo access token that
cannot work. Everything up to Phase 3 still runs offline against npm alone,
and a web export rendered in the visual loop's own Chromium gives real
screenshots to show the user while the phone step moves to their machine.

### Testing the plugin locally, without reinstalling

```
claude --plugin-dir plugins/mobile-app-builder
```

`plugins/mobile-app-builder/` is the single copy of this skill; there's no
separate working copy to keep in sync.

### Example apps built with it

[`examples/`](examples/) holds apps the skill actually produced, checked in
so you can read the source without building anything — see
[`examples/README.md`](examples/README.md) for the list and how to run them.

This is a deliberate exception to how the skill treats apps in normal use: an
app you build for yourself gets its own **isolated git repo** so its history
stays scoped to that project. These were flattened into this repo's history
on purpose so they can ship as readable examples.

### Repo hygiene notes

This repo's own git history is intentionally separate from any ambient repo
that might exist above it on the machine it was developed on — see the
"near-miss" story in `troubleshooting.md` for why that separation matters.
The repo-detection check compares `git rev-parse --show-toplevel` against the
project's own path, never `--is-inside-work-tree`, which returns true for
every subfolder of any ancestor repo and once nearly staged an unrelated
directory tree.

</details>

---

<div align="center">

MIT licensed — see [`LICENSE`](LICENSE).

</div>
