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

### Porting an existing app

"Here's a working app in another language, port it" is a different job from
either half of this phase — Phase 0 is a conversation about an idea, Phase 2
scaffolds fresh, and neither fits. It's a common ask and it has its own rules.

**Where the original goes.** Keep it. Move the source into a clearly named
directory (`ios-native-original/`, `android-original/`) rather than deleting
it. It is the specification for everything you're about to write, it costs
nothing to keep, and its absence is only noticed at the moment it's most
expensive.

**Verify the backend still answers before writing a line.** A working app with
a dead API is the normal case for anything more than a few months old, and it
is a genuinely nasty trap: you write correct code, see an empty screen, and
spend an hour debugging yourself. Confirmed the hard way — an original's
RapidAPI subscription had lapsed and returned 403, and its free replacement
returned a single item where the paid tier had returned a list, which changes
the shape of the screen, not just the endpoint. `curl` the endpoints the
original uses, first thing. If one is dead, say so and settle the replacement
with the user before building against it.

**Carry the app icon and assets across.** They already exist and they're a
large part of why the port feels like the same app.

**The fidelity rule: faithful by default.** Port structure and behaviour as
they are. Deviate only where the platform forces it, or where the original had
a real bug — and *state every deviation* rather than quietly making it. The
user knows their app; a silent "improvement" reads as a port that got it
wrong, and they can't tell which of your changes were deliberate.

**Then rejoin the normal flow at Phase 0.5.** A port is subject to exactly the
same Expo Go gate as anything else, and the original being native tells you
nothing either way — most ports of ordinary apps fit Path A fine.

## Phase 0.5 — Does this fit Expo Go?

Decide this right after the Phase 0 conversation, before Phase 1 or Phase 2.
It changes SDK choice, what tooling Phase 1 needs to check for, and — most
visibly — what "let them see it live" even means in Phase 3. Working this
out only when you trip over it in Phase 3 is the expensive order: by then
you've already scaffolded and built every screen on an assumption that just
turned out wrong.

**The question:** does anything the user described need a native module
plain Expo Go doesn't ship? Expo Go is a fixed, pre-built binary — it only
contains whatever native modules Expo bundled into that specific release.
Anything else needs a custom-compiled binary (a "development build"), which
changes the entire preview story, not just one step of it.

**Concrete triggers** — if the idea includes any of these, assume a dev
build is needed until you can show otherwise:
- Home screen widgets, Live Activities, or an App Clip — a common, ordinary
  request that's easy to mistake for "just another screen." These are
  separate native targets Expo Go structurally cannot preview no matter what
  you do to the project, not a feature gap that a config tweak works around.
- Audio or video processing beyond basic playback (recording, trimming,
  custom encoding/decoding, real-time effects)
