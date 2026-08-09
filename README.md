# App Maker

A workspace for building mobile apps end-to-end with Claude Code, for
someone who doesn't write code themselves. The actual capability lives in
the `mobile-app-builder` skill; this repo is just its home plus the apps
built with it so far.

## The skill

[`.claude/skills/mobile-app-builder/`](.claude/skills/mobile-app-builder/SKILL.md)
takes an app idea from a plain-language conversation to something running
on the user's own phone to (optionally) a real App Store / Play Store
release — without the user ever needing to see a terminal, install Xcode or
Android Studio, or make a technical decision they didn't ask to make.

It's invoked automatically whenever someone who isn't a programmer asks for
an app, or with `/mobile-app-builder`.

**How it works, briefly** (full detail in the skill's own
[`build-flow.md`](.claude/skills/mobile-app-builder/references/build-flow.md)):

1. A short plain-language conversation to understand what the app should do.
2. `scripts/doctor.sh` checks the machine's dev environment once per session.
3. `scripts/check-expo-go-sdk.sh` checks which Expo SDK version the App
   Store/Play Store build of Expo Go currently supports, and scaffolds a new
   Expo project pinned exactly to that version — not the newest SDK, which
   is often ahead of what's actually installable on a phone.
4. `scripts/strip-demo-scaffold.sh` removes the template's demo tabs/explore
   content and drops to a clean single-screen stack.
5. The real screens get built using Expo's own skills (routing, native UI,
   data fetching).
6. `npx tsc --noEmit` must pass before anything is shown to the user.
7. `scripts/make-preview-qr.sh` builds a scannable connection code so the
   user can preview the app live on their own phone via the free Expo Go
   app — no simulator, no local Xcode/Android Studio required.
8. Iterate on feedback in plain language.
9. Shipping to the actual App Store/Play Store goes through EAS Build (cloud
   compilation, still no local native SDKs) — the one part that genuinely
   requires the user themselves is signing up for a paid Apple/Google
   developer account, which no amount of automation can do on their behalf.

Every one of those steps encodes something that broke in real testing and
got fixed — see the skill's `troubleshooting.md` for the specifics (SDK
version mismatches, QR codes that silently never reach the user in a
terminal session, a git-repo detection bug that nearly staged an unrelated
directory tree, template shape differences between SDK versions).

## Apps in this workspace

Each app scaffolded by the skill gets its own **isolated git repo** (not
tracked by this outer repo — see `.gitignore`), so its history stays scoped
to just that project. Apps built so far, in order, each one testing a
different part of the skill:

- **`counter/`** — plus/minus buttons incrementing a number. First clean
  run after fixing the SDK-version and git-nesting issues.
- **`camera/`** — live camera preview, flip front/back, capture and retake
  a photo. Tests a real native module (`expo-camera`) and a runtime
  permission flow, not just UI state.

(A `tic-tac-toe/` app was also built and later deleted during testing.)

## Distributable plugin package

[`mobile-app-builder-plugin/`](mobile-app-builder-plugin/) is a separate,
isolated repo (also excluded from this outer repo — see `.gitignore`)
packaging the skill as a real installable Claude Code plugin, so other
people (or you, on another machine) can add it via `/plugin marketplace add`
+ `/plugin install` instead of copying files by hand. See its own README for
installation and local-testing instructions.

It's a **separate copy** of the skill, adapted to use `${CLAUDE_PLUGIN_ROOT}`
(the plugin-portable path convention) instead of this workspace's
project-local skill paths. The two aren't automatically kept in sync — see
the plugin repo's README for what that means when iterating further.

## Working in this repo

This repo's own git history is intentionally separate from any ambient
repo that might exist above `~/Documents` — see the "near-miss" story in
the skill's `troubleshooting.md` for why that separation matters. Never run
git commands here expecting them to reach outside this folder, and vice
versa.
