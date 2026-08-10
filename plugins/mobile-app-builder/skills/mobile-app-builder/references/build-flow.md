# Build flow — idea to app store

Follow these phases in order. Don't skip the environment check, and don't
front-load installs the current phase doesn't need yet.

## Phase 0 — Understand what they want

Ask in plain language, one or two questions at a time, not a form:
- "What should the app do?" (get a one-sentence purpose)
- "Who's it for — just you, or other people too?"
- "Any apps you like the feel of, that I could use as a reference?"

Don't ask about tech stack, navigation patterns, state management, etc. — that's
your job to decide, not theirs. See `plain-language.md` for phrasing rules.

## Phase 1 — Check the environment

Run `scripts/doctor.sh`. Do this once per machine/session, not once per app.

The default path below only strictly needs Node.js, npm, and git — call out
anything else missing from Core Tools in `environment-setup.md` and fix it
before scaffolding.

Do **not** proactively install Xcode, Android Studio, or any simulator at
this point. Those are Phase 3 concerns, and most users never need them —
Expo Go on their own phone covers preview, and EAS Build covers the final
app-store binary, both without any local native SDKs.

## Phase 2 — Scaffold the project

**First, always run `scripts/check-expo-go-sdk.sh`.** `npx create-expo-app@latest`
by itself always grabs the newest SDK, but the Expo Go app published on the
App Store/Play Store lags behind — sometimes by weeks, while Apple/Google
review the new build. Scaffolding at a newer SDK than the store's Expo Go
supports produces a project that cannot open on the user's phone no matter
how much they update the app, and it shows up as "Project is incompatible
with this version of Expo Go." Checking first avoids the whole failure class
instead of debugging it after the fact. See `troubleshooting.md` for the
full story if you're fixing an already-scaffolded project instead of
starting fresh.

The scripts referenced throughout this file live in this plugin's own
`scripts/` directory. Reference them via `${CLAUDE_PLUGIN_ROOT}` — an
environment variable Claude Code sets to this plugin's install location,
which is available in every shell command you run and doesn't move when you
`cd` into the new project. Never hardcode an absolute path to the plugin or
use a path relative to your current working directory instead.

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/check-expo-go-sdk.sh
# prints the store-compatible SDK, e.g. "sdk-54"

npx create-expo-app@latest <app-name> --template default@sdk-54   # use the tag the script printed
cd <app-name>
```

Do not scaffold with `--template default` (no version tag) — that always
resolves to the newest SDK regardless of what the script reported.

**Give the project its own isolated git repo, every time.** `create-expo-app`
detects if it's running inside an existing git repository and, when it is,
prompts interactively: "You are creating a project inside of an existing Git
repository. Skip initializing a new git repository?" That prompt gets no
terminal to answer, so it silently defaults to "skip" — meaning the new
project is left with no repo of its own and no way to checkpoint your work.
This is a real, common case: a workspace folder for all the user's app
projects is itself very likely to already be (or sit inside) a git repo. Do
not assume the scaffold already has git set up — always check and init one
scoped to just this project.

**The check must be "does *this exact folder* own a repo," never "is this
folder inside *a* repo."** `git rev-parse --is-inside-work-tree` answers the
second question, not the first — it returns true for every subfolder of any
ancestor repo, which is exactly the situation you're in here (a workspace
folder holding many app projects is itself commonly a git repo, or sits
inside one). Using `is-inside-work-tree` as the "already has a repo" test is
a real, tested bug, not a hypothetical: it caused a `git add -A` to attempt
staging a user's entire multi-hundred-GB home-adjacent directory tree
(personal documents, other unrelated git projects, certificates) into that
outer repo, which then had to be aborted via command timeout. The correct
check compares the repo's toplevel to the current directory itself:

```bash
cd <app-name>
if [ "$(git rev-parse --show-toplevel 2>/dev/null)" != "$(pwd -P)" ]; then
  git init -q
