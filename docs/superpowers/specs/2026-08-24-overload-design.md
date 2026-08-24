# Overload — Design Spec

**Date:** 2026-08-24 · **Status:** Approved by Salvatore (chat, 2026-08-24)

## Purpose

A free, no-bullshit workout tracker PWA that combines every *useful* feature of Hevy
and StrengthLog and deliberately excludes everything else (no ads, no social feed,
no community, no paywalls). Personal use first (single user: Salvatore), architected
so additional users cost nothing to onboard later.

Success criteria for v1: Salvatore can run his "Operazione Rientro" program end to
end from his Android phone — start a workout, get suggested weights, log sets with
a rest timer that **beeps through headphones**, see history and per-exercise charts,
browse an exercise library with visual demos and videos, and import/export all data
— installed as a PWA, working offline, synced to his Google account.

## Decisions (settled via brainstorming/grilling)

| Decision | Choice |
|---|---|
| Name | **Overload** (progressive overload; works in it/en) |
| Platform | PWA, installable, offline-first |
| Backend | Firebase: Auth (Google only), Firestore, Hosting — Spark (free) plan |
| Code hosting | Public GitHub repo `overload` (no personal data in repo) |
| Sync model | Local-first: IndexedDB is source of truth on device; background sync to Firestore; last-write-wins per record via `updatedAt`; per-user security rules |
| Exercise media | Open-source exercise library assets bundled/self-hosted (instant visual demo, offline) + one curated YouTube embed per exercise for technique study. Hevy's own assets are copyrighted and are NOT used — we copy the UX, never the files |
| Import/export | Hevy CSV import; native JSON full backup/restore; incremental import with merge + dedup (deterministic ids). Personal history is imported on first run from a local file, never committed to the public repo |
| Progression engine | Yes — double progression (close top of rep range on all sets → suggest +2.5 kg upper / +5 kg lower) + Operazione Rientro phase awareness (weeks 1–2 reduced starts, etc.) |
| i18n | Architectural requirement: i18next, `it.json` + `en.json` translation files, zero hardcoded strings, browser-detected + user-switchable |
| Diet (phase 2) | Quick daily log: kcal + protein (+ indicative carbs/fat), recommended targets computed from user data, example meals, weekly trend crossed with body weight. NO food database in v1 |
| Measurements (phase 2) | StrengthLog set: body weight (with automatic weekly average), waist, chest, arms, thighs, calves; chart per metric. No photos |
| Auth methods | Google only for now |
| Timer audio | **First-class requirement:** rest timer must beep audibly through headphones (Web Audio), plus vibration; Wake Lock keeps screen on during workouts; timers use absolute timestamps so they survive screen lock/refresh |

## Stack

- Vite + React + TypeScript
- Zustand (state), Dexie (IndexedDB)
- i18next (it/en)
- Custom SVG charts following the dataviz skill (no heavy chart lib)
- vite-plugin-pwa (Workbox) for offline + install
- Firebase JS SDK v10 modular (auth, firestore)
- Vitest (unit, TDD) + Playwright (e2e)
- Deploy: Firebase Hosting (`firebase deploy` locally for v1; GitHub Actions later)

## Data model

Firestore: `users/{uid}/{collection}/{id}` mirrors Dexie tables:

- `workouts` — { id, routineId?, dayLabel, date, startTs, endTs, sets: [{exerciseId, weightKg, reps, rpe?, done, isPr}], volumeKg, note? }
- `routines` — { id, name, color, days: [{ label, name, warmup?, exercises: [{exerciseId, sets, repMin, repMax, restSec, note?, startWeightKg?}] }] } — v1 seeds "Operazione Rientro"
- `measurements` — { id, date, metric, value } (phase 2)
- `nutrition` — { id, date, kcal, proteinG, carbsG?, fatG? } (phase 2)
- `settings` — { programStartDate, unit, locale, targets {kcal, proteinG…} }

All records: `updatedAt` (ms) for LWW sync; ids deterministic where imported
(e.g. hash of date+exercise+index for Hevy rows) so re-imports dedup.

Exercise library: static JSON in bundle — { id, name_it, name_en, muscles, equipment,
mediaRef, youtubeId }, searchable, filter by muscle group.

## Feature scope

**v1 (today):** Google login · routine editor + seeded program + routine import ·
workout logging (prefill, progression suggestions, rest timer with headphone beep,
wake lock, add/remove sets, PR detection) · history + per-exercise charts · exercise
library (search, muscle filter, demo media, YouTube embed) · Hevy CSV import + JSON
backup/restore + incremental merge import · i18n it/en · PWA install/offline ·
Firestore sync.

**Phase 2 (tomorrow):** measurements · nutrition quick-log + targets + example meals ·
design polish pass (impeccable, web-design-guidelines, browser QA) · GitHub Actions
deploy.

**Explicitly out:** social/community anything, ads, paywalls, food database, photos,
non-Google auth.

## Design direction

Cutting-edge, dark-first (gym use), distinctive visual identity set with
design-taste-frontend before components are written; dataviz skill for charts;
ponytail for code minimalism; impeccable + web-design-guidelines audits before
calling any milestone done.

## Error handling & testing

- Sync failures degrade silently to local-only with a visible "unsynced" indicator;
  retry on connectivity/visibility events. No data loss: IndexedDB is authoritative.
- Import is preview-then-commit: show parsed counts (new/duplicate/invalid) before writing.
- TDD (Vitest) for: progression engine, Hevy CSV parser, merge/dedup, sync LWW logic,
  volume/PR computation. Playwright for: login-mocked logging flow, timer behavior,
  import flow, i18n switch, offline load.
