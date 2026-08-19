# Phase 3, Path A — Let them see it live (Expo Go)

**Read this when:** Phase 0.5 said the app fits Expo Go. This is the common case and the default.
**If Phase 0.5 said Path B instead, stop and read `phase-3-preview-dev-build.md`** — none of this file applies to that path.

## Path A — Expo Go preview (the default)

This is the moment that matters most for a non-technical user: something
real on their own phone, fast. Two things about *how* you do this are not
obvious and both cost real debugging time in testing — read both before
running anything.

**The dev server must run in the background, and its QR code will never
appear in your tool output.** `npx expo start` is long-running, so it has to
be started as a background process — but Expo CLI's QR code and connection
URL only render through its interactive terminal UI, which is gated on a
real TTY. A background process is never a TTY, so that output is silently
suppressed. Confirmed by testing: even after a phone successfully connected
and the JS bundle loaded, the captured log contained no QR code and no
`exp://` URL anywhere — only `Waiting on http://localhost:PORT` and bundler
progress lines. Do not wait longer expecting it to appear; it won't. Build
the connection info yourself:

```bash
npx expo start --port 8081   # run in background, from inside the project dir;
                              # note the actual port it logs
                              # ("Waiting on http://localhost:XXXX") in case
                              # 8081 was already taken and it picked another
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/make-preview-qr.sh" 8081 /tmp/preview-qr.png
```

**Deliver the QR using the current host's visible output.** The script prints
an ASCII QR and writes a PNG, so generate both and then choose the primary
presentation that the user can actually see:

- **Codex desktop:** show the PNG inline with an absolute local path, for
  example `![Expo Go preview QR](/tmp/preview-qr.png)`, and include the URL.
- **Codex CLI or plain Claude Code terminal:** print the ASCII QR block the
  script outputs directly in the reply and include the URL. In plain Claude
  Code, a file attachment can be a secondary convenience only.
- **Any other rich client:** use its supported inline-image mechanism only
  when the rendered image is known to be visible; otherwise use the ASCII QR.

This distinction is tested and important. In a plain-terminal Claude Code
session, delivering the PNG through `SendUserFile` reported success with no
error while the user saw nothing because that client had no inline image
viewer. The ASCII QR has no such silent-failure mode in terminal clients.
Never rely on a delivery mechanism the current host does not display.

Getting the ASCII itself right matters: don't reach for the `qrcode` or
`qrcode-terminal` CLIs directly (`npx -y qrcode-terminal "<url>"`, `npx -y
qrcode --small "<url>"`) — both force ANSI color escape codes by default,
which come out as unreadable raw escape-code soup once relayed through
chat (confirmed — tried it, got garbage, had to fix it). The script already
handles this correctly by calling `qrcode-terminal`'s library API directly
(`.generate(text, {small:true}, cb)`) instead of its CLI, which prints
plain unicode block characters with no color codes. Just run the script
and print what it gives you — don't reimplement this by hand.

Also always give the plain `exp://<ip>:<port>` connection URL as text
alongside the QR (the script prints this too) — Expo Go has an "Enter URL
manually" option, which is a text-only fallback that works even if the QR
render is distorted by an unusual terminal font or width.

Tell them, plainly:
1. "Install the free 'Expo Go' app from the App Store (iPhone) or Play Store (Android) — just like installing any other app. If it's already installed, open the store page for it anyway and update it — Expo Go only works with one specific version of the tools, so an old install will fail to open a fresh project." (See `../troubleshooting.md` → "Project is incompatible with this version of Expo Go" — Phase 2's SDK check should have already prevented this, but mention it if it somehow still comes up.)
2. "Open your phone's camera (iPhone) or the Expo Go app's scan button
   (Android), and point it at this QR code." In a terminal, that means the
   ASCII QR block you printed directly in your reply; in Codex desktop, it
   means the inline PNG. Do not offer a bare image attachment in a client
   where attachments are not rendered.
3. "The app will open on your phone. Any time I change something, it'll update automatically — you don't need to rescan."

This requires their phone and your dev machine to be on the **same Wi-Fi
network** — if the QR scan fails, that's the first thing to check (see
`../troubleshooting.md`).

Only reach for a local simulator/emulator (`../environment-setup.md`) or the
`expo:eas-simulator` cloud simulator if:
- the user has no phone available, or
- they specifically ask to see it "on the computer."

Prefer the EAS cloud simulator over a local Xcode/Android Studio install
when a real phone isn't an option — it needs no local installs at all.

## When the dev server can't reach the phone at all

Everything above assumes the commands you're running execute on the user's
own computer, on the same network their phone can join. That's true for a
normal local Codex or Claude Code CLI session, but not for every way this
skill can be run — reported directly by a user: Claude Code's **mobile app** session
couldn't get a working tunnel, because the session's own network layer
blocked the proxy connection `expo start --tunnel` needs to set up. The
same reasoning applies to any other setup where the shell you're running
commands in isn't on the user's own network — a remote/cloud session in
general, not just the mobile app specifically.

