# Tests

Three checkers for the skill in `plugins/mobile-app-builder/`. None of them
need network access; all of them need a scaffolded Expo app to run against.

```bash
# scaffold something to test against first (either template profile works)
npx create-expo-app@latest /tmp/probe --template default@sdk-54 && cd /tmp/probe && npm install

S="$PWD/plugins/mobile-app-builder/skills/mobile-app-builder"   # absolute, see below
bash tests/test-core.sh            "$S" /tmp/probe
bash tests/test-validation-loop.sh "$S" /tmp/probe
python3 tests/macos-audit.py       "$S"
```

## What each one covers

**`test-core.sh`** — the restricted-network behaviour and the pieces that
silently misreport when the environment is unusual. Both branches of
`doctor.sh`'s Expo reachability probe (the unreachable one via the real API,
the reachable one via `EXPO_PROBE_URL` pointed at any host that resolves), the
`CI=1` screenshot-baseline regression, browser reuse and config-written-anyway
in `setup-visual-loop.sh`, and an end-to-end run on a fresh scaffold.

**`test-validation-loop.sh`** — the stubs, the template propagation path, the
documented-behaviour claims, the SDK hard stop, and a live run against a
multi-screen app including an animated screen and a dynamic route.

**`macos-audit.py`** — static scan for constructs that work on Linux and break
on macOS: BSD `sed -i`, missing `timeout(1)`, `grep -P`, `readlink -f`,
`stat -c`, `date -d`, GNU-only flags, and bash 4 features (macOS ships bash
3.2.57). This exists because the skill's primary target is macOS and CI for it
is Linux, so nothing else would ever catch the difference.

## Two rules these were written the hard way

**Pass absolute paths.** `test-core.sh` and `test-validation-loop.sh` both
`cd` into the app directory partway through. A relative skill path stops
resolving there, and the result is several failures against a tree that is
byte-identical to a passing one — which reads as a real regression and is not
one. Both scripts now resolve their arguments up front, but the habit is worth
keeping.

**Every check carries a positive control, or it isn't trusted.**
`macos-audit.py` runs each pattern against a line that must match before it
will report on the real scripts; a pattern that stops matching is reported
`BLIND`, never `ok`. That is not defensive theatre — the first version of the
`sed -i` check was mangled by shell quoting and reported clean against a file
that contained the defect. A checker that quietly stops checking is worse than
no checker, because it launders an unverified claim into a green result.

The same failure mode showed up repeatedly while these were written: checks
that matched a *comment* about a construct rather than the construct itself
(`env -u`, `cp -u`), an assertion that expected the wrong exit code from
`check-expo-go-sdk.sh` (exit 1 when it cannot verify is the contract, not a
bug), and a hardcoded template profile that made a whole section write to a
path that didn't exist. In every one of those cases the tooling was wrong and
the skill was fine. Read a new failure with that prior in mind.

## Provenance

If you are verifying a change to the skill, make sure the thing being exercised
is the thing you changed. The validation loop *copies* templates into each
project under `.claude/visual/`, and `vitest.config.ts` resolves the stubs from
that copy — so a green run can be exercising a stale file. `ui-validate.sh`
refreshes any template the skill has since updated, but confirm it rather than
assume:

```bash
sha256sum "$S/templates/expo-stubs.tsx" /tmp/probe/.claude/visual/expo-stubs.tsx
```

Equal hashes mean the stub that ran is the one in the repo.
