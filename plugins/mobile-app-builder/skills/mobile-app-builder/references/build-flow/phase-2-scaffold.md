# Phase 2, part 1 — Scaffold the project and build the screens

**Read this when:** Phase 0.5 and Phase 1 are done and you are about to create the project.

**This step branches on Phase 0.5's answer — don't run it the same way for
both paths.**

If this is a port (see "Porting an existing app" in
`phase-0-understand.md`), everything below
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
`../troubleshooting.md` for the full story if you're fixing an
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

Scripts are referenced via `${MOBILE_APP_BUILDER_SKILL_DIR}`. If you have not
resolved and verified that variable in this session, do it now — see "Before
your first script call" in `../build-flow.md`. Do not assume either host's
current working directory points at the installed skill.

```bash
# Path A only:
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/check-expo-go-sdk.sh"
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

**Read the generated project's instructions before changing a single source
file.** Fresh Expo templates can include `AGENTS.md` with SDK-specific rules,
and a project may also include `CLAUDE.md` (sometimes pointing at that same
file). Immediately after scaffolding, read both files if they exist and follow
the instructions that apply to this project before stripping the demo or
writing screens. Keep both files in place: `AGENTS.md` serves agent hosts such
as Codex, while `CLAUDE.md` preserves Claude Code's entry point. If a linked
online reference is unreachable in the current sandbox, use the local
instructions that are available and follow the restricted-egress fallback in
`../troubleshooting.md`; do not loop on the network request.

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
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/strip-demo-scaffold.sh" --name "Display Name"
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
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/setup-visual-loop.sh"
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

When the host has the official Expo companion skills, use
`expo:expo-project-structure` for the folder layout, `expo:expo-router` for
navigation, `expo:expo-native-ui` for native-feeling controls, and
`expo:expo-data-fetching` for API or remote-data work. Before using
`expo:expo-ui` or installing `@expo/ui`, compare that companion skill's SDK
requirement with the SDK selected in Phase 0.5. The selected path and SDK win:
if `@expo/ui` requires a newer SDK (the universal layer requires SDK 56+ at
the time of writing) and Path A is pinned lower, do not install it and do not
silently switch to Path B. Use React Native primitives or Expo Go-compatible
controls instead. A companion skill never overrides the user's preview choice
or this phase's SDK selection.

If those skills are absent, continue rather than blocking: keep Expo Router's
file-based routes under `app/` or `src/app/` according to the scaffold, use
`npx expo install` for Expo-owned packages so versions match the SDK, prefer
React Native primitives and Expo-supported modules, and run `npx expo-doctor`
after dependency changes. These are the minimum conventions the companion
skills would have protected; the rest of this phase and both validation gates
remain unchanged.

---

**Next → `phase-2-verify.md`** — both gates must pass before the user sees anything.
