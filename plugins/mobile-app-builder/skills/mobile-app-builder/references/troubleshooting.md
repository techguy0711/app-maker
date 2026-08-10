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

This is expected, not a bug — see Phase 3 in `build-flow.md`. Expo CLI only
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
likely `cd`ed into by this point.)

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
the git recipe in `build-flow.md` Phase 2.

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
the current directory itself — see the corrected recipe in `build-flow.md`
Phase 2 (`git rev-parse --show-toplevel` must equal `pwd -P`, or `git init`).

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

## The user asks "is my app safe / can I lose my work?"

Reassure concretely: as long as you're committing to git after working
milestones (Phase 2 in `build-flow.md`), nothing is lost — you can always
go back to the last checkpoint. Say this proactively the first time
something breaks; it's the single biggest source of non-technical-user
anxiety mid-project.
