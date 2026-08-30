# Six ways an agent building mobile apps fails, and the guards that fixed them

I built a Claude Code and Codex plugin that takes someone who doesn't code from
a sentence — *"an app where I track my daily water intake with a big plus
button"* — to that app running on their phone, and optionally into the App
Store.

The interesting part wasn't the happy path. It was the six weeks of failures
that produced the guards, because almost none of them were the failures I
expected. Every one below is a real postmortem with a fix that shipped.

---

## 1. The SDK that exists, but that no phone can run

`npx create-expo-app@latest` scaffolds against the newest Expo SDK the day you
run it. That sounds correct. It is a trap.

Since SDK 50, the Expo Go app supports **exactly one** SDK version — the one
matching its own store release, not a range. Every new SDK needs a new Expo Go
build, which Apple and Google then review, and that review routinely takes
weeks. So there is regularly a window where the newest SDK has no matching
Expo Go build in either store.

Scaffold during that window and you produce a project that **can never open on
the user's phone**. Not slowly. Not with a warning. It just refuses. And the
error text — "requires a newer version of Expo Go" — sends you down the exact
wrong path, because no amount of updating Expo Go fixes it. The build the user
needs does not exist yet.

Confirmed live while building this: SDK 57 shipped June 30, 2026. Two months
later the store's Expo Go still only supported SDK 54.

The guard is to stop guessing and ask the source of truth before scaffolding:

```bash
curl -s https://api.expo.dev/v2/versions/latest \
  | node -e "let d='';process.stdin.on('data',x=>d+=x);
             process.stdin.on('end',()=>console.log(JSON.parse(d).data.expoGoSdkVersion))"
```

Then pin the scaffold to whatever that returns: `--template default@sdk-54`.

Two things I got wrong before landing on that.

**Reasoning about it doesn't work.** An agent looking at npm sees SDK 57
published, stable, well-downloaded, and concludes it's safe. But the gating
variable isn't the SDK's maturity — it's a review queue at Apple. Those are
uncorrelated. The model was confidently predicting the wrong quantity.

**So when the API is unreachable, it's a hard stop, not a warning.** Guessing
high and guessing low both produce an unopenable app, so there is no safe
default to fall back to. The agent asks the user one concrete question instead:
*open Expo Go, read the number on the home screen.* An agent that can't verify
something load-bearing should ask, not average.

And you cannot repair this after the fact. `npx expo install expo@<older>`
followed by `expo install --fix` looks like it works — it rewrites
`package.json` — but it leaves the newer template's *source files* in place.
SDK 57's `_layout.tsx` imports `ThemeProvider` from `expo-router`, which SDK
54's `expo-router` doesn't export, and you get `TS2305` errors out of a
"successful" downgrade. Re-scaffold at the right SDK and re-apply your own
screens on top.

## 2. The QR code that cannot print

Phase 3 hands the user a QR code to scan. Expo CLI prints one. So: start the
dev server, read the QR out of its output, done.

It never appears.

Expo CLI draws its QR and connection URL through an interactive terminal UI
gated on `stdout` being a real TTY. A dev server is long-running, so an agent
has to background it — and a backgrounded process is never a TTY. The output
isn't late. It is never coming.

I watched an early version poll that log for a QR code while the phone had
*already connected and loaded the bundle successfully*. The thing it was
waiting for had structurally never been possible.

The fix is to generate the QR from the URL instead of scraping it. Two
follow-on lessons from getting the delivery wrong:

- **Sending the PNG silently "succeeds" and reaches nobody.** In a plain
  terminal session there's no image viewer. The tool call returns success. The
  user sees nothing and waits. Render ASCII in terminals; send the PNG only in
  hosts that display images.
- **Don't hand-roll the QR command.** Both `qrcode-terminal` and `qrcode`
  force ANSI color escapes from their CLIs, which arrive in a chat transcript
  as garbled fragments. Calling `qrcode-terminal`'s library API directly
  produces clean output. A user who watches you emit a broken QR, notice, and
  fix it concludes the tool is broken — even after it's working.

## 3. The git check that nearly committed someone's Documents folder

`create-expo-app` asks whether to skip `git init` when it detects it's inside
an existing repo. Non-interactively it can't be answered, so it silently skips,
and the new project ends up with no repo of its own. Fine — detect that
afterward and init one.

The obvious detector is the wrong one:

```bash
git rev-parse --is-inside-work-tree   # DON'T
```

That answers *"is this folder inside some repo?"* — true for every subfolder of
any ancestor repo. On my own machine a stray `git init`, run years earlier one
directory too high, had a repo rooted near `Documents`, quietly containing
personal files, certificates, and unrelated projects.