If you know or suspect you're in one of these setups, don't spend time on
LAN IP or `--tunnel` first — both assume network adjacency to the phone that
structurally isn't there, and confirming that by trial and error before
falling back just costs the user a wait for something that was never going
to work. Signs you're in this situation: `make-preview-qr.sh`'s LAN IP
lookup comes back empty on what should be a normal machine, or `expo start
--tunnel` fails to establish with no clear network-misconfiguration cause on
the user's end.

**The fallback: EAS Update.** Instead of the phone connecting to a server
this machine hosts, publish the JS bundle to Expo's own cloud and have
Expo Go load it from there — no locally-hosted server or tunnel involved at
all.

This path is **verified end-to-end** (a SwiftUI→Expo port on SDK 54, run from
a remote cloud session, Aug 2026). Every line below is load-bearing, and the
three obvious ways to shorten it all fail:

```bash
export EXPO_TOKEN="…"   # from the user — see ../environment-setup.md. `eas login`
                        # is interactive and cannot work in a remote session;
                        # the token is the only non-interactive auth path.

eas init --non-interactive --force
eas update:configure --non-interactive
eas channel:create preview --non-interactive
EXPO_GO_PREVIEW=1 eas update --branch preview --message "preview"
```

Why each of those, in the order they bite:

- **`eas init --force` first, and don't skip it.** Starting at
  `update:configure` skips creating the EAS project record, and `eas init`
  without `--force` refuses in non-interactive mode with *"Project does not
  exist"*.
- **A branch is not a channel.** `eas update --branch preview` creates a
  *branch*; Expo Go asks for a *channel*. Without an explicit
  `eas channel:create`, the manifest endpoint 404s with *"There is no channel
  named preview"*.
- **The runtime version `update:configure` writes is one Expo Go can never
  load.** It sets `{"policy":"appVersion"}`, which stamps updates `1.0.0`.
  Expo Go only ever asks for `exposdk:NN.0.0`. The mismatch answers **HTTP 204
  No Content** — not an error. Everything on your side reports success,
  `✔ Published!` included, and the failure exists only on the user's phone:
  the QR scans, Expo Go opens, nothing happens.

That last one is what `EXPO_GO_PREVIEW=1` is for. Add an `app.config.js` that
publishes the runtime version Expo Go actually asks for when that variable is
set, while keeping `appVersion` for real store builds:

```js
// app.config.js — app.json still holds the config; this wraps it.
// Deriving the SDK number beats hardcoding it: a stale literal here
// reintroduces the silent 204 the next time the project moves SDK.
const SDK_MAJOR = require('./package.json').dependencies.expo.match(/\d+/)[0];

export default ({ config }) => ({
  ...config,
  runtimeVersion: process.env.EXPO_GO_PREVIEW
    ? `exposdk:${SDK_MAJOR}.0.0`   // what Expo Go asks for
    : { policy: 'appVersion' },    // correct for EAS Build / store releases
});
```

Both can live on one branch — EAS serves each client the newest update
matching that client's own runtime version, so a preview publish and a store
build don't collide.

**Then confirm the phone will actually get a bundle, before you say a word to
the user:**

```bash
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/verify-expo-go-update.sh" . preview
```

That asks `u.expo.dev` with exactly the headers Expo Go sends, and tells you
200 (the phone will load it), 204 (runtime mismatch) or 404 (no channel). It
is the only thing standing between "the CLI said Published!" and the user
scanning a QR code that can never work. Don't skip it because the publish
looked clean — a clean publish is exactly what this failure looks like.

Only once that passes, build the QR. `make-preview-qr.sh` accepts a full URL
as well as a bare port, so no new renderer is needed:

```bash
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/make-preview-qr.sh" "<update URL>" /tmp/preview-qr.png
```

Take the URL from `eas update`'s output where it prints one. If you have to
build it yourself, the manifest URL is
`https://u.expo.dev/<projectId>?channel-name=preview` (the same `<projectId>`
that `app.json`'s `expo.updates.url` ends with).

**QR the `exp://` form, not the `https://` form.** `make-preview-qr.sh` encodes
whatever string you hand it, verbatim — it does no scheme rewriting. A QR
carrying `https://u.expo.dev/...` opens Safari on a manifest endpoint instead of
launching Expo Go, and `verify-expo-go-update.sh` will already have returned a
clean 200 for that same URL — so you hand it over with explicit confirmation
behind a code that cannot work. Substitute the scheme yourself:

```bash
"${MOBILE_APP_BUILDER_SKILL_DIR}/scripts/make-preview-qr.sh" \
  "exp://u.expo.dev/<projectId>?channel-name=preview" /tmp/preview-qr.png
```

Verify with the `https://` URL; put the `exp://` one in the QR. The verifier
answers "is there a bundle to fetch", never "will this QR launch the app" —
different questions, and only the first one is automated.

Two things that remain true on this path:

- **It does not live-reload.** Expo Go loads whatever was last published, and
  typically only re-checks on a fresh app open/foreground. After every code
  change in Phase 4, re-run the `eas update` line *and* tell the user to close
  and reopen the app — don't let them sit waiting for a refresh that isn't
  coming.
- `eas update:configure --non-interactive` does **not** hang. An earlier
  version of this doc warned that it might; it doesn't. If something in this
  sequence does hang, it's an auth prompt — check `EXPO_TOKEN` is exported.

---

**Next → `phase-4-iterate.md`** — take their feedback and turn it into changes.
