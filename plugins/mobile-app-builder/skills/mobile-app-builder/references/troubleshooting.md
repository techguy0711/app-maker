# Troubleshooting — read the real error yourself, then explain plainly

General rule: when a command fails, read the actual output, diagnose it
silently, then tell the user one calm sentence about what's wrong and what
you're doing — never paste the raw error at them as the answer.

## "Project is incompatible with this version of Expo Go" / "requires a newer version of Expo Go"

**Root cause, confirmed by testing (Aug 2026):** since SDK 50, the Expo Go
app only supports **one** SDK version at a time — the one matching its own
release, not a range. `npx create-expo-app@latest` always scaffolds against
the newest SDK the day you run it. Apple/Google review each new Expo Go
build after every SDK release, and that review routinely takes weeks — so
there is regularly a real window where the newest SDK has no matching Expo
Go build in either store at all yet. During that window, **no amount of
updating Expo Go on the phone fixes this** — the compatible build simply
doesn't exist in the store yet. (Confirmed live: SDK 57 shipped June 30,
2026; as of Aug 2026 the store Expo Go still only supports SDK 54.)

Don't assume "tell them to update the app" is the fix — verify first:

```bash
curl -s https://api.expo.dev/v2/versions/latest | node -e "
let d='';process.stdin.on('data',x=>d+=x);process.stdin.on('end',()=>{
  console.log(JSON.parse(d).data.expoGoSdkVersion);
});"
```

This is the ground truth for what the store's Expo Go currently supports
(same thing `scripts/check-expo-go-sdk.sh` prints). Compare it to the
project's `expo` version in `package.json`.

- **If they match:** it's a genuinely stale Expo Go install — tell the user
  to open the App Store/Play Store, update Expo Go, reopen, rescan.
- **If the project is newer:** the store hasn't caught up yet. Re-scaffold
  the project directly at the compatible SDK using the version-tagged
  template — **do not try to downgrade an already-scaffolded newer project
  in place.** Tested and confirmed broken: `npx expo install expo@<older>`
  + `npx expo install --fix` updates package versions but leaves the
  newer-SDK template's scaffold *source files* in place (e.g. SDK 57's
  `_layout.tsx` imports `ThemeProvider`/`DarkTheme` from `expo-router`,
  which SDK 54's `expo-router` doesn't export — `tsc` fails with `TS2305`
  errors after the "downgrade"). The clean fix:
  ```bash
  npx create-expo-app@latest <app-name> --template default@sdk-54   # use the SDK the check printed
  ```
  If you already built screens on top of the wrong-SDK scaffold, re-apply
  your app-specific files (screens/components you wrote from scratch) on
  top of the freshly-tagged scaffold rather than patching the old one —
  your own code rarely uses SDK-version-specific scaffold internals, but
  the *template's own* files (`_layout.tsx`, `themed-text.tsx`,
  `constants/theme.ts`, tab/icon components) do change shape between SDKs
  and are what breaks.

Never leave the user staring at the raw error text either way — translate
it to: "Your preview app just needs a quick update, one sec" while you
figure out which of the two cases above it is.

## No QR code / connection URL shows up in the dev server output at all