So the check returned true, the agent skipped `git init`, and the next command
in the sequence — `git add -A` — ran against **that** repo. It began staging
the entire ancestor tree. It had to be killed on a command timeout. A commit
after it would have swept a large swath of unrelated personal files into a repo
the user never intended to touch.

The correct check compares the repo's root to the current directory:

```bash
[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ] || git init
```

The general lesson is worth more than the one-liner: **a destructive command's
blast radius is set by state the agent never inspected.** `git add -A` is only
as scoped as the repo it resolves to, and nothing in the command says which one
that is. Anything that writes needs its scope asserted, not inferred — and
"this is running unexpectedly slowly against an unexpectedly large tree" is a
signal to stop, not to wait.

## 4. The retry budget that never ran out

Layout fixes get three attempts. Three failures on the same problem and the
agent stops editing, tells the user plainly that the layout won't fit, and
offers two simpler alternatives it can actually build.

In testing the loop ran forever. Measured: five consecutive failures with the
attempt counter still reading 1.

The counter was keyed on the *elements* that failed. Each fix changed the set
slightly — a tap target gets fixed, something else clips — so every iteration
looked like a brand-new problem and reset the count. Partial progress read as
success. The budget was structurally unable to be spent.

Re-keying it on the distinct **check types** per file fixed it. Same three
attempts, but "text is clipped in this file" stays the same problem while its
specific offenders churn.

The bug wasn't the number three. It was that the identity function for "the
same problem" was defined at the wrong altitude — and an agent making local
progress on a global dead end will happily do that forever.

## 5. Two test suites, one blind spot

There are two validation loops before the user ever sees a screen, and the
distinction between them is the whole point.

`ui-validate.sh` asks **does this screen hold together?** It renders every
screen headless at phone dimensions in react-native-web and checks real
geometry: nothing off-screen, nothing collapsed, no clipped text, no tap target
under 44×44, nothing stranded below the fold.

To do that fast it stubs the router out — which means **a broken back button
passes it every single time.** That's not a bug in the check, but it is a hole
you can drive a release through.

`flow-validate.sh` covers it by asking a different question — **can a user get
from A to B and back?** — with a real router and real navigation, driven in
Chromium.

Two habits came out of this:

**Write down what a passing check does not prove.** A pass here means
"structurally sound", never "this is what the phone shows". Platform fonts,
safe-area insets, native shadows, keyboard avoidance, gestures and `@expo/ui`
controls are all outside what a browser can demonstrate. An agent that treats
green as "verified" will tell a user their app is fine while it's visibly
broken.

**Statuses are load-bearing.** Three distinct outcomes look identical if you
only check pass/fail. `blocked-infra` means the harness couldn't run — never
redesign a layout because of it. `stub-gap` means a screen failed to *import*
and was therefore never checked at all; it costs no attempt. And a `fail`
carrying zero violations is infrastructure by definition, because that
combination is not a layout defect.

Collapsing those into "failed" produces the worst outcome available: the agent
apologizes to a non-technical user about a design constraint that does not
exist, and talks them out of the app they asked for.

## 6. The dev server that serves a different app

A freshly installed development build opens — showing a completely different
project's app. No error.

The port a dev build connects to is compiled **into the native binary**. A
Metro server left running on 8081 by an unrelated project will happily answer,
and the new app loads that bundle instead of its own.

The instinct is `expo start --port`. It doesn't help: the flag only routes
anywhere if `expo-dev-client` is installed, because the port arrives via a deep
link baked into the dev client binary. Without it the flag is silently accepted
and does nothing.

So the guard is to check the port before building, not to route around it:

```bash
lsof -i :8081 -sTCP:LISTEN
```

— and if something's there that isn't ours, **ask before killing it.** It may
be a project the user has open on purpose. An agent shouldn't kill a process it
didn't start.

---

## What actually generalizes

The Expo specifics expire. These didn't:

- **Verify the load-bearing thing, or ask.** Don't average two guesses that are
  both catastrophic.
- **Reasoning fails when you're predicting the wrong variable.** The SDK looked
  mature. The gate was a review queue.
- **Know what your green checks can't fail on.** A check that structurally
  cannot catch the bug is worse than no check, because it's trusted.
- **Assert scope before writing.** Blast radius comes from state you didn't
  inspect.
- **Get "same problem" right, or your retry budget is decorative.**
- **Preserve status distinctions all the way to the decision.** Collapsing them
  early is where agents start confidently lying.

Nearly every guard in this project is a tombstone for one of these. The full
set, with the reproductions, is in
[`troubleshooting.md`](../plugins/app-maker/skills/app-maker/references/troubleshooting.md).

The plugin itself is [App Maker](https://github.com/techguy0711/app-maker) —
MIT, works in Claude Code and Codex:

```
/plugin marketplace add techguy0711/app-maker
/plugin install app-maker@app-maker
```
