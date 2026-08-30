# Apple Charts

Browse Apple Music's real top charts — Songs, Albums, Videos, Playlists —
across 16 countries, and play a 30-second preview of any song right in the
app.

Built end-to-end with the `app-maker` skill as a test of wiring a
real public API into a polished screen, with no developer account or sign-in
of any kind involved anywhere.

## Run it

```bash
npm install
npx expo start
```

Then scan the QR code with the Expo Go app on your phone.

## How it's put together

- `lib/appleMusic.ts` — the two free, unauthenticated data sources, kept
  completely separate from any UI:
  - Apple's public RSS charts feed
    (`rss.marketingtools.apple.com/api/v2/...`) for the ranked lists. No API
    key, no Apple Developer account — this is not the paid MusicKit API.
  - The iTunes Lookup API (`itunes.apple.com/lookup`) to enrich a tapped
    item with its 30-second preview URL, track length, and genre.
- `app/index.tsx` — the charts screen: country picker, Songs/Albums/
  Videos/Playlists switcher, ranked list, pull to refresh.
- `app/detail.tsx` — artwork, metadata, an in-app preview player built on
  `expo-audio`, and a button that opens the real item in the Apple Music
  app.

## One thing worth knowing if you extend this

The Apple Music *developer* API (MusicKit) — full catalog search, a user's
own library, playback of full tracks — needs a paid Apple Developer account
and a signed JWT developer token. This app deliberately avoids all of that
and sticks to Apple's two free, public, key-less endpoints instead, which is
why it can run for anyone with zero setup.
