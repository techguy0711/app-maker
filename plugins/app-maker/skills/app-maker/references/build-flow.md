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

## Before your first script call: resolve the installed skill directory

The scripts live beside this file under the installed skill's `scripts/`
directory, not in the app project. Capture that absolute directory once as
`APP_MAKER_SKILL_DIR`; every phase uses it after changing into the
new project.

- **Claude Code:** start with `${CLAUDE_PLUGIN_ROOT}`. Depending on how the
  plugin was loaded, it may name either the skill directory itself or the
  outer plugin directory, so accept both tested shapes.
- **Codex:** use the parent directory of the `SKILL.md` path shown for this
  skill in Codex's skill catalog. Codex does not promise a
  `${CLAUDE_PLUGIN_ROOT}` equivalent.

Set and verify the task-specific variable before the first script call:

```bash
# Codex: set this first from the active skill's absolute SKILL.md path.
# APP_MAKER_SKILL_DIR="/absolute/path/to/app-maker"

if [ -z "${APP_MAKER_SKILL_DIR:-}" ] && [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  if [ -d "${CLAUDE_PLUGIN_ROOT}/scripts" ]; then
    APP_MAKER_SKILL_DIR="${CLAUDE_PLUGIN_ROOT}"
  elif [ -d "${CLAUDE_PLUGIN_ROOT}/skills/app-maker/scripts" ]; then
    APP_MAKER_SKILL_DIR="${CLAUDE_PLUGIN_ROOT}/skills/app-maker"
  fi
fi

if [ ! -x "${APP_MAKER_SKILL_DIR:-}/scripts/doctor.sh" ]; then
  echo "Could not resolve the app-maker skill directory." >&2
  return 1 2>/dev/null || exit 1
fi
```

Never infer this path from the current working directory and never hardcode a
machine-specific install path in the generated app. Use
`"${APP_MAKER_SKILL_DIR}/scripts/..."` for every bundled helper.

## The other reference files

- `plain-language.md` — how to talk to the user. Read once, at the start.
- `environment-setup.md` — exact install commands, with the AUTO / ASK FIRST /
  USER MUST CLICK tier for each.
- `troubleshooting.md` — symptom → fix. Consult when something breaks; don't
  read it front to back.

---

**Start at → `build-flow/phase-0-understand.md`**
