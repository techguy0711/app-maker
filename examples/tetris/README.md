# Tetris

A classic Tetris game for iPhone and Android, built with Expo.

## See it on your phone (about 3 minutes)

1. On your phone, install the free **Expo Go** app
   (App Store on iPhone, Play Store on Android).
2. On this Mac, open this `tetris` folder in the Terminal and run:

   ```
   npm install && npx expo start
   ```

   The first time, `npm install` downloads what the app needs (~2 min).
   Then a **QR code** appears.
3. Make sure your phone and this Mac are on the **same Wi-Fi**.
   - iPhone: open the Camera and point it at the QR code, tap the banner.
   - Android: open Expo Go, tap "Scan QR code", point it at the code.
4. The game opens on your phone. Any change to the code updates it live.

> Tip: if `npm` says "command not found", this Mac needs Node.js first —
> ask and it can be installed in one step.

## How to play

- ◀ ▶  move the piece left / right
- ⟳    rotate
- ▼ Soft   nudge it down faster (small points)
- ⤓ Drop   slam it to the bottom (more points)
- Pause / Resume in the top-right
- Clear full rows to score. It speeds up every 10 lines.

## What's inside

- `App.js` — the screen, controls, and game loop
- `src/engine.js` — the pure game rules (board, pieces, rotation, line clears, scoring)
- `test-engine.cjs` — 26 tests for the rules. Run them with: `node test-engine.cjs`
