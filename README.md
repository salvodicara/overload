# Overload

Progressive overload. Nothing else.

A free, no-bullshit workout tracker PWA: the useful parts of Hevy and StrengthLog, none of the ads, feeds, or paywalls. Local-first (IndexedDB), synced per-user to Firestore, installable and fully offline in the gym.

## Features

- Routines with a seeded 8-week comeback program, full editor, JSON import
- Workout logging with automatic weight suggestions (double progression + program phases), PR detection, and a rest timer whose beep ducks over your music through headphones
- History, per-exercise top-set charts, weekly volume
- 873-exercise library (free-exercise-db, public domain) with visual demos and curated YouTube technique videos
- Import from Hevy CSV or native JSON backup, incremental with dedup; full export
- Italian + English, dark-first, PWA install, Google sign-in

## Stack

Vite · React · TypeScript (strict) · Zustand · Dexie · i18next · Firebase (Auth + Firestore + Hosting) · vite-plugin-pwa · Vitest · Playwright

## Develop

```bash
pnpm install
node scripts/fetch-media.mjs   # exercise images (public domain, gitignored)
pnpm dev                       # or pnpm run dev:e2e for a fake-auth session
pnpm test && pnpm e2e && pnpm build
```

## Deploy

```bash
node scripts/fetch-media.mjs --all
pnpm build
firebase deploy
```

Personal workout data never lives in this repo: import it at first run (`scripts/prepare-personal-history.mjs <hevy.csv>` → `data/personal/`, gitignored).

## License

MIT. Exercise data and images from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Public Domain / Unlicense).
