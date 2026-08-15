# Build flow — idea to app store

This is an **index**, not the process. Each phase lives in its own file under
`build-flow/`.

**Read one phase file at a time — the one you are in.** Don't read them all up
front. The whole set is about 12,000 tokens; a single phase is 400–3,000, and
loading phases you aren't in is where this skill's context budget goes.

Follow the phases in order. Don't skip the environment check, and don't
front-load installs the current phase doesn't need yet.

## The phases, in order

| Phase | Read this file | What it's for |
|---|---|---|
| 0 | `build-flow/phase-0-understand.md` | The opening conversation. Also: porting an existing app. |
| 0.5 | `build-flow/phase-0.5-expo-go-fit.md` | **Path A or Path B?** Decide before scaffolding. |
| 1 | `build-flow/phase-1-environment.md` | `doctor.sh`, what to install, how the app will reach the phone. |
| 2a | `build-flow/phase-2-scaffold.md` | Create the project, strip the demo, build the screens. |
| 2b | `build-flow/phase-2-verify.md` | The two gates and the validation loop. Re-read in Phase 4. |
| 3 | **Path A:** `build-flow/phase-3-preview-expo-go.md`<br>**Path B:** `build-flow/phase-3-preview-dev-build.md` | Get it onto their phone. Read only your path's file. |
| 4 | `build-flow/phase-4-iterate.md` | Their feedback → code. Runtime bugs live here. |
| 5 | `build-flow/phase-5-ship.md` | App Store / Play Store. |

Each file ends by naming the next one, so following them in order needs no
decisions beyond Phase 0.5's.

## The one branch that matters

**Phase 0.5 decides Path A or Path B, and everything downstream follows from
it.** Path A (fits Expo Go) is the default and covers most apps. Path B (needs
a development build) changes what Phase 1 checks for and replaces Phase 3
entirely. Getting it wrong is expensive — you find out after every screen is
already written.

## Before your first script call: `${CLAUDE_PLUGIN_ROOT}`

The scripts referenced throughout live in this plugin's own `scripts/`
directory. Reference them via `${CLAUDE_PLUGIN_ROOT}` — an environment variable
Claude Code sets to this plugin's install location, which doesn't move when you
`cd` into the new project. Never hardcode an absolute path to the plugin, and
never use a path relative to your current working directory.

**Verify it's actually set before relying on it.** It is not guaranteed to be
present in every shell — confirmed in a real session where it was unset, and
every subsequent `${CLAUDE_PLUGIN_ROOT}/...` command failed with "No such file
or directory" until this was caught. One cheap check, before the first script
call of the session:

```bash
if [ -z "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  echo "CLAUDE_PLUGIN_ROOT is unset — using the fallback below."
fi
```

If it's unset, fall back to the path Claude Code shows as "Base directory for
this skill" in the message where this skill was invoked — that's the same
location `${CLAUDE_PLUGIN_ROOT}` would have pointed to. Capture that string once,
at the start of the session, rather than re-deriving it every time a script
needs to run.

## The other reference files

- `plain-language.md` — how to talk to the user. Read once, at the start.
- `environment-setup.md` — exact install commands, with the AUTO / ASK FIRST /
  USER MUST CLICK tier for each.
- `troubleshooting.md` — symptom → fix. Consult when something breaks; don't
  read it front to back.

---

**Start at → `build-flow/phase-0-understand.md`**