- Speech recognition or other on-device ML/inference
- Bluetooth
- HealthKit / health & fitness sensor data
- Background location
- Most payment SDKs (native Stripe, in-app purchase libraries beyond what
  Expo's own modules cover)
- Anything else that's "a real X integration," where X is a hardware or
  OS-level capability rather than a UI pattern

**Two fast cross-checks**, once you have candidate package names in mind:
- Does the package ship an `app.plugin.js` or an `expo-module.config.json`?
  That's a strong, checkable signal it needs a config plugin / native code —
  and therefore a dev build — almost every time.
- `npx expo-doctor` will **not** catch this for you. It checks version
  compatibility between installed packages, not whether a package can run
  inside Expo Go at all. A clean `expo-doctor` run says nothing about this
  question — don't treat it as reassurance here.

If still unsure, check the package's README for the words "Expo Go" or
"development build" — most Expo-ecosystem packages say explicitly which
category they're in.

**Outcome of this gate:**
- **Fits Expo Go** (most apps): proceed exactly as the rest of this doc
  describes. Phase 1 stays minimal, Phase 3 is the QR-code flow (Path A).
  Nothing below changes for you.
- **Needs a dev build**: say so now, in plain language, before scaffolding
  anything — e.g. "This app needs a couple of features your phone's basic
  preview app can't handle on its own. I can still get it running on your
  phone, it just needs one extra setup step first, and I want to walk you
  through what that involves before we start." Then read Phase 3's Path B
  section before Phase 1 — it changes what Phase 1 needs to check for.

**One thing this gate does *not* settle: Expo Go's own bugs.** Everything above
treats Expo Go as a fixed set of native modules — either your app's features
are inside it or they aren't. But it's also a fixed *binary*, and its own UI
chrome can be broken on a given OS version regardless of what your app does.
Path A is the low-risk path and stays the default; this is its one structural
risk, and it lands on the user's device where you can't see it.

The running list is in `troubleshooting.md` under **Known Expo Go
divergences** — currently the iOS 26 native-nav-bar hit-testing failure, which
is live right now and whose obvious workaround (a custom `headerLeft`) does not
work. Read it before concluding a dead control is your own code, and add to it
when you find a new one.

## Phase 1 — Check the environment

Run `scripts/doctor.sh`. Do this once per machine/session, not once per app.
It reports three verdicts — what the Expo Go path needs, what a dev-build path
would need, and how Phase 3 will actually deliver the app to the phone. Read
the first two according to what Phase 0.5 decided; read the third one always.

**If the preview-delivery verdict says EAS Update, act on it in this phase,
not in Phase 3.** It means the shell you're running commands in isn't on the
user's network — no LAN IP at all, or one inside RFC 5737's TEST-NET ranges,
which can never be a real host. Neither the QR flow nor `--tunnel` can work
from there, and the fallback that does work authenticates with an Expo access
token only the user can create (`environment-setup.md`, USER MUST CLICK).

Ask for it now, in the same breath as anything else you need from them, and
keep building while they fetch it. This is the whole point of checking at
Phase 1: a minute of their time here, versus a hard stop at Phase 3 with every
screen already written and nothing to show them. That is not hypothetical —
it's precisely how one real session went, and the signal (`192.0.2.2`, a
documentation-only address) was sitting there in Phase 1 the entire time.

**If Phase 0.5 said Expo Go fits** (the default path): only Node.js, npm,
and git are strictly needed — call out anything else missing from Core
Tools in `environment-setup.md` and fix it before scaffolding. Do **not**
proactively install Xcode, Android Studio, or any simulator at this point.
Those are Path A's Phase 3 doesn't need them, and most users never do —
Expo Go on their own phone covers preview, and EAS Build covers the final
app-store binary, both without any local native SDKs.

**If Phase 0.5 flagged a dev build**, this changes: you already know Phase 3
will need a drivable target (Path B, below), so it's worth resolving the
Android/iOS tooling question now instead of discovering it mid-build with
screens already written. You still don't need to install anything yet — but
read Path B's decision tree now, so you can tell the user the real cost and
timeline up front, in this same conversation, rather than after the fact.

## Phase 2 — Scaffold the project

**This step branches on Phase 0.5's answer — don't run it the same way for
both paths.**

If this is a port (see "Porting an existing app" in Phase 0), everything below
still applies unchanged — scaffold fresh, strip the demo content, then build
the screens *from the original* rather than from a conversation. The original
source stays in its own directory beside the new app; it has no `.ts`/`.tsx` in
it, so the app map and `tsc` ignore it on their own.

**Path A (fits Expo Go):** first, always run `scripts/check-expo-go-sdk.sh`.
`npx create-expo-app@latest` by itself always grabs the newest SDK, but the
Expo Go app published on the App Store/Play Store lags behind — sometimes by
weeks, while Apple/Google review the new build. Scaffolding at a newer SDK
than the store's Expo Go supports produces a project that cannot open on the
user's phone no matter how much they update the app, and it shows up as
"Project is incompatible with this version of Expo Go." Checking first
avoids the whole failure class instead of debugging it after the fact. See
`troubleshooting.md` for the full story if you're fixing an
already-scaffolded project instead of starting fresh.

**Path B (needs a dev build): skip `check-expo-go-sdk.sh` entirely.** It
answers "what SDK does the store's Expo Go support," and on this path that
question is irrelevant — nothing here will ever run inside Expo Go. Scaffold
at the newest SDK (`npx create-expo-app@latest` with no version tag) unless
the specific native package the app needs documents a minimum SDK of its
own, in which case scaffold at that version instead. **Do not follow the
Path A check's output on this path even if you already have it in front of
you** — this is a real, tested failure mode, not a hypothetical: a project
built around Expo's own `expo-widgets` package needed SDK 57 because that's
what the package required, but the store's Expo Go was still lagging on SDK
54 at the time. Scaffolding at the SDK the check printed would have locked
the project out of the very package it was built to use.

