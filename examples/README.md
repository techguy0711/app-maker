# Example apps

Apps actually produced by the `app-maker` skill, checked in so you
can read the source without building anything.

| App | What it shows |
| --- | --- |
| [`counter/`](counter/) | Smallest end-to-end case — plus/minus buttons incrementing a number. |
| [`camera/`](camera/) | A real native module (`expo-camera`) plus a runtime permission flow: live preview, flip front/back, capture and retake. |
| [`tetris/`](tetris/) | A full game — rotation, line clears, scoring, increasing speed. Rules live in a pure [`src/engine.js`](tetris/src/engine.js) with 26 tests, separate from the screen. |
| [`blocktoss/`](blocktoss/) | A physics game (custom engine, no library) plus the visual validation loop's first real test — it caught a sub-44px tap target and a floating-point physics bug before either reached a phone. |
| [`apple-charts/`](apple-charts/) | Wiring a real, free public API (Apple's charts RSS feed + the iTunes Lookup API) into a polished browsing app, including an in-app 30-second audio preview player. |

## Running one

Each folder is a complete, standalone Expo project. Dependencies aren't
checked in, so:

```bash
cd counter          # or camera, tetris, blocktoss, apple-charts
npm install
npx expo start
```

Then scan the QR code with [Expo Go](https://expo.dev/go) on your phone
(phone and computer on the same Wi-Fi). Each app has its own README with
more detail.

`counter/`, `camera/` and `apple-charts/` are on Expo SDK 54; `tetris/` and
`blocktoss/` are on SDK 57. That's by design — the skill pins each new
project to whatever SDK the store build of Expo Go supported at the time it
was built, not to the newest SDK.

## Note on git

Apps you build for yourself with this skill get their own isolated git repo,
so their history stays scoped to that project. These five were flattened
into this repo's history on purpose, so they can ship as readable examples.
