# Overload Gym-Ready Implementation Plan

> Execute sequentially in the isolated `codex/gym-ready` worktree. Use red-green-refactor for every behavior change and commit after each verified slice.

**Goal:** Ship a fully localized, Hevy-like Train experience with complete exercise discovery, two private historical programs, and routine-aware weight recommendations.

**Architecture:** Keep the existing local-first Dexie/Firestore model. Add narrowly scoped helpers for catalog localization/search and progression history selection. Extend routine prescriptions backward-compatibly for routine notes and per-set targets. Rebuild Train as an accessible single-open accordion and move starter packs into an Explore sheet. Populate private account data through an ignored, idempotent migration payload; no personal content enters `src`, `public`, or `dist`.

---

## Task 1: Dynamic localization and weekday regression

**Files:**
- Modify: `src/screens/Home.tsx`
- Modify: `src/lib/exercises.ts`
- Modify: `src/screens/Library.tsx`
- Modify: `src/screens/ExerciseSheet.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/it.json`
- Test: `src/lib/__tests__/catalog.test.ts`
- Test: `e2e/core.spec.ts`

1. Add failing unit tests for localized equipment metadata and explicit locale-based weekday labels.
2. Add a failing Italian E2E assertion that exercise discovery/detail contains no raw values such as `machine` or `other`.
3. Implement `equipmentLabelKey`/localized metadata mapping and pass the i18n locale explicitly to weekday formatting.
4. Run focused unit/E2E tests, then the i18n parity script.

## Task 2: Complete progressive library and bilingual fuzzy search

**Files:**
- Modify: `src/lib/exercises.ts`
- Modify: `src/screens/Library.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/it.json`
- Test: `src/lib/__tests__/catalog.test.ts`
- Test: `e2e/core.spec.ts`

1. Add failing ranking tests for accents, punctuation, reversed tokens, bilingual lookup, and one-edit typos.
2. Implement a small deterministic scorer with no new dependency.
3. Add failing browser coverage proving more than 60 catalog items become visible after scrolling and that result count/status is localized.
4. Implement an `IntersectionObserver` sentinel with a button fallback, page reset, and preserved Back state.
5. Verify focused tests and narrow viewport behavior.

## Task 3: Compact media motion control

**Files:**
- Modify: `src/components/ExerciseMedia.tsx`
- Modify: `src/components/Icons.tsx`
- Test: `e2e/core.spec.ts`

1. Change the existing E2E expectation to require localized accessible play/pause names with no visible text banner.
2. Add a Pause icon and reuse the existing Play icon.
3. Replace the textual overlay with an icon-only 44px control and verify its pressed state, focus, and reduced-motion behavior.

## Task 4: Routine-specific prescriptions and recommendations

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/progression.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/notes.ts`
- Modify: `src/state/useStore.ts`
- Modify: `src/screens/RoutineEditor.tsx`
- Modify: `src/screens/Workout.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/it.json`
- Test: `src/lib/__tests__/progression.test.ts`
- Test: `src/lib/__tests__/session.test.ts`
- Test: `src/lib/__tests__/notes.test.ts`
- Test: `e2e/core.spec.ts`

1. Add failing tests for same-routine history precedence, exercise-history fallback, per-set targets, and warm-up exclusion.
2. Extend `RoutineExercise` with optional per-set targets while retaining legacy fields.
3. Pass the current routine ID to progression and compute explainable per-set suggestions.
4. Stop migrating explicit routine coach notes into global technique notes; preserve the legacy migration only for records marked legacy.
5. Show/edit coach notes separately in Routine Editor and active Workout.
6. Verify recommendation copy and prefilled weights in both locales.

## Task 5: Hevy-like program accordion and Explore programs

**Files:**
- Modify: `src/screens/Train.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/it.json`
- Modify: `src/lib/routines.ts`
- Test: `src/lib/__tests__/routines.test.ts`
- Test: `e2e/core.spec.ts`

1. Add failing accessibility/browser tests for single-open program accordions, default suggested program, standalone routine separation, and program actions.
2. Implement controlled accordion state without a new component abstraction.
3. Replace the primary Template section with an “Explore programs” action and Bottom Sheet containing ready-made program cards, descriptions, and Add actions.
4. Preserve create, rename, delete, edit, start, focus restoration, and scroll memory flows.
5. Verify desktop and narrow phone layouts.

## Task 6: Reconstruct and import private historical programs

**Files:**
- Create ignored private payload: `data/personal/historical-programs.json`
- Create ignored migration runner: `data/personal/import-historical-programs.mjs`
- Test public importer helpers where reusable: `src/lib/__tests__/importer.test.ts`

1. Parse Hevy CSV groups and map actual routine exercise order to canonical exercise IDs.
2. Transcribe all matching Leonardo notes, rep prescriptions, rest, tempo, warm-up, abdominal, stretching, duration, and deload guidance from the two verified PDFs.
3. Generate deterministic folder/routine IDs for Allenamento iniziale and Allenamento forza.
4. Link existing Hevy workouts by exact `dayLabel` without duplicating records.
5. Validate payload exercise IDs against the public catalog and validate every source routine/exercise against a reconciliation report.
6. Resolve the authenticated Salvatore account UID read-only, snapshot current records, then run the idempotent import and verify Firestore plus local sync.

## Task 7: Constitutional localization and regression audit

**Files:**
- Modify: `scripts/check-i18n.mjs`
- Modify: `e2e/core.spec.ts`
- Modify any surfaced UI files/string maps

1. Add catalog/dynamic-value coverage to the i18n check.
2. Crawl representative Italian routes and assert known raw English metadata is absent.
3. Repair every surfaced untranslated string, including accessibility-only text.
4. Run the complete i18n and browser suite.

## Task 8: Ponytail, verification, deployment, and screenshots

**Files:** final diff only; screenshot output outside the repository under `/Users/salvatoredicara/Workspace/Codex/`.

1. Apply `ponytail-review` to the complete diff; delete unnecessary helpers, state, and abstractions.
2. Run `git diff --check`, formatting, i18n, all unit tests, build, and all Playwright tests.
3. Merge the verified branch to main, push, and deploy hosting plus Firestore rules.
4. Run production smoke tests in Italian and English at phone and desktop viewports.
5. Verify the three account programs, coach notes, old workout linkage, and visible weight recommendations.
6. Capture Home, Train accordion states, Explore programs, full Library scrolling/search, Exercise media, and active Workout recommendation screenshots.

## Required final commands

```bash
pnpm exec prettier --check .
pnpm i18n
pnpm test
pnpm build
pnpm e2e
firebase deploy --project overload-sdc --only hosting,firestore:rules
```