The scripts referenced throughout this file live in this plugin's own
`scripts/` directory. Reference them via `${CLAUDE_PLUGIN_ROOT}` — an
environment variable Claude Code sets to this plugin's install location,
which is normally available in every shell command you run and doesn't move
when you `cd` into the new project. Never hardcode an absolute path to the
plugin, and never use a path relative to your current working directory
instead.

**Verify it's actually set before relying on it.** `${CLAUDE_PLUGIN_ROOT}`
is not guaranteed to be present in every shell — confirmed in a real
session where it was unset, and every subsequent `${CLAUDE_PLUGIN_ROOT}/...`
command failed with "No such file or directory" until this was caught. One
cheap check, before the first script call of the session:
```bash
if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  echo "CLAUDE_PLUGIN_ROOT is unset — using the fallback below."
fi
```
If it's unset, fall back to the path Claude Code shows as "Base directory
for this skill" in the message where this skill was invoked — that's the
same location `${CLAUDE_PLUGIN_ROOT}` would have pointed to (it's how the
non-plugin, installed-as-a-skill copy of this same doc always does it, and
that path is always present regardless of whether the plugin env var is).
Capture that string once, at the start of the session, rather than
re-deriving it every time a script needs to run.

```bash
# Path A only:
${CLAUDE_PLUGIN_ROOT}/scripts/check-expo-go-sdk.sh
# prints the store-compatible SDK, e.g. "sdk-54"

npx create-expo-app@latest <app-name> --template default@sdk-54   # use the tag the script printed
cd <app-name>
```

Do not scaffold with `--template default` (no version tag) on Path A — that
always resolves to the newest SDK regardless of what the script reported.

```bash
# Path B only — no check-expo-go-sdk.sh, no version tag unless the native
# package you need documents a minimum:
npx create-expo-app@latest <app-name>
cd <app-name>
```

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
removes the demo tabs/explore/modal/components (on SDK ~57, this includes
`animated-icon.*` — Expo's own logo rendered as an animated splash overlay,
which has no business surviving into a real app and was found still present
after a run of this script, before that case was added), rewrites
`_layout.tsx` to a plain single-screen stack, writes a placeholder
`index.tsx`, and sets the app's display name in `app.json` — verified
end-to-end against real scaffolds of both shapes (`tsc --noEmit` and
`expo-doctor` clean afterward). Run both checks again after this script on
any project, same as after any other scaffold step — don't assume clean
just because a prior run was.

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
${CLAUDE_PLUGIN_ROOT}/scripts/setup-visual-loop.sh
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
node ${CLAUDE_PLUGIN_ROOT}/scripts/app-map.mjs   # writes app-map.md + app-map.json
```

Read `.claude/app-map.md` instead of crawling the project. It's a tree of every
source file annotated with its route, what imports it, what it imports, its
style names, the `risky` patterns, and the project's design constraints.

`.claude/app-map.json` beside it has the same map plus every `StyleSheet` rule
with `const`-referenced values already resolved (`width: BUTTON_SIZE` shows as
`88`) and the complete import/used-by graph. **That detail is most of the file's
size** — about six times the digest — so read the JSON when you need a specific
value or the full graph, not as the default. Rule 1 runs before every layout
edit, and reading the large one each time is where this skill's context budget
quietly goes. The digest marks whatever it truncates, so you always know when
there's more.

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
${CLAUDE_PLUGIN_ROOT}/scripts/ui-validate.sh        # gate 2
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

**Gate 2 says nothing whatsoever about navigation.** Its config aliases
`expo-router` to the stubs and renders every screen alone, so `router.push` is
a no-op and there is no navigator above anything. A back button that does
nothing passes this gate every time.

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/flow-validate.sh     # the other half
```

That builds the web export, serves it, and drives the **real** router in the
Chromium `setup-visual-loop.sh` already installed — no new dependency, just
the half that was already sitting there unused. It reports, per route, whether
a user can go somewhere and come back:

```
  /            after back: /            ✓
  /favorites   after back: /favorites   ✓
  /search      after back: /search      ✓
```

