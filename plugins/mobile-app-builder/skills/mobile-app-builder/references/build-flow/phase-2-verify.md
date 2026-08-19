# Phase 2, part 2 — Verify, before anyone sees it

**Read this when:** screens exist and you are about to show the user — and again after every change in Phase 4.

## Before you write layout code: read the map and the ledger

```bash
node "${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/app-map.mjs"   # writes app-map.md + app-map.json
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

## Verify — don't assume. Two gates, in order.

```bash
npx tsc --noEmit                                    # gate 1
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/ui-validate.sh"     # gate 2
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
| `blocked-infra` | The suite itself couldn't run | Read `last-run.json`, then the log. **Not** a layout problem — do not redesign anything |

On `blocked-infra`, inspect `last-run.json`'s `infrastructure` object before
reading the longer log. If its `kind` is `local-port-permission`, the host's
sandbox denied Vitest's local browser port: run the exact same
`ui-validate.sh` command once through that host's normal approval or
escalation path. This is not a layout edit, costs no attempt, and must never
lead to the three-attempt design fallback. Claude Code keeps using its normal
permission flow; Codex uses its normal command-approval flow.

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
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/flow-validate.sh"  # the other half
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

## When it's `blocked`: the non-technical fallback

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
node "${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/design-constraint.mjs" add \
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

---

**Next → `phase-3-preview-expo-go.md` if Phase 0.5 said Path A, `phase-3-preview-dev-build.md` if it said Path B** — read only the one your path calls for; the other does not apply to this app.
