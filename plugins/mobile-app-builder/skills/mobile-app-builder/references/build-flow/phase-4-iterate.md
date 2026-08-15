# Phase 4 — Iterate

**Read this when:** the app is on the user's phone and they are telling you what to change.

Take feedback in the user's own words ("make the button bigger", "I want a
list of my recipes on the home screen") and translate it into code changes
yourself. Never ask them to describe a change in technical terms. After each
change, it reloads automatically on their phone — no rebuild, no reinstall.

**Run both gates again after every change**, not just the first time:

```bash
npx tsc --noEmit && ${CLAUDE_PLUGIN_ROOT}/scripts/ui-validate.sh
```

Their mechanics, the status table, and the `blocked` fallback are all in
`phase-2-verify.md` — the same two gates, unchanged. Re-read that file rather
than working from memory if a status comes back you don't recognise.

This is where the screenshot comparison finally earns its cost. On the first
build it had no reference to compare against and only the geometry
assertions did real work; from here on it also catches the *regression*
case — the change they asked for quietly breaking a screen they didn't ask
about. That's the failure mode a non-technical user is least likely to
report and most likely to be annoyed by, because to them nothing about that
screen changed.

If a screen legitimately looks different now because they asked it to,
that's not a regression — the reference image is simply stale. Delete the
stale reference under `.claude/visual/tests/__screenshots__/` and re-run;
the next run seeds a new one. Don't fight a diff that's showing you exactly
the change you were asked to make.

If it comes back `blocked`, use the same plain-language fallback and record
the constraint — an iteration hitting a wall gets handled identically to a
first build hitting one.

**The bugs in this phase are not the bugs in Phase 2.** Once the app is on the
phone, everything left is a *runtime* problem, reported in one sentence by
someone who cannot see a stack trace and has no vocabulary for what they're
seeing. Neither gate covers that: `tsc` sees types, `ui-validate.sh` sees
geometry, and a control that does nothing at all is invisible to both.

Two things keep this phase bounded, and they are the two most valuable habits
in the skill:

- **`troubleshooting.md` → "A control doesn't respond, but the app otherwise
  works."** Start with the discriminating question — *does it do nothing, or
  the wrong thing?* — before writing a line of code. It splits the search space
  in half for the cost of one sentence.
- **Validation-loop rule 5.** When a bug shows on some screens and not others,
  enumerate what differs before editing. Get that observation before the
  *second* fix, not the third. Three round-trips on one back button is the
  documented cost of skipping it.

And run `flow-validate.sh` rather than reasoning about navigation from the
source. It's about ten minutes of work already done for you, and it turns "back
is broken" into a table.

---

**Next → `phase-5-ship.md`** — only when they want it in the app stores.