fi
cat > .gitignore <<'EOF'
node_modules/
.expo/
dist/
.DS_Store
EOF
git add -A && git commit -q -m "Initial scaffold"
```

If `git rev-parse --show-toplevel` doesn't exactly equal the project's own
absolute path (including when the command fails outright because there's no
repo at all yet), this folder does not have its own repo — `git init` it.
Never skip that `git init` based on merely being inside *some* repo
somewhere above.
Nesting a repo inside another repo's working tree is completely normal and
safe — git treats the inner `.git` as its own independent repo and the outer
one just sees an ordinary (gitignorable) directory. Never touch or run
commands against whatever outer repo you happen to be inside; if you notice
one has unrelated staged/uncommitted changes, that's a signal it's an
unrelated, possibly-accidental repo (e.g. someone ran `git init` too high up
in their folder tree) — leave it alone entirely, it's out of scope.

Commit again after every working milestone from here on (`git add -A && git
commit -q -m "..."`) so there's always a checkpoint to roll back to —
non-technical users have no mental model for "undo" beyond what you give
them.

**Strip the template's demo content before building the user's app.** Every
`create-expo-app` default template ships a multi-tab demo (a Home tab, an
Explore tab, sometimes a modal screen) with sample components (parallax
headers, animated icons/waves, haptic tab buttons, collapsible sections,
platform-specific icon-symbol files) that exist to show off features, not to
be part of the user's app — and most simple single-purpose apps (a game, a
tracker, a single tool) need **one screen, no tabs**.

Run the script for this instead of doing it by hand:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/strip-demo-scaffold.sh --name "Display Name"
```
It recognizes the two template shapes seen and tested so far (`app/(tabs)/`
— SDK ~54 — and `src/app/` + `app-tabs.tsx` — SDK ~57), grep-verifies
nothing outside the files it's about to touch references what it's deleting,
removes the demo tabs/explore/modal/components, rewrites `_layout.tsx` to a
plain single-screen stack, writes a placeholder `index.tsx`, and sets the
app's display name in `app.json` — all verified end-to-end against real
scaffolds of both shapes (`tsc --noEmit` and `expo-doctor` clean afterward).

If it aborts because it doesn't recognize the template's layout (a future
SDK shipped a third shape), it changes nothing — fall back to the manual
process: read `app/_layout.tsx` (or `src/app/_layout.tsx`) to see the
shape, `grep -rl` each candidate file/import across `app/` and `components/`
to confirm nothing you're keeping still references it, delete what's
confirmed unused, rewrite the layout to a single-screen stack, and run `npx
tsc --noEmit` to catch anything missed. Worth teaching the script the new
shape afterward so the next project doesn't repeat the manual work.

Keep `themed-text`/`themed-view`-style primitives and the color-scheme
hook — those are stable, useful, and worth building the real screen on top
of; the script already knows to keep them.

Use the `expo:expo-project-structure` skill to lay out folders correctly from
the start (this is a brand-new project, so it applies cleanly — never
retrofit structure onto an existing app).

Use `expo:expo-router` for navigation/screens, and `expo:expo-native-ui` (plus
`expo:expo-ui` for native SwiftUI/Jetpack Compose components where a native
control — toggle, picker, sheet — genuinely fits better than a plain RN one)
to build the actual screens matching what the user described in Phase 0.

If the app needs to talk to any API or store data remotely, use
`expo:expo-data-fetching`.

**Before moving to Phase 3, verify — don't assume.** Run:
```bash
npx tsc --noEmit
```
Treat any error as blocking. Never hand a broken bundle to Phase 3 — a
non-technical user has no way to tell "the app crashed because of my code"
apart from "the app is broken," and every failure reads to them as the tool
not working. `npx expo-doctor` is a good extra pass too (dependency/version
sanity checks) but `tsc` is the non-negotiable minimum.

One environment quirk worth knowing before it costs you a debugging cycle:
`rm -rf node_modules` occasionally fails with "Directory not empty"
immediately after npm just finished writing it — this is Finder's
`.DS_Store` indexer racing the delete, not a real lock. Just retry the same
`rm -rf` once; it succeeds the second time.

## Phase 3 — Let them see it live

This is the moment that matters most for a non-technical user: something
real on their own phone, fast. Two things about *how* you do this are not
obvious and both cost real debugging time in testing — read both before
running anything.

**The dev server must run in the background, and its QR code will never
appear in your tool output.** `npx expo start` is long-running, so it has to
be started as a background process — but Expo CLI's QR code and connection
URL only render through its interactive terminal UI, which is gated on a
real TTY. A background process is never a TTY, so that output is silently
suppressed. Confirmed by testing: even after a phone successfully connected
and the JS bundle loaded, the captured log contained no QR code and no
`exp://` URL anywhere — only `Waiting on http://localhost:PORT` and bundler
progress lines. Do not wait longer expecting it to appear; it won't. Build
the connection info yourself:

```bash
npx expo start --port 8081   # run in background, from inside the project dir;
                              # note the actual port it logs
                              # ("Waiting on http://localhost:XXXX") in case
                              # 8081 was already taken and it picked another
${CLAUDE_PLUGIN_ROOT}/scripts/make-preview-qr.sh 8081 /tmp/preview-qr.png
```

