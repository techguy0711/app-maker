# Phase 0 — Understand what they want

**Read this when:** you are starting a new app, or the user has an existing app they want ported.

Ask in plain language, one or two questions at a time, not a form:
- "What should the app do?" (get a one-sentence purpose)
- "Who's it for — just you, or other people too?"
- "Any apps you like the feel of, that I could use as a reference?"

Don't ask about tech stack, navigation patterns, state management, etc. — that's
your job to decide, not theirs. See `plain-language.md` for phrasing rules.

## Porting an existing app

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

---

**Next → `phase-0.5-expo-go-fit.md`** — decide Path A vs Path B before anything gets built.
