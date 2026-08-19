# Phase 1 — Check the environment

**Read this when:** once per machine/session, before scaffolding.

Run `"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/doctor.sh"`. Do this once per
machine/session, not once per app. It reports three verdicts — what the Expo
Go path needs, what a dev-build path would need, and how Phase 3 will actually
deliver the app to the phone. Read the first two according to what Phase 0.5
decided; read the third one always.

**If the preview-delivery verdict says EAS Update, act on it in this phase,
not in Phase 3.** It means the shell you're running commands in isn't on the
user's network — no LAN IP at all, or one inside RFC 5737's TEST-NET ranges,
which can never be a real host. Neither the QR flow nor `--tunnel` can work
from there, and the fallback that does work authenticates with an Expo access
token only the user can create (`../environment-setup.md`, USER MUST CLICK).

Ask for it now, in the same breath as anything else you need from them, and
keep building while they fetch it. This is the whole point of checking at
Phase 1: a minute of their time here, versus a hard stop at Phase 3 with every
screen already written and nothing to show them. That is not hypothetical —
it's precisely how one real session went, and the signal (`192.0.2.2`, a
documentation-only address) was sitting there in Phase 1 the entire time.

**If Phase 0.5 said Expo Go fits** (the default path): only Node.js, npm,
and git are strictly needed — call out anything else missing from Core
Tools in `../environment-setup.md` and fix it before scaffolding. Do **not**
proactively install Xcode, Android Studio, or any simulator at this point.
Those are Path A's Phase 3 doesn't need them, and most users never do —
Expo Go on their own phone covers preview, and EAS Build covers the final
app-store binary, both without any local native SDKs.

**If Phase 0.5 flagged a dev build (Path B)**, this changes: you already know
Phase 3 will need a drivable target, so it's worth resolving the Android/iOS
tooling question now instead of discovering it mid-build with screens already
written. You still don't need to install anything yet — but read the decision
tree in `phase-3-preview-dev-build.md` now, so you can tell the user the real
cost and timeline up front, in this same conversation, rather than after the
fact.

## When local Xcode/Android Studio genuinely make sense

Needing a development build (Path B) is *not* by itself a
reason to install local Xcode or Android Studio — EAS Build covers Android
dev builds and `expo:eas-simulator` covers iOS verification, both without
touching either. Only reach for a local install when:

- The user is doing serious native-module work Expo/EAS can't cover.
- They want an emulator/simulator running with no phone and no internet
  dependency on EAS's cloud simulator.
- They explicitly ask to install them.

In all of these cases, go to `../environment-setup.md` for exact commands, and
follow its AUTO / ASK FIRST / USER MUST CLICK guidance — don't silently
kick off a 10GB Xcode download or an Android Studio install without saying
so first.

---

**Next → `phase-2-scaffold.md`** — create the project.
