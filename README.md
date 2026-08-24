# music-collector-mobile

Expo app for **Music Collector** — the phone surface: library grid, item detail, wishlist,
the scan-first add flow and profile.

The app is **local-first**. The collection lives in a local SQLite database (`expo-sqlite`)
and is fully usable with no account; signing in only starts syncing it to
[`music-collector-backend`](https://github.com/Janne6565/music-collector-backend). See that
repo's `docs/PLAN.md` for the architecture.

## Stack

Expo SDK 57 · React Native 0.86 · expo-router · TanStack Query · Redux Toolkit ·
lucide-react-native · typed react-i18next · expo-camera (barcode scanning) · expo-sqlite

## Development

```bash
bun install
bun start          # then press i / a, or scan the QR code
bun run typecheck
```

## Gotchas

- **Do not install `@react-navigation/bottom-tabs`.** Expo SDK 57 vendors bottom-tabs
  inside `expo-router`; a second copy is a different React context object, and layout
  values read through it silently come back as zero.
- Design tokens live in `src/theme/colors.ts` and mirror `src/styles.css` in
  `music-collector-frontend`. Change them in both, or the two apps stop reading as one
  product.
- Test files must not live inside `app/` — the typed-routes generator scans that directory
  and misreads a co-located test as a route. Put screen tests in `src/`.
