# Overload

Private strength training, without the noise.

Overload is a mobile-first workout tracker for people who run their own training. It keeps the useful logging discipline of Hevy and StrengthLog while leaving out feeds, public profiles, ads, coaching, subscriptions, and paywalls. Data is written to IndexedDB first and mirrored to the signed-in user's Firestore account.

## Features

- Optional Full Body and Push / Pull / Legs starter packs, plus fully editable programs and routines
- Editable preparation, warm-up sets, working sets, rep or duration targets, rest periods, starting loads, increments, and exercise order
- History-based double progression for weighted working sets, with previous values kept visible while logging
- Three tracking modes: weight and reps, reps only, and duration
- Two clear note scopes: a persistent Technique note and a This session note saved with the completed workout
- Exercise journal, workout history, training progress, body measurements, and simple kcal/protein logging
- Exercise library with custom exercises, Italian instructions, and public-domain demonstrations
- Kilogram or pound display and input, with kilograms retained as the canonical stored weight
- Complete version-2 JSON backup for workouts, routines, programs, notes, measurements, nutrition, custom exercises, and settings
- CSV export limited to completed set rows with date, routine, exercise, weight in kilograms, and reps
- Italian and English, system light/dark themes, Google sign-in, and installable PWA support

## Offline and privacy

The active workout and personal records are local-first. After the app shell and exercise catalog have been loaded online, a warmed install remains useful without a connection and syncs again when connectivity returns. A first-ever offline visit cannot load assets or catalog data that have never been cached.

Workout data is private to the signed-in account. Overload has no community, feed, followers, public profile, challenges, engagement notifications, or paid tier. Personal workout data never belongs in this repository.

## Stack

Vite, React, TypeScript, Zustand, Dexie, i18next, Firebase Auth/Firestore/Hosting, vite-plugin-pwa, Vitest, and Playwright.

## Develop

The complete exercise data and media set is tracked in the repository.

```bash
pnpm install
pnpm dev
pnpm test
pnpm e2e
pnpm build
```

Use `pnpm run dev:e2e` for a local fake-auth session.

## Deploy

Build first, then deploy only the app surfaces owned by this repository:

```bash
pnpm build
firebase deploy --project overload-sdc --only hosting,firestore:rules
```

## License

MIT. Exercise data and images come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) under the Public Domain / Unlicense terms.
