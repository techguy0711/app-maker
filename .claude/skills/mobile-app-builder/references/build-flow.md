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

The scripts referenced throughout this file live in this skill's own
`scripts/` directory — use the absolute path shown as "Base directory for
this skill" wherever this skill was invoked (it doesn't move when you `cd`
into the new project), not a path relative to your current working
directory.

```bash
<skill-base-dir>/scripts/check-expo-go-sdk.sh
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
<skill-base-dir>/scripts/strip-demo-scaffold.sh --name "Display Name"
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

**Set up the visual check now, before you write any screens.** It needs to
exist before the first layout does, so the first thing the user sees has
already been checked:

```bash
<skill-base-dir>/scripts/setup-visual-loop.sh
```

It installs the headless renderer and Playwright's Chromium, writes its
config into `.claude/visual/`, creates an empty
`.claude/design-constraints.json`, and adds `.claude/` to `.gitignore`.
Everything it prints goes to `.claude/logs/setup.log` — the user sees
nothing, and you get one line: `STATUS=ready`, or `STATUS=install-failed
STEP=...` with the log path.

If it fails, **do not retry it in a loop and do not tell the user about it**.
Read the log, note that visual checking is unavailable for this project, and
carry on building — the app itself is unaffected, you have just lost a
safety net. Say nothing; there is no action for them to take.

Use the `expo:expo-project-structure` skill to lay out folders correctly from
the start (this is a brand-new project, so it applies cleanly — never
retrofit structure onto an existing app).

Use `expo:expo-router` for navigation/screens, and `expo:expo-native-ui` (plus
`expo:expo-ui` for native SwiftUI/Jetpack Compose components where a native
control — toggle, picker, sheet — genuinely fits better than a plain RN one)
to build the actual screens matching what the user described in Phase 0.

If the app needs to talk to any API or store data remotely, use
`expo:expo-data-fetching`.

### Before you write layout code: read the map and the ledger

```bash
node <skill-base-dir>/scripts/app-map.mjs      # writes .claude/app-map.json
```

Read that one file instead of crawling the project. It gives you every route
and the file behind it, every component, the import and used-by graph, every
`StyleSheet` rule with `const`-referenced values already resolved
(`width: BUTTON_SIZE` shows as `88`), a `risky` list of style patterns that
break on device, and the project's design constraints inlined.

Two parts earn their keep every time:

- **`risky`** — deliberately narrow, and quiet on healthy code. Verified
  against both example apps in this repo: zero findings on either, seven
  findings on a file written to contain seven known bugs. If it fires, it's
  worth looking at.
- **`constraints`** — layouts that already failed three times *in this
  project*, with the alternative the user picked. Never re-attempt a pattern
  listed there. That's the whole point of having written it down.

It uses the project's own `typescript`, so it adds no dependency. If it exits
3 (no local typescript), just read files the normal way.

### Verify — don't assume. Two gates, in order.

```bash
npx tsc --noEmit                                    # gate 1
<skill-base-dir>/scripts/ui-validate.sh        # gate 2
```

**Gate 1, `tsc`, is non-negotiable.** Treat any error as blocking. A
non-technical user has no way to tell "the app crashed because of my code"
apart from "the app is broken," and every failure reads to them as the tool
not working. `npx expo-doctor` is a good extra pass too (dependency/version
sanity checks) but `tsc` is the minimum.

**Gate 2, `ui-validate.sh`, catches what `tsc` can't see.** Type-correct code
produces broken layouts constantly — a row that overflows a 390px screen, a
`position: absolute` container that collapsed to zero height, a 30×30 button
nobody can hit. The script renders every screen headless at phone size,
checks the real geometry the browser computed, and compares against the
previous run.

It prints one line and writes everything else to
`.claude/visual/last-run.json`:

| STATUS | What it means | What you do |
|---|---|---|
| `pass` | Layout is structurally sound | Continue to Phase 3 |
| `seeded` | First run; reference images just created | Continue — nothing failed |
| `fail` | Real defect, `attempts` below 3 | Fix it, run again |
| `blocked` | Same failure 3 times | Stop. Fallback below. |
| `not-configured` | Setup never ran or failed | Skip the gate, carry on silently |
| `blocked-infra` | The suite itself couldn't run | Read the log. **Not** a layout problem — do not redesign anything |

On `fail`, read `last-run.json`. Layout failures name the element, the check,
and the exact pixel amount (`Extends 84px past the right edge of a 390px
screen`) — fix that, specifically, rather than reshuffling the layout and
hoping. Screenshot failures list `diff`, `actual` and `reference` image
paths: **open the diff image and look at it** before changing anything. Red
areas are what moved. That's what the vision capability is for here.

Two behaviours that are easy to get wrong and expensive when you do:

- **The first run on a new screen "fails" by design.** Vitest has no
  reference image yet, so it writes one and reports failure. The script
  detects this, re-runs, and reports `seeded`. It costs no attempt. Never
  treat a brand-new screen's first run as a broken layout.
- **The attempt budget keys on *which* failure, not just a count.** Fix one
  problem and uncover a different one, and the counter resets to 1 — the new
  problem gets a full budget instead of inheriting an exhausted one. So
  `attempts: 3` genuinely means "the same thing failed three times", which
  is what makes the fallback below trustworthy.

### When it's `blocked`: the non-technical fallback

Three attempts at the same failure means the layout isn't going to work.
Stop editing it.

Do **not** mention the test, the code, the styles, the retries, or a file
path. Do **not** ask them anything technical — not "should I use flexWrap",
not "is a scroll view okay", not "can you check if this looks right". They
cannot answer those and being asked makes them feel like the tool is
failing and it's somehow their job to fix it.

Present it as a design constraint, in their language, with two concrete
alternatives you are confident will work. Describe what they'd *see*, not
what you'd *do*:

> "Three cards side by side ends up too cramped on a phone screen — the
> third one runs off the edge. Two options that'll look much better:
> **(a)** one card per row, full width, so each one's easy to read and tap,
> or **(b)** a compact list with the picture on the left and the name beside
> it, which fits more on screen at once. Which do you prefer?"

Then build the one they chose, and record it:

```bash
node <skill-base-dir>/scripts/design-constraint.mjs add \
  --file app/index.tsx \
  --pattern "three cards side by side at phone width" \
  --checks overflow-right,small-tap-target \
  --styles '{"flexDirection":"row","gap":24}' \
  --chose "One card per row, full width"
```

That writes `.claude/design-constraints.json`, which the app-map inlines and
you read before every layout change from then on. Without it you will reach
for the same pattern the next time they ask for something similar, burn three
more attempts, and hand them the same apology twice — which reads as an
unreliable tool rather than a real constraint.

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
<skill-base-dir>/scripts/make-preview-qr.sh 8081 /tmp/preview-qr.png
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

**Run both gates again after every change**, not just the first time:

```bash
npx tsc --noEmit && <skill-base-dir>/scripts/ui-validate.sh
```

This is where the screenshot comparison finally earns its cost. On the first
build it had no reference to compare against and only the geometry
assertions did real work; from here on it also catches the *regression*
case — the change they asked for quietly breaking a screen they didn't ask
about. That's the failure mode a non-technical user is least likely to
report and most likely to be annoyed by, because to them nothing about that
screen changed.

If a screen legitimately looks different now because they asked it to,
that's not a regression — the reference image is simply stale. Delete the
stale reference under `.claude/visual/tests/__screenshots__/` and re-run;
the next run seeds a new one. Don't fight a diff that's showing you exactly
the change you were asked to make.

If it comes back `blocked`, use the same plain-language fallback and record
the constraint — an iteration hitting a wall gets handled identically to a
first build hitting one.

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
