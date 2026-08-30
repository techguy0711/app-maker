# Phase 0.5 — Does this fit Expo Go?

**Read this when:** immediately after the Phase 0 conversation, before Phase 1 and before scaffolding.

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

**Outcome of this gate — write the answer down, you need it twice more:**
- **Fits Expo Go — Path A** (most apps): carry on through the phases in order.
  Phase 1 stays minimal, and Phase 3 is the QR-code flow
  (`phase-3-preview-expo-go.md`). Nothing else changes for you.
- **Needs a dev build — Path B**: say so now, in plain language, before
  scaffolding anything — e.g. "This app needs a couple of features your phone's
  basic preview app can't handle on its own. I can still get it running on your
  phone, it just needs one extra setup step first, and I want to walk you
  through what that involves before we start." Then read
  `phase-3-preview-dev-build.md` **before** Phase 1 — it changes what Phase 1
  needs to check for, so reading it in phase order is too late.

**One thing this gate does *not* settle: Expo Go's own bugs.** Everything above
treats Expo Go as a fixed set of native modules — either your app's features
are inside it or they aren't. But it's also a fixed *binary*, and its own UI
chrome can be broken on a given OS version regardless of what your app does.
Path A is the low-risk path and stays the default; this is its one structural
risk, and it lands on the user's device where you can't see it.

The running list is in `../troubleshooting.md` under **Known Expo Go
divergences** — currently the iOS 26 native-nav-bar hit-testing failure, which
is live right now and whose obvious workaround (a custom `headerLeft`) does not
work. Read it before concluding a dead control is your own code, and add to it
when you find a new one.

---

**Next → `phase-1-environment.md`** — write down this phase's answer — Path A or Path B. It picks which Phase 3 file you read later, and it is expensive to get wrong.