It is not part of the per-edit loop — the export costs about a minute. Run it
when navigation changed, before Phase 3's handoff, and any time a control is
reported as unresponsive.

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
node ${CLAUDE_PLUGIN_ROOT}/scripts/design-constraint.mjs add \
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

Which path depends on Phase 0.5's answer:
- **Path A — fits Expo Go** (the common case, below): the QR-code flow.
  Fast, free, no extra tooling. Unchanged from before, still the default.
- **Path B — needs a development build** (further down): the QR-code flow
  does not apply at all — Expo Go physically cannot load an app that uses
  native modules it wasn't built with. Skip straight to Path B.

### Path A — Expo Go preview (the default)

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

### When the dev server can't reach the phone at all

Everything above assumes the commands you're running execute on the user's
own computer, on the same network their phone can join. That's true for a
normal local Claude Code CLI session, but not for every way this skill can
be run — reported directly by a user: Claude Code's **mobile app** session
couldn't get a working tunnel, because the session's own network layer
blocked the proxy connection `expo start --tunnel` needs to set up. The
same reasoning applies to any other setup where the shell you're running
commands in isn't on the user's own network — a remote/cloud session in
general, not just the mobile app specifically.

If you know or suspect you're in one of these setups, don't spend time on
LAN IP or `--tunnel` first — both assume network adjacency to the phone that
structurally isn't there, and confirming that by trial and error before
falling back just costs the user a wait for something that was never going
to work. Signs you're in this situation: `make-preview-qr.sh`'s LAN IP
lookup comes back empty on what should be a normal machine, or `expo start
--tunnel` fails to establish with no clear network-misconfiguration cause on
the user's end.

**The fallback: EAS Update.** Instead of the phone connecting to a server
this machine hosts, publish the JS bundle to Expo's own cloud and have
Expo Go load it from there — no locally-hosted server or tunnel involved at
all.

This path is **verified end-to-end** (a SwiftUI→Expo port on SDK 54, run from
a remote cloud session, Aug 2026). Every line below is load-bearing, and the
three obvious ways to shorten it all fail:

```bash
export EXPO_TOKEN="…"   # from the user — see environment-setup.md. `eas login`
                        # is interactive and cannot work in a remote session;
                        # the token is the only non-interactive auth path.

eas init --non-interactive --force
eas update:configure --non-interactive
eas channel:create preview --non-interactive
EXPO_GO_PREVIEW=1 eas update --branch preview --message "preview"
```

Why each of those, in the order they bite:

- **`eas init --force` first, and don't skip it.** Starting at
  `update:configure` skips creating the EAS project record, and `eas init`
  without `--force` refuses in non-interactive mode with *"Project does not
  exist"*.
- **A branch is not a channel.** `eas update --branch preview` creates a
  *branch*; Expo Go asks for a *channel*. Without an explicit
  `eas channel:create`, the manifest endpoint 404s with *"There is no channel
  named preview"*.
- **The runtime version `update:configure` writes is one Expo Go can never
  load.** It sets `{"policy":"appVersion"}`, which stamps updates `1.0.0`.
  Expo Go only ever asks for `exposdk:NN.0.0`. The mismatch answers **HTTP 204
  No Content** — not an error. Everything on your side reports success,
  `✔ Published!` included, and the failure exists only on the user's phone:
  the QR scans, Expo Go opens, nothing happens.

That last one is what `EXPO_GO_PREVIEW=1` is for. Add an `app.config.js` that
publishes the runtime version Expo Go actually asks for when that variable is
set, while keeping `appVersion` for real store builds:

```js
// app.config.js — app.json still holds the config; this wraps it.
// Deriving the SDK number beats hardcoding it: a stale literal here
// reintroduces the silent 204 the next time the project moves SDK.
const SDK_MAJOR = require('./package.json').dependencies.expo.match(/\d+/)[0];

export default ({ config }) => ({
  ...config,
  runtimeVersion: process.env.EXPO_GO_PREVIEW
    ? `exposdk:${SDK_MAJOR}.0.0`   // what Expo Go asks for
    : { policy: 'appVersion' },    // correct for EAS Build / store releases
});
```

Both can live on one branch — EAS serves each client the newest update
matching that client's own runtime version, so a preview publish and a store
build don't collide.

