---
name: mobile-app-builder
description: Build a real mobile app (iOS/Android) end-to-end for a non-technical user, from idea to something running on their own phone to an App Store/Play Store release, handling all the developer-tooling setup (Node, Homebrew, Xcode/Android Studio, Expo/EAS CLI) automatically or with a single plain-language approval — never exposing terminal output, jargon, or setup decisions to the user. Use whenever someone who isn't a programmer asks for an app to be built for them, wants help getting an app onto their phone, or asks about installing Xcode/Android Studio/dev tools for a mobile project. Built on top of the expo:* skills (expo-project-structure, expo-router, expo-native-ui, expo-ui, expo-data-fetching, eas-app-stores, eas-simulator, expo-dev-client).
version: 1.9.0
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
required** to go from an idea to a published app, *when the app's features
fit inside Expo Go*:

- **Preview**: the user's own phone + the free Expo Go app (scan a QR code).
  No Xcode, no Android Studio, no simulator.
- **Publish**: EAS Build compiles the app in Expo's cloud. Still no local
  Xcode or Android Studio needed, even for the final App Store / Play Store
  binary.

This is Path A, and it's still the default — most apps fit inside Expo Go,
and its speed is the point. But some apps genuinely can't: anything needing
audio/video processing beyond playback, speech recognition, Bluetooth,
HealthKit, background location, or most other native-module territory needs
a compiled "development build" instead, which Expo Go structurally cannot
preview no matter what you do to the project. Phase 0.5 below decides which
path an app is on, **before** scaffolding — not in Phase 3, after screens
already exist on the wrong assumption. Only install Xcode/Android Studio
when Phase 0.5 actually calls for it (or the user has no phone, or
explicitly wants a local simulator) — and even then, follow the AUTO / ASK
FIRST / USER MUST CLICK tiers in `references/environment-setup.md` exactly.
Don't over-install.

## Phases (full detail in references/build-flow.md)

These are `build-flow.md`'s numbers, not a second scheme — one set of phase
numbers across the whole skill, so a cross-reference never needs translating.

- **Phase 0 — Understand the idea.** A short plain-language conversation, not
  a spec form. If they already have a working app in another language, this is
  a *port*, which has its own rules — see "Porting an existing app" in
  `build-flow.md`.
- **Phase 0.5 — Does this fit Expo Go?** Decide right after the Phase 0
  conversation, before touching anything else. Concrete trigger list and
  cross-checks in `build-flow.md`. This choice determines whether Phase 3 is
  the fast QR-code path (Path A, the default) or a development-build path
  (Path B) that needs different tooling and a different, non-negotiable
  verification step — get this right early, it's expensive to discover late.
- **Phase 1 — Check the environment.** Run `scripts/doctor.sh` once per
  machine/session. It reports three verdicts: the Expo Go path's needs, the
  dev-build path's needs, and how Phase 3 will actually reach the user's
  phone. Read the first two according to Phase 0.5; read the third always. If
  it says EAS Update, ask the user for an Expo access token **now** — it's the
  one thing on that path only they can do, and it costs them a minute here
  versus a hard stop at Phase 3 with the whole app already built.