**Print the ASCII QR the script outputs directly in your reply — that is
the primary method, not a fallback.** Tested both ways, in a plain-terminal
Claude Code session specifically (very likely how this skill is actually
being run): delivering the PNG via SendUserFile reported success with no
error, and the user never saw it — there's no inline image viewer in that
context, and SendUserFile has no way to know that and tell you. ASCII text
printed in the response works in every session type, terminal or GUI alike,
with no silent-failure mode. Only attach the PNG as a bonus once you already
know images render for this user (they've confirmed it, or you can see rich
content rendering elsewhere in the session) — never rely on it as the only
way they get the code.

Getting the ASCII itself right matters: don't reach for the `qrcode` or
`qrcode-terminal` CLIs directly (`npx -y qrcode-terminal "<url>"`, `npx -y
qrcode --small "<url>"`) — both force ANSI color escape codes by default,
which come out as unreadable raw escape-code soup once relayed through
chat (confirmed — tried it, got garbage, had to fix it). The script already
handles this correctly by calling `qrcode-terminal`'s library API directly
(`.generate(text, {small:true}, cb)`) instead of its CLI, which prints
plain unicode block characters with no color codes. Just run the script
and print what it gives you — don't reimplement this by hand.

Also always give the plain `exp://<ip>:<port>` connection URL as text
alongside the QR (the script prints this too) — Expo Go has an "Enter URL
manually" option, which is a text-only fallback that works even if the QR
render is distorted by an unusual terminal font or width.

Tell them, plainly:
1. "Install the free 'Expo Go' app from the App Store (iPhone) or Play Store (Android) — just like installing any other app. If it's already installed, open the store page for it anyway and update it — Expo Go only works with one specific version of the tools, so an old install will fail to open a fresh project." (See `troubleshooting.md` → "Project is incompatible with this version of Expo Go" — Phase 2's SDK check should have already prevented this, but mention it if it somehow still comes up.)
2. "Open your phone's camera (iPhone) or the Expo Go app's scan button (Android), and point it at this QR code." — referring to the image you just sent them, not terminal text.
3. "The app will open on your phone. Any time I change something, it'll update automatically — you don't need to rescan."

This requires their phone and your dev machine to be on the **same Wi-Fi
network** — if the QR scan fails, that's the first thing to check (see
`troubleshooting.md`).

Only reach for a local simulator/emulator (`environment-setup.md`) or the
`expo:eas-simulator` cloud simulator if:
- the user has no phone available, or
- they specifically ask to see it "on the computer."

Prefer the EAS cloud simulator over a local Xcode/Android Studio install
when a real phone isn't an option — it needs no local installs at all.

## Phase 4 — Iterate

Take feedback in the user's own words ("make the button bigger", "I want a
list of my recipes on the home screen") and translate it into code changes
yourself. Never ask them to describe a change in technical terms. After each
change, it reloads automatically on their phone — no rebuild, no reinstall.

## Phase 5 — Ship it

This is the phase where accounts and money enter the picture, and it's the
one place you truly cannot do everything for them — Apple and Google require
a human to sign up and pay. Be upfront about this early, ideally back in
Phase 0 if they mention wanting it on the App Store/Play Store eventually, so
it isn't a surprise later.

Hand off to the `expo:eas-app-stores` skill for the mechanics (eas.json
profiles, `eas build`, `eas submit`, version/build numbers, store metadata).
Before that skill's commands will work, the user needs:
- An Expo account (free) — `eas login` walks them through creating one.
- An Apple Developer Program membership ($99/year) if shipping to the App
  Store — sign-up is at developer.apple.com, human-only, involves identity
  verification. TestFlight beta testing needs this too.
- A Google Play Console account ($25 one-time) if shipping to the Play
  Store — play.google.com/console, also human-only.

Frame this plainly: "I can build the actual app for you, but Apple and
Google both require a real person (you) to sign up and pay a small fee
before either store will accept it — I can't do that part for you. Once
you've got the account, tell me and I'll handle the rest."

Because EAS Build compiles in Expo's cloud, none of this phase requires a
local Xcode or Android Studio install either — the whole journey from idea
to a published app can go through without ever touching either.

## When local Xcode/Android Studio genuinely make sense

- The user is doing serious native-module work Expo/EAS can't cover.
- They want an emulator/simulator running with no phone and no internet
  dependency on EAS's cloud simulator.
- They explicitly ask to install them.

In all of these cases, go to `environment-setup.md` for exact commands, and
follow its AUTO / ASK FIRST / USER MUST CLICK guidance — don't silently
kick off a 10GB Xcode download or an Android Studio install without saying
so first.