**Then confirm the phone will actually get a bundle, before you say a word to
the user:**

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/verify-expo-go-update.sh . preview
```

That asks `u.expo.dev` with exactly the headers Expo Go sends, and tells you
200 (the phone will load it), 204 (runtime mismatch) or 404 (no channel). It
is the only thing standing between "the CLI said Published!" and the user
scanning a QR code that can never work. Don't skip it because the publish
looked clean — a clean publish is exactly what this failure looks like.

Only once that passes, build the QR. `make-preview-qr.sh` accepts a full URL
as well as a bare port, so no new renderer is needed:

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/make-preview-qr.sh "<update URL>" /tmp/preview-qr.png
```

Take the URL from `eas update`'s output where it prints one. If you have to
build it yourself, the manifest URL is
`https://u.expo.dev/<projectId>?channel-name=preview` (the same `<projectId>`
that `app.json`'s `expo.updates.url` ends with), and Expo Go opens that same
URL under the `exp://` scheme. Whichever way you get it, the verifier above —
not the URL's shape — is what tells you it works.

Two things that remain true on this path:

- **It does not live-reload.** Expo Go loads whatever was last published, and
  typically only re-checks on a fresh app open/foreground. After every code
  change in Phase 4, re-run the `eas update` line *and* tell the user to close
  and reopen the app — don't let them sit waiting for a refresh that isn't
  coming.
- `eas update:configure --non-interactive` does **not** hang. An earlier
  version of this doc warned that it might; it doesn't. If something in this
  sequence does hang, it's an auth prompt — check `EXPO_TOKEN` is exported.

### Path B — development build preview

Say this up front, plainly, before doing anything else in this phase: "The
quick scan-a-QR-code preview isn't available for this app, because it uses
a couple of features your phone's basic preview app doesn't include. I'll
still get a real version running on your phone — it just needs one extra
build step first, which I'll walk you through." Don't let the user sit
waiting for a QR code that Path A would have produced by now but this path
never will — say why immediately, not after they ask.

#### Install expo-dev-client — this is what makes it a dev build at all

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
nothing. This compounds with the stale-server problem below: passing `--port`
looks like it should fix a port collision, and on this path it won't, with no
error telling you why.

#### The decision: Android vs iOS

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

#### Verification is not required for Path A. It is not optional for Path B.

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

## Phase 4 — Iterate

Take feedback in the user's own words ("make the button bigger", "I want a
list of my recipes on the home screen") and translate it into code changes
yourself. Never ask them to describe a change in technical terms. After each
change, it reloads automatically on their phone — no rebuild, no reinstall.

**Run both gates again after every change**, not just the first time:

```bash
npx tsc --noEmit && ${CLAUDE_PLUGIN_ROOT}/scripts/ui-validate.sh
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

**The bugs in this phase are not the bugs in Phase 2.** Once the app is on the
phone, everything left is a *runtime* problem, reported in one sentence by
someone who cannot see a stack trace and has no vocabulary for what they're
seeing. Neither gate above covers that: `tsc` sees types, `ui-validate.sh` sees
geometry, and a control that does nothing at all is invisible to both.

Two things keep this phase bounded, and they are the two most valuable habits
in the skill:

- **`troubleshooting.md` → "A control doesn't respond, but the app otherwise
  works."** Start with the discriminating question — *does it do nothing, or
  the wrong thing?* — before writing a line of code. It splits the search space
  in half for the cost of one sentence.
- **Validation-loop rule 5.** When a bug shows on some screens and not others,
  enumerate what differs before editing. Get that observation before the
  *second* fix, not the third. Three round-trips on one back button is the
  documented cost of skipping it.

And run `flow-validate.sh` rather than reasoning about navigation from the
source. It's about ten minutes of work already done for you, and it turns "back
is broken" into a table.

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

Needing a development build (Phase 0.5, Path B above) is *not* by itself a
reason to install local Xcode or Android Studio — EAS Build covers Android
dev builds and `expo:eas-simulator` covers iOS verification, both without
touching either. Only reach for a local install when:

- The user is doing serious native-module work Expo/EAS can't cover.
- They want an emulator/simulator running with no phone and no internet
  dependency on EAS's cloud simulator.
- They explicitly ask to install them.

In all of these cases, go to `environment-setup.md` for exact commands, and
follow its AUTO / ASK FIRST / USER MUST CLICK guidance — don't silently
kick off a 10GB Xcode download or an Android Studio install without saying
so first.
