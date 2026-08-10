# Example apps

Apps actually produced by the `mobile-app-builder` skill, checked in so you
can read the source without building anything.

| App | What it shows |
| --- | --- |
| [`counter/`](counter/) | Smallest end-to-end case — plus/minus buttons incrementing a number. |
| [`camera/`](camera/) | A real native module (`expo-camera`) plus a runtime permission flow: live preview, flip front/back, capture and retake. |
| [`tetris/`](tetris/) | A full game — rotation, line clears, scoring, increasing speed. Rules live in a pure [`src/engine.js`](tetris/src/engine.js) with 26 tests, separate from the screen. |

## Running one

Each folder is a complete, standalone Expo project. Dependencies aren't
checked in, so:

```bash
cd counter          # or camera, or tetris
npm install
npx expo start
```

Then scan the QR code with [Expo Go](https://expo.dev/go) on your phone
(phone and computer on the same Wi-Fi). Each app has its own README with
more detail.

`counter/` and `camera/` are on Expo SDK 54; `tetris/` is on SDK 57. That's
by design — the skill pins each new project to whatever SDK the store build
of Expo Go supported at the time it was built, not to the newest SDK.

## Note on git

Apps you build for yourself with this skill get their own isolated git repo,
so their history stays scoped to that project. These three were flattened
into this repo's history on purpose, so they can ship as readable examples.