This is expected, not a bug — see `build-flow/phase-3-preview-expo-go.md`. Expo CLI only
draws its QR code and connection URL through an interactive terminal UI
gated on `stdout` being a real TTY. The dev server has to run as a
background process (it's long-running), which is never a TTY, so that
output never appears — confirmed by testing, including after a phone had
already connected and successfully loaded the bundle. Don't keep polling
the log waiting for it. Build and deliver the QR yourself:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/make-preview-qr.sh <port> /tmp/preview-qr.png
```
(`${CLAUDE_PLUGIN_ROOT}` is an environment variable Claude Code sets to this
plugin's install location — not a path relative to the project dir you're
likely `cd`ed into by this point. It has been observed unset in a real
session, though — see `build-flow/phase-2-scaffold.md` for the fallback if a command
like this one fails with "No such file or directory".)

**Print the ASCII QR block the script outputs directly in your chat reply —
once, cleanly. Don't experiment with alternate QR generation methods inline
in front of the user.** Two things confirmed by testing, the hard way:

1. SendUserFile-ing the PNG as the primary delivery method silently
   "succeeds" with no error in a plain-terminal session, and the user never
   sees it — there's no image viewer to show it in. Print the ASCII text
   the script gives you as the primary method every time; only attach the
   PNG as an extra once you already know images render for this session.
2. Do not hand-roll a different QR command instead of running the script
   (e.g. `npx -y qrcode-terminal "<url>"` or `npx -y qrcode --small
   "<url>"` directly) — both of those CLIs force ANSI color escape codes,
   which show up as unreadable garbled fragments once relayed through
   chat. A user watching you try that, then fix it, then send the real one
   sees a broken QR before a working one, which reads as things not
   working even after they actually are. The script already avoids this
   correctly (it calls `qrcode-terminal`'s library API directly instead of
   its CLI) — just run it and print its output as-is, don't reimplement.

If the script can't determine a LAN IP (rare — unusual network setup), it
says so explicitly; fall back to `npx expo start --tunnel` and grep its log
for an `exp://`/`exps://` URL, which tunnel mode does print as a plain line.

## `expo start --tunnel` fails, or this Claude Code session isn't on the user's own network

Reported directly by a user running Claude Code's **mobile app**: the tunnel
never established because the session's own network layer blocked the proxy
connection `--tunnel` needs. This is a different failure from "no LAN IP
found" (below) — it means neither the LAN-IP QR flow nor the `--tunnel`
fallback can work at all, because the shell running these commands isn't on
the user's own network in the first place. Any remote/cloud Claude Code
session is a candidate for this, not just the mobile app specifically.

Don't debug this as a network misconfiguration on the user's end — it isn't
one. Skip straight to the EAS Update fallback in `build-flow/phase-3-preview-expo-go.md`'s "When the
dev server can't reach the phone at all." That path publishes the JS bundle
to Expo's cloud instead of hosting it from this machine, so no tunnel or LAN
reachability is needed. It is verified end-to-end; follow its command sequence
exactly, and run `scripts/verify-expo-go-update.sh` before handing over a QR
code — a successful publish is not evidence the phone can load it.

Better still, don't arrive here at Phase 3 at all. `doctor.sh` reports a
**preview delivery** verdict at Phase 1, and it names this case (and the Expo
access token it needs) while there's still time to get the token before it
becomes a hard stop.

**But check the verdict before you act on it — EAS Update is not always
available either.** See the next section.

## Egress is restricted: `api.expo.dev`, `dl.google.com` and friends are unreachable

The case above assumes the shell can still reach *Expo*, even if it can't
reach the phone. In a sandboxed session that assumption often fails too:
network access is allowlisted, and the allowlist covers package registries
(npm, PyPI, crates, Go) and GitHub while everything else returns a connection
error or a proxy 403. Confirmed in a real session: `api.expo.dev`,
`u.expo.dev`, `exp.host`, `dl.google.com`, `cdn.playwright.dev` and
`docs.expo.dev` were all unreachable while `registry.npmjs.org` returned 200.

`doctor.sh` probes `api.expo.dev` and reports `PREVIEW_DELIVERY=none` for
this. When it does, the correct response is **not** to ask the user for an
Expo access token — that route is gone too, and asking spends their attention
on a task that cannot pay off. Symptoms, so you can recognise it without the
doctor's help:

- `check-expo-go-sdk.sh` warns it could not reach `api.expo.dev`.
- `eas login` / `eas update` hang or fail at the network layer, not on auth.
- `setup-visual-loop.sh` reports `STEP=browser-install` (blocked CDN).
- Anything that fetches `docs.expo.dev` returns nothing — including the
  instruction in the scaffold's own `AGENTS.md` to read the versioned docs
  before writing code. That instruction is unsatisfiable here. Don't retry it:
  build against stable APIs and lean on `tsc`, `ui-validate.sh`,
  `flow-validate.sh` and a web export instead, which are the checks that
  actually run offline.

What still works, and is the plan to state plainly at Phase 1:

1. **Build and verify normally.** Scaffolding, `npm install`, `tsc`, the
   visual loop and the flow check all need only the npm registry.
2. **Show, don't ship.** `npx expo export --platform web`, served locally and
   driven in the visual loop's own Chromium at phone viewport, produces real
   screenshots of the real app — including interactions and a reload to prove
   persistence. Put those in the conversation; for a non-technical user
   they're a genuine substitute for the phone in everything but native
   fidelity.
3. **Hand the project to the user's machine for the last step.** Their laptop
   has LAN, QR, simulators and EAS. `npm install && npx expo start` and the
   normal Phase 3 resumes there.

Since `check-expo-go-sdk.sh` can't verify the store's Expo Go SDK in this
state, pick the newest *stable* template tag and say why. Check publish dates
(`npm view expo-template-default time --json`): a line several patch releases
and a few weeks old is very likely supported by the store build already. Say
which SDK you chose and give the one-line fallback, rather than presenting a
guess as a check.

## "The QR code won't scan" / "Nothing happens on my phone"

Almost always a network mismatch. Check, in order:
1. Phone and computer must be on the **same Wi-Fi network**. Guest networks
   and separate 2.4GHz/5GHz "networks" with different names both break this.
2. Corporate/school/hotel Wi-Fi often blocks device-to-device traffic — ask
   if they're on one, and if so, try a home network or phone hotspot instead.
3. If Wi-Fi truly can't work, run `npx expo start --tunnel` instead — slower,
   but routes over the internet instead of the local network.

## "Expo Go says this app needs a development build" / native module errors

Some libraries (custom native modules) don't work in the plain Expo Go app.
Two options, in order of preference:
1. Swap the library for one that works in Expo Go / the `@expo/ui` universal
   layer, if there's an equivalent.
2. If genuinely needed, use `expo:expo-dev-client` to build a custom
   "Expo Go, but with your extra native code baked in" — explain to the user
   this is a one-time extra build step, still doesn't require Xcode/Android
   Studio locally (EAS builds it in the cloud).

## `npx expo-doctor` flags a missing peer dependency after adding a native module

Confirmed with `expo-audio`: it needs `expo-asset` as a peer dependency that
`npx expo install expo-audio` does **not** pull in automatically. `tsc
--noEmit` stays clean and the Expo Go preview keeps working regardless, so
this is easy to miss until a real (non-Expo-Go) build breaks. Run `npx
expo-doctor` after installing any new native module, not only `tsc` — it's
the check built to catch exactly this. Fix is always the same shape: `npx
expo install <the-missing-peer-it-names>`.

## A project path with a space in it breaks a development build

Confirmed to break three separate things in a real Path B build (see
`build-flow/phase-0.5-expo-go-fit.md` and `build-flow/phase-3-preview-dev-build.md`) — this does not affect the Expo Go
path, only local/EAS native builds:

- Two are fixable with a config plugin that re-quotes the generated Xcode
  build phases (the default scaffold's build phase scripts assume no
  spaces in `$PROJECT_DIR`).
- The third is an upstream bug, not something in this project's control:
  expo-constants' `get-app-config-ios.sh` runs `basename $PROJECT_DIR`
  unquoted. With a space in the path this silently decides it isn't
  running inside the Pods project, skips generating `app.config`, and the
  app crashes at launch with "expo-linking needs access to the
  expo-constants manifest" — a runtime error with no obvious connection to
  the real cause. Needs `patch-package` to fix the script directly; there's
  no config-plugin-level workaround for this one.

`doctor.sh` now warns when the current directory contains a space, but only
for this reason — it's harmless for Path A. If a user's workspace folder
has a space in its name (e.g. a `Documents` folder path, or "App Maker"
style names) and they're headed for a development build, either get the
project itself into a space-free path, or apply the two fixes above plus
the `patch-package` patch before the first native build.

## A stale `expo start` from a different project silently hijacks a dev build

A Metro dev server left running on port 8081 (or whatever port) by an
*unrelated* project causes a freshly installed development build to load
**that other project's** JS bundle instead of its own — with no error. The
user just sees a completely different app open. This is confirmed real, not
theoretical: the port a dev build's native binary connects to is compiled
into the binary itself, so passing `--port` to the *new* project's `expo
start` does not fix it — the native app is still configured to look at the
port where it finds an old server willing to answer.

Before starting a build (Phase 2/3, Path B in particular): check for a
stale `expo start` already listening —
```bash
lsof -i :8081 -sTCP:LISTEN   # or whatever port the new project will use
```
If something is there and it isn't this project's own server, **ask the
user before killing it** — it may be a different project they still have
open on purpose. Don't silently `kill` a process you didn't start.

Don't reach for `expo run:ios --port X` / `expo run:android --port X` as the
fix, either — that flag only works if `expo-dev-client` is installed in the
project (see `build-flow/phase-3-preview-dev-build.md`). The port arrives via a deep link
baked into the dev client binary itself, so without that package the flag is
silently accepted and does nothing, and the app keeps connecting to whatever
old server it was last configured for. Free the port or ask before killing
the other process instead of trusting `--port` to route around it.

## `pod install` fails with "Unicode Normalization not appropriate for ASCII-8BIT"

Happens when `LANG`/`LC_ALL` aren't set in the shell CocoaPods runs in —
common in a minimal or non-interactive shell environment. Ruby's Unicode
handling (which CocoaPods' Ruby-based tooling depends on) needs a UTF-8
locale to process filenames/paths correctly. Fix:
```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```
Worth exporting both for the whole session rather than prefixing every
CocoaPods command individually if more than one `pod` command is coming up
(e.g. `pod install` then `pod repo update`).

## `eas build` fails

Read the actual build log Expo links you to — it's usually one of:
- Missing/invalid credentials (signing certs, keystores) → EAS can generate
  these automatically the first time; if prompted, let it.
- A native dependency incompatible with the current Expo SDK version → check
  with `npx expo install --check` and fix version mismatches it reports.
- Free-tier build queue/minute limits → tell the user plainly this is an EAS
  account limit, not a bug, and point at expo.dev/pricing if it matters.

## "Java runtime" popup on macOS when running an Android-related command

macOS ships a fake `/usr/bin/java` stub that pops up an "install Java" dialog
the first time something calls it without a real JDK present. This is
expected the first time — either let the user click through Apple's
prompt, or install a JDK yourself (see `environment-setup.md`, Android
section) so it's not needed.

## `xcode-select --install` says tools are already installed, but Xcode-only errors persist

Command Line Tools and full Xcode.app are different things. CLT alone is
enough for many things but not the iOS Simulator. Check with `xcodebuild
-version` — a "unable to find utility" or "requires Xcode" error means they
need full Xcode.app from the App Store (see `environment-setup.md`), or they
should just preview on their physical phone instead.

## Android emulator won't boot / is extremely slow

- On Apple Silicon, make sure the system image is `arm64-v8a`, not
  `x86_64` — the wrong architecture runs under emulation and is unusably
  slow. On Intel Macs it's the reverse.
- If it still won't boot, physical-phone preview via Expo Go sidesteps the
  whole problem — suggest that instead of debugging the emulator further,
  unless the user specifically needs the emulator.

## `npm install` / `npx create-expo-app` fails with permission errors

Almost always a leftover global npm install owned by `root` from a past
`sudo npm install -g`. Don't reflexively `sudo` the failing command — that
compounds the problem. Check ownership of the npm global dir
(`npm config get prefix`) and fix ownership instead, or use a Node version
manager (`brew install nvm` / already-installed Homebrew Node) so nothing
ever needs `sudo` again.

## `create-expo-app` asks "Skip initializing a new git repository?" and you can't answer it

Happens whenever the project folder sits inside (or is) an existing git
repo — very likely if the user has one workspace folder for all their app
projects. The prompt gets no terminal to answer since scaffolding runs
non-interactively, so it silently defaults to skipping git init, leaving
the new project with no repo of its own. Always check for this after
scaffolding and init one scoped to just the project if it's missing — see
the git recipe in `build-flow/phase-2-scaffold.md`.

**Near-miss, confirmed by testing — do not use `git rev-parse
--is-inside-work-tree` to decide whether to `git init`.** It answers "is
this folder inside *some* repo," which is true for almost every subfolder
of a workspace directory that (accidentally or not) has an ancestor-level
git repo — a real situation, observed directly in this project's own
workspace, where a repo rooted at the user's home-adjacent `Documents`
folder silently swept in personal documents, certificates, and unrelated
other projects. Treating that as "already has a repo" and skipping `git
init` means the *next* command in the sequence, `git add -A`, runs against
that outer repo instead — attempting to stage the user's entire ancestor
directory tree. In testing this had to be killed via command timeout before
it finished; had it completed and been followed by a commit, it would have
committed a large swath of unrelated personal files into a repo the user
never intended to touch. The correct check compares the repo's toplevel to
the current directory itself — see the corrected recipe in
`build-flow/phase-2-scaffold.md` (`git rev-parse --show-toplevel` must equal `pwd -P`, or `git init`).

Never run git commands (`add`, `commit`, `reset`, anything) against whatever
outer repo a project happens to be nested inside — only ever the project's
own isolated repo. If a `git add -A` (or similar) is ever found to be
running unexpectedly slowly or against an unexpectedly large working tree,
that's a signal it may have scoped wider than intended — stop it and check
`git rev-parse --show-toplevel` before proceeding, rather than waiting for
it to finish. If you notice an outer repo has unrelated staged/uncommitted
changes sitting in it, that's someone else's business (possibly accidental,
e.g. `git init` run too high up a folder tree once) — leave it alone
entirely, don't reset or clean it, even if it looks like clutter.

## `rm -rf node_modules` (or any freshly-written folder) fails with "Directory not empty"

A transient race with macOS Finder's `.DS_Store` indexer writing into the
folder at the same moment you're deleting it — not a real lock or
permission issue. Confirmed in testing: happened right after `npm install`
finished, twice, and both times the identical `rm -rf` succeeded immediately
on retry. Just retry once before treating it as a real problem.

## `ui-validate.sh` says `blocked-infra`, or every screen fails at once

Infrastructure, not layout. **Do not redesign anything and do not start the
three-attempt clock** — the fallback conversation is for real layout limits,
and using it here would tell a user their design is impossible when actually
a config file is wrong. Read `.claude/logs/ui-validate.log` and
`.claude/visual/last-run.json`; failures come back as `kind: "error"` rather
than `kind: "layout"`, which is the tell.

Common causes, in the order they actually occur:

- **`Flow is not supported` / a parse error inside `node_modules/react-native/Libraries/…`** — the single most likely failure after adding a dependency. Packages that ship React Native *native component specs* (`react-native-safe-area-context`, `-screens`, `-gesture-handler`, `-reanimated`, and most `react-native-*` wrappers) deep-import Flow-typed React Native source. Vite's parser rejects Flow outright, so one such import kills the entire run before a single screen renders. Aliasing bare `react-native` to `react-native-web` does *not* cover it — the import is a deep path, not the bare name. Add the package to the stub aliases in `templates/vitest.config.ts` and give it exports in `templates/expo-stubs.tsx`. Confirmed on a stock SDK 57 scaffold, whose default screen uses safe-area-context. Wrappers whose only job is insets or gesture plumbing should stub as pass-through containers, not placeholder boxes — a placeholder would hide their children from the layout checks, and the children are the part worth checking.
- **`[PARSE_ERROR] Unexpected JSX expression` inside `node_modules/@expo/vector-icons/build/*.js`** — that package ships untranspiled JSX in its `build/` output, relying on Metro's transformer to handle it; Vite's esbuild/rolldown optimizer chokes on raw JSX in a plain `.js` file and kills the whole run before any screen renders. Confirmed on a real app using `Ionicons` from `@expo/vector-icons` — every screen failed at once. Fix is the same shape as the Flow case above: alias `@expo/vector-icons` to the stubs in `templates/vitest.config.ts` and add icon-set exports (`Ionicons`, `MaterialIcons`, etc.) to `templates/expo-stubs.tsx`, sized to the `size` prop rather than a fixed box so icons don't blow up small inline layouts (chevrons in a row, a glyph inside a round button). Already fixed in the shared templates as of Aug 2026 — if it recurs, a new icon family is being imported that isn't in the stub list yet.
- **`[MISSING_EXPORT] "X" is not exported by "node_modules/react-native-web/dist/index.js"` (e.g. `TurboModuleRegistry`), traced back to `expo-modules-core/src/requireNativeModule.ts`** — happens with Expo modules that *do* have a real web implementation (confirmed with `expo-audio`, which has a genuine HTML5-audio-backed `.web` build) but whose universal entry point still imports `expo-modules-core`'s native-module bridge unconditionally. That bridge references React Native internals `react-native-web` doesn't export, and Vite's dependency optimizer fails on it during its pre-scan, before platform-specific resolution ever gets a chance to pick the `.web` file. The fix isn't "make the web build work" — it's the same stub-alias pattern as everything else here: add the module to `templates/vitest.config.ts`'s alias list and give it a fake hook/function shape in `templates/expo-stubs.tsx` (for `expo-audio`: no-op `setAudioModeAsync`, and `useAudioPlayer`/`useAudioPlayerStatus` returning static idle state). Already fixed for `expo-audio`; the same signature from a different package means that package needs the same treatment.
- **Any `[PARSE_ERROR]` naming a file under `node_modules/…/build/`** — the
  general form of the `@expo/vector-icons` case above: the package ships
  untranspiled JSX in its published `build/` output and relies on Metro to
  transform it. Confirmed a second time with `expo-linear-gradient` (now
  aliased in the template too). **The fix is one alias line, not removing the
  dependency from the app** — that instinct is wrong and costs a rewrite of
  working code. Add it to `templates/vitest.config.ts` and give it exports in
  `templates/expo-stubs.tsx`.
- **`does not provide an export named 'X'`** — a screen imports something
  from a native-only Expo module that `templates/expo-stubs.tsx` doesn't
  stand in for yet. ES modules resolve named exports at transform time, so
  this can't be faked dynamically. Add the export to the template, re-copy
  it to `.claude/visual/expo-stubs.tsx`, re-run. One-line fix.
- **A locator timeout on `visual-root` with no layout error to go with it** —
  the screen rendered *nothing*, and the usual cause is a **default** import
  resolving to a stub that isn't callable. Named exports fail loudly; default
  imports don't — React throws "Element type is invalid… but got: object" and
  what reaches `last-run.json` is a timeout that reads like a layout problem.
  Confirmed with two ordinary imports in one build:
  `@expo/vector-icons/MaterialCommunityIcons` (the per-icon subpath form) and
  `react-native-gesture-handler/ReanimatedSwipeable`. The template's default
  export is callable as of Aug 2026; if this recurs, check the aliased package
  actually resolves to `expo-stubs.tsx` and that the screen isn't importing a
  default the stub renders as an empty glyph when it should be a wrapper.
- **Every screen reports `empty-render`** — the phone-sized `Frame` wrapper
  isn't applying, so `flex: 1` roots collapse to zero height. Regenerate the
  tests (`ui-validate.sh` does this automatically) rather than hand-editing
  anything under `.claude/visual/tests/`; those files are overwritten on
  every run.
- **Chromium won't launch** — `npx playwright install chromium --only-shell`
  never completed. Re-run `setup-visual-loop.sh`; its log has the real
  error. On Linux this is usually missing system libraries, which needs a
  `sudo npx playwright install-deps` the user has to run. On macOS, which is
  the common case for this skill, no system packages are required.

If it can't be fixed in a minute or two, set it aside. The app is completely
unaffected — you've lost a safety net, not a feature. Say nothing to the
user about it; there is no action for them to take.

## Screenshots fail on a screen you didn't touch

Expected, and the reason the comparison exists — a change on one screen
broke another. Look at the diff image before touching code.

The exception: if the user *asked* for the change that's showing up in the
diff, the reference image is just stale. Delete the file under
`.claude/visual/tests/__screenshots__/` and re-run to seed a fresh one.

Comparisons are only meaningful on the same machine. Font rendering, GPU and
headless-mode differences make screenshots from a different computer
inherently mismatched — if the project moves machines, delete
`__screenshots__/` wholesale and let it reseed rather than debugging a wall
of failures that mean nothing.

## A control doesn't respond, but the app otherwise works

The app is on the phone, everything renders, and one button, tab or back arrow
does nothing. Every other entry in this file is a *setup* failure — this is the
runtime category, and it is what all of Phase 4 is made of. Nothing here can be
diagnosed from a log, because there isn't one: the user's whole report will be
one sentence.

**Ask the discriminating question first, outright, before touching code:**

> "When you tap it — does nothing happen at all, or does it do the wrong thing?"

Those two answers point in opposite directions, and it's the cheapest
information available anywhere in this phase:

- **Nothing at all** → the press isn't arriving. Suspect hit-testing: something
  invisible on top, a zero-size or clipped tap target (`ui-validate.sh` catches
  the sized-wrong cases), a parent with `pointerEvents="none"`, or Expo Go's own
  chrome (see below).
- **The wrong thing** → the press is arriving and the handler is wrong. Suspect
  routing, stale state, or a fallback path masking the real one.

Then apply validation-loop rule 5: if it misbehaves on some screens and not
others, **enumerate what differs before editing anything**. A real session lost
three round-trips to a back button because two asymmetries went unmined — one
tab appeared to work only because `router.replace('/')` happened to land on it,
and the last broken screen was the only one wrapping rows in a gesture-handler
component. In both cases the difference between the working and broken screens
*was* the bug.

`scripts/flow-validate.sh` answers this mechanically whenever the flow is
reachable in a browser — prefer it to a second speculative fix.

### Known Expo Go divergences

Expo Go is a fixed binary, and **its own UI chrome can break** — a failure mode
Phase 0.5 doesn't cover, because that gate is about missing native modules. The
app's code can be entirely correct and the control still dead.

- **iOS 26: the native navigation bar stops hit-testing inside Expo Go.** The
  bar draws normally and the edge-swipe back gesture still works, but no button
  in it is pressable
  ([expo#39667](https://github.com/expo/expo/issues/39667),
  [screens#3226](https://github.com/software-mansion/react-native-screens/issues/3226)).
  Live as of Aug 2026.
  **Workaround:** hide the native header and render an ordinary `Pressable`.
  A custom `headerLeft` does **not** work — the whole bar stops hit-testing, not
  the button inside it. That's the trap worth remembering, because it's the
  obvious fix and it fails, which reads as "my replacement button is also
  broken" and sends you chasing your own code.

This is Path A's structural risk. Path A is otherwise presented as the
risk-free path, and on the whole it is — but "the preview app itself is buggy"
is a real category, and the user's device is where it surfaces. When a control
is dead on the phone and correct everywhere you can check, ask what OS version
their phone is on before assuming your code is wrong.

## The layout check passes but the app looks wrong on the phone

Both things can be true, and the check is not wrong. It renders
react-native-web in Chromium, which verifies structure — nothing off-screen,
nothing collapsed, nothing unreachable, nothing too small to tap. It cannot
see platform fonts, safe-area insets, native shadows, keyboard behaviour,
gestures, or `@expo/ui` native controls (screens using those are skipped
entirely rather than checked against a placeholder).

So trust the user's eyes over a green check, every time. Fix what they
describe, then re-run — the check's job is stopping obvious breakage from
ever reaching them, not replacing them.

## The user asks "is my app safe / can I lose my work?"

Reassure concretely: as long as you're committing to git after working
milestones (`build-flow/phase-2-scaffold.md`), nothing is lost — you can always
go back to the last checkpoint. Say this proactively the first time
something breaks; it's the single biggest source of non-technical-user
anxiety mid-project.