- **Phase 2 — Scaffold the project, build the screens, and verify.** This
  branches on Phase 0.5's answer. **Path A:**
   run `scripts/check-expo-go-sdk.sh` *first* and scaffold at the SDK tag it
   prints (`--template default@sdk-NN`), not plain `@latest` — the App
   Store's Expo Go build regularly lags the newest SDK by weeks, and
   scaffolding ahead of it produces a project that can never open on the
   user's phone (see `troubleshooting.md`). **Path B:** skip that check
   entirely — Expo Go compatibility is irrelevant to a dev build — and
   scaffold at latest (or whatever SDK the native package you need actually
   requires). Following Path A's check on Path B is a real, tested mistake:
   it can lock the project below the SDK a required native package needs
   (confirmed with `expo-widgets`, which required SDK 57 while the check was
   still reporting the store's SDK 54). Then run
   `scripts/strip-demo-scaffold.sh --name "Display Name"` to remove the
   template's demo tabs/explore/modal content and drop to a clean
   single-screen stack (verified end-to-end on both known template shapes —
   don't redo this by hand). Then build the real screens out using the
   `expo:*` skills (project structure, router, native UI, data fetching).
   Before this phase ends, both gates must pass: `npx tsc --noEmit`, then
   `scripts/ui-validate.sh` (see "The validation loop" below). Never hand a
   broken bundle *or* a broken layout to a non-technical user.
- **Phase 3 — Let them see it live.**
   **Path A (fits Expo Go, the default):** start `npx expo start` in the
   background, build the connection QR yourself with
   `scripts/make-preview-qr.sh` (Expo CLI's own QR only renders in an
   interactive terminal, which a background process never has — confirmed
   by testing, don't wait for it to appear), and print the ASCII QR the
   script outputs **directly in your reply** — that's the primary,
   always-works method, not SendUserFile-ing the PNG (confirmed by testing:
   that silently "succeeds" with no error in a plain terminal session and
   the user never sees it — no image viewer to show it in). Only attach the
   PNG as an extra once you already know images render for this session.
   This is the milestone that matters most on Path A — get here fast, and
   get it right the first time (print it once, cleanly — don't experiment
   with alternate QR commands in front of the user; the script already
   avoids the ANSI-color-garbage trap those fall into). **Path B (needs a
   dev build):** the QR flow does not apply at all — say so plainly up
   front, then follow `build-flow.md`'s Path B decision tree (Android via
   EAS cloud build is the cheap route; iOS has no free path). On Path B,
   actually driving a simulator or emulator yourself before calling the app
   ready is a required step, not optional — see "Verification is not
   optional on this path" in `build-flow.md`.
- **Phase 4 — Iterate.** Take feedback in their own words, translate it to
  code. Every bug from here on is a *runtime* bug reported in one sentence by
  someone who can't see a stack trace — the hardest kind, and the phase that
  eats the most time. Rules 3 and 5 of the validation loop are what keep it
  bounded.
- **Phase 5 — Ship it.** `expo:eas-app-stores` for the cloud build/submit
  mechanics; be upfront that Apple ($99/yr) and Google ($25 one-time)
  developer accounts are the one part only the user can do (identity +
  payment).

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

## The validation loop — five rules, all mandatory

A non-technical user cannot tell you the layout is broken in terms you can
act on. "It looks weird" is the most detail you will ever get, and often you
won't get even that — they'll assume it's meant to look like that. So you
check it yourself, before they ever see it. Full mechanics live in
`references/build-flow.md` Phase 2; these five rules are non-negotiable.

Two checks, and they answer different questions. Reaching for the wrong one
wastes a phase:

- **`ui-validate.sh` — does this screen hold together?** Geometry, one screen
  at a time, rendered in isolation with the router stubbed out.
- **`flow-validate.sh` — can a user get from A to B and back?** The real
  router, real navigation, real data, driven in a browser.

**1. Read the map and the ledger before you write layout code.**
Run `node scripts/app-map.mjs`, then read **`.claude/app-map.md`** — a tree of
the project annotated with each file's route, what imports it, what it imports,
its style names, the `risky` list of patterns that break on device, and the
layouts that already failed in *this* project. One read replaces a directory
crawl; a grep sweep of an app you already have a map of is waste.

**Read the digest, not the JSON.** `app-map.json` holds the same map plus every
resolved `StyleSheet` value and the full import graph, and those make it roughly
six times larger — ~4.8k tokens against ~800 on a two-screen app, before every
layout edit, growing with every screen added. Open it only when you need a
specific style value or the complete used-by list. The digest marks everything
it truncates, so you can always tell when there's more to fetch.

**2. After `tsc` passes, run `scripts/ui-validate.sh`. Silently.**
It renders every screen headless at phone size and checks real geometry:
nothing off-screen, nothing collapsed, no text clipped, no tap target under
44×44, no overlapping controls, no content stranded below the fold. It
prints one status line and writes everything else to
`.claude/visual/last-run.json`. On failure, **look at the diff and actual
images it lists** — you can see them, that's the point — then fix the
layout and run it again. Don't show a non-technical user a test, a log, or a
file path — running the check silently is unconditional, but what you *say*
about it is calibrated to who you're talking to (`plain-language.md`).

**3. Three attempts, then stop and talk like a person.**
`last-run.json` carries `attempts`. At `status: "blocked"` you are done
editing that layout. Do **not** mention tests, code, CSS, retries, or ask
the user anything technical. Say the design has a constraint, in plain
English, and offer exactly two simpler alternatives that you are confident
will work — concrete and visual ("one card per row, full width" / "a
compact list with the picture on the left"), never "shall I refactor the
flex container?". They pick, you build it. This is a normal design
conversation to them, and it should read as one.

**4. Record what failed, so it can't happen twice.**
Once they choose, run `scripts/design-constraint.mjs add` with the file, the
pattern that failed, the styles involved, and the alternative they picked.
That writes `.claude/design-constraints.json`, which rule 1 makes you read
next time. Skipping this means the next similar request walks into the same
wall, burns three more attempts, and hands them the same apology again —
which reads to them as the tool being unreliable, not as a hard layout
problem.

**5. When a bug reproduces on some screens but not others, enumerate what
differs before changing any code. The difference is the bug.**
Rule 3 bounds *layout* attempts. Behaviour bugs had no equivalent, and the
result was three fixes for one broken back button across three round-trips —
exactly the loop rule 3 exists to prevent, in a category it didn't cover.
Twice, the decisive evidence was an asymmetry already in hand and not mined:
one tab worked because `/` *was* that tab, so a `router.replace('/')` fallback
was masking the bug everywhere else; then one screen still failed because it
was the only one wrapping its rows in a gesture-handler component.

So: **before the second fix — not the third — get the discriminating
observation.** Usually that's one plain question, asked outright rather than
buried in an option description. For an unresponsive control the cheapest
discriminator is *"does it do nothing, or the wrong thing?"* — those two
answers point in opposite directions, and either is worth more than another
speculative edit. `flow-validate.sh` answers the same question mechanically
when the flow is reachable in a browser; prefer it to guessing.

### What the check actually proves (and what it doesn't)

It renders **react-native-web in headless Chromium**, not iOS or Android. It
is a strong structural proxy and a weak fidelity one:

- **Caught reliably:** content off the edge, collapsed containers, clipped
  text, unreachable content, tap targets too small, overlapping controls,
  and any layout regression between two runs on the same machine.
- **Not caught at all:** platform fonts and metrics, safe-area insets,
  native shadows/blur, keyboard avoidance, gestures, and anything rendered
  by `@expo/ui` — those are native controls with no web build, so screens
  using them are skipped outright rather than checked against a fake.
- **Navigation is not covered at all**, and not by oversight: the config
  aliases `expo-router` to the stubs, where `router.push` is `() => {}` and
  `useLocalSearchParams` returns `{}`, and every screen renders alone with no
  navigator above it. That's correct for measuring geometry and it makes
  flows untestable here by construction. A broken back button passes this
  check every time. That's what `flow-validate.sh` is for — a sibling
  capability, not a gap to work around inside this one.

A pass means "structurally sound", never "this is what the phone shows".
The phone preview in Phase 3 is still the real verification, and the user's
eyes are still the final say.

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
  anything) to act on. Reports two separate verdicts — what the Expo Go
  path needs and what a development-build path would need — since Phase
  0.5 decides which one applies before this even runs.
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
- `scripts/setup-visual-loop.sh [projectDir]` — one-time, per project, right
  after scaffolding. Installs the headless checker (vitest + Playwright
  Chromium + react-native-web) and writes its config into `.claude/visual/`.
  Every byte of install output goes to `.claude/logs/setup.log`; it prints
  one status line and nothing else. Adds `.claude/` to `.gitignore` so none
  of this apparatus ends up in the user's project history.
- `scripts/app-map.mjs [projectDir]` — read-only. Writes two files:
  **`.claude/app-map.md`**, a compact annotated tree — routes, what imports
  what, style names, `risky` patterns, and the design constraints — and
  `.claude/app-map.json`, the same map plus every resolved `StyleSheet` value
  and the full import graph. **Read the `.md`; reach for the `.json` only when
  you need a specific value.** The JSON is ~6× the tokens and rule 1 has you
  reading it before every layout edit, which is where this skill's context
  budget actually goes. Uses the project's own `typescript` (adds no
  dependency); exits 3 if it can't find one, in which case just read files
  normally.
- `scripts/ui-validate.sh [projectDir]` — the loop. Refreshes the map,
  regenerates one check per screen, runs them headless, and writes
  `.claude/visual/last-run.json`. `STATUS=pass|seeded|fail|blocked`. Silent
  to the user by construction — but never silent to you: read
  `last-run.json` after any non-zero exit rather than re-running it with
  output showing.
- `scripts/flow-validate.sh [projectDir]` — the other half. Builds the web
  export, serves it, and drives the **real** router in the Chromium
  `setup-visual-loop.sh` already installed, reporting per route whether a user
  can go somewhere and get back. Adds no dependency. Run it when navigation
  changed or a control is reported as unresponsive — not on every edit; the
  export step costs about a minute.
- `scripts/design-constraint.mjs add|list [projectDir]` — the ledger from
  rule 4. `add --file … --pattern … --checks … --styles … --chose …`.
- `scripts/verify-expo-go-update.sh [projectId|projectDir] [channel]` — asks
  Expo's update server for a bundle exactly the way Expo Go asks, and says
  whether the phone would actually get one. Mandatory before handing over a QR
  code on the EAS Update fallback: that path fails *silently* — `✔ Published!`
  and an HTTP 204 the user's phone quietly does nothing with.
- `scripts/gen-visual-tests.mjs`, `scripts/collect-visual-result.mjs`,
  `scripts/flow-drive.mjs` — internals of `ui-validate.sh` and
  `flow-validate.sh`. Don't call them directly.
- `templates/` — the config, test bootstrap, layout assertions and
  native-module stubs that `setup-visual-loop.sh` copies into a project. If
  a screen fails to import a native-only Expo module, add the missing export
  to `templates/expo-stubs.tsx` — that's a stub gap, not a layout bug.
- `scripts/make-preview-qr.sh <port|full-url> [output.png]` — prints a clean
  ASCII QR code straight to stdout (print this in your reply — it's the
  primary delivery method, proven reliable in both terminal and GUI
  sessions) and optionally also writes a PNG as a bonus for known-GUI
  sessions. Use this every time instead of expecting Expo CLI to print its
  own QR code — it won't, in a background process — or hand-rolling a
  `qrcode`/`qrcode-terminal` CLI call yourself, which produces unreadable
  ANSI garbage unless invoked exactly the way this script does (Phase 3,
  `troubleshooting.md`). Also accepts a full URL (anything containing
  `://`) instead of a port, skipping LAN IP lookup entirely — for the EAS
  Update fallback when this session isn't on the user's own network at all
  (`build-flow.md`, "When the dev server can't reach the phone at all").
