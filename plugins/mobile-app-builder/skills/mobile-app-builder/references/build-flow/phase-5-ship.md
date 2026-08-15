# Phase 5 — Ship it

**Read this when:** the user wants the app on the App Store or Play Store.

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

---

**This is the last phase.** Hand the mechanics to the `expo:eas-app-stores` skill.
