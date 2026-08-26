# Overload Native Fitness Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Train, Home, and Exercise detail behave like familiar premium strength-training apps while fixing program deletion integrity.

**Architecture:** Preserve the local-first Zustand/Dexie/Firestore architecture. Add pure time-period aggregation helpers for Home, keep screen state local, and extend the existing route shape only to deep-link an exercise into Progress. Program deletion becomes one account-fenced cascade over the existing folder/routine stores.

**Tech Stack:** React 19, TypeScript, Zustand, Dexie, Firebase, i18next, Vitest, Playwright, existing CSS token system.

**Spec:** `docs/superpowers/specs/2026-08-26-overload-native-fitness-patterns.md`

## Global Constraints

- Follow established Hevy/comparable fitness-app interaction grammar; do not add novel controls when a standard accordion, overflow menu, segmented control, swipe, calendar, or disclosure pattern exists.
- No new runtime dependency.
- Every user-facing and assistive string must exist in both `it.json` and `en.json`.
- Technique remains on `RoutineExercise.note`; never reintroduce global exercise technique state.
- Completed workout history survives program/routine deletion.
- Preserve account-owner fencing for every local and remote mutation.
- Browser screenshots, not CSS inspection alone, approve every visual state.

---

### Task 1: Program deletion integrity

**Files:**

- Modify: `src/state/useStore.ts`
- Modify: `src/screens/Train.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Test: `src/lib/__tests__/callerConcurrency.test.ts`
- Test: `e2e/core.spec.ts`

**Interfaces:**

- Consumes: existing `dbDeleteRoutine`, `dbDeleteFolder`, `deleteRecord`, and owner receipts.
- Produces: `Store.deleteFolder(id)` that deletes the folder and all routines whose `folderId === id`, while retaining workouts.

- [ ] Write a failing store test that seeds a folder, two contained routines, one standalone routine, and historical workouts; expect the folder and contained routines to disappear while standalone routines and workouts remain.
- [ ] Run `pnpm vitest run src/lib/__tests__/callerConcurrency.test.ts` and confirm the old ungrouping behavior fails the assertion.
- [ ] Replace the move-to-standalone loop with an owner-fenced local cascade, remove matching routines from Zustand only after the durable write, and delete matching remote routine records before deleting the remote folder record.
- [ ] Add localized confirmation copy with program name and pluralized routine count.
- [ ] Add browser coverage for add template → delete program → no orphan routines → reinstall once.
- [ ] Run focused tests and commit the verified slice.

### Task 2: Train accordion, overflow actions, and Create sheet

**Files:**

- Modify: `src/screens/Train.tsx`
- Modify: `src/components/Icons.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Test: `e2e/core.spec.ts`

**Interfaces:**

- Consumes: existing controlled `openProgramId` and `BottomSheet`.
- Produces: one full-row accordion trigger, `IconMore`, and two contextual Create rows.

- [ ] Change browser assertions to require one chevron plus a three-dot actions button per program header.
- [ ] Run the focused Playwright scenario and confirm it fails on the second arrow.
- [ ] Add a minimal three-dot icon and make the program name/count/chevron one accordion button; keep the overflow button outside it.
- [ ] Replace the Create sheet's block buttons and detached footer with two standard option rows containing localized title and subtitle.
- [ ] Verify focus return, 44 px targets, single-open behavior, Italian/English copy, and narrow-phone layout.
- [ ] Run focused browser tests and commit the slice.

### Task 3: Period aggregation model

**Files:**

- Create: `src/lib/trainingPeriods.ts`
- Test: `src/lib/__tests__/trainingPeriods.test.ts`

**Interfaces:**

- Produces: `PeriodUnit = 'week' | 'month' | 'year'`, `periodBounds(anchor, unit)`, `shiftPeriod(anchor, unit, amount)`, `periodBuckets(anchor, unit, workouts)`, and `periodSummary(anchor, unit, workouts)`.
- `periodSummary` returns `{ workouts, workingSets, volume, durationMin, previous }`; completed workouts with zero working sets do not count.

- [ ] Write failing tests for Italian week boundaries, leap/month/year boundaries, future-period clamping input, working-set filtering, volume, duration, previous-period comparison, and daily/weekly/monthly bucket labels.
- [ ] Run `pnpm vitest run src/lib/__tests__/trainingPeriods.test.ts` and confirm missing-module failure.
- [ ] Implement date-normalized pure helpers using local noon ISO dates and existing `kindOf`/`computeVolume` functions.
- [ ] Run the focused test until green and commit the slice.

### Task 4: Home segmented periods, swipe, chart, and calendar

**Files:**

- Modify: `src/screens/Home.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Test: `src/lib/__tests__/homeWeek.test.ts`
- Test: `e2e/core.spec.ts`

**Interfaces:**

- Consumes: period helpers from Task 3 and existing `LineChart`.
- Produces: period selector, swipe navigation, accessible button fallback, selected metric chart, tappable month calendar.

- [ ] Add failing tests for period labels and browser checks for Week/Month/Year selection, swipe navigation, future blocking, and month trained-day opening.
- [ ] Run focused Vitest/Playwright checks and confirm the current week-only UI fails.
- [ ] Replace `weekAnchor` with `periodAnchor` plus `periodUnit`; keep arrow buttons visually secondary and bind pointer/touch horizontal threshold handling to the overview card.
- [ ] Render workouts, working sets, volume, and duration from `periodSummary`; add a four-option metric selector that controls one compact `LineChart`.
- [ ] Retain weekly trained days, render a seven-column month calendar, and use aggregate-only year points.
- [ ] Verify reduced motion, keyboard navigation, Italian weekday/month labels, empty data, and 320–430 px widths.
- [ ] Run focused tests and commit the slice.

### Task 5: Progress exercise deep-link

**Files:**

- Modify: `src/state/useStore.ts`
- Modify: `src/screens/Progress.tsx`
- Modify: `src/screens/ExerciseSheet.tsx`
- Test: `src/lib/__tests__/appShell.test.tsx`
- Test: `e2e/core.spec.ts`

**Interfaces:**

- Changes route to `{ view: 'progress'; exerciseId?: string }`.
- Progress initializes and updates its selected exercise from `route.exerciseId` when supplied.

- [ ] Add a failing route/render test proving an Exercise detail action opens Progress with that exercise selected.
- [ ] Run the focused test and confirm Progress currently chooses its own default.
- [ ] Extend the route type and Progress initialization without adding global selection state.
- [ ] Add a localized `Open in Progress` action to Exercise detail.
- [ ] Verify direct navigation, bottom-tab navigation without a preselection, and Back behavior.
- [ ] Run focused tests and commit the slice.

### Task 6: Compact exercise summary and collapsed journal

**Files:**

- Modify: `src/screens/ExerciseSheet.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Test: `e2e/core.spec.ts`

**Interfaces:**

- Consumes: existing workout history, set-kind filtering, journal notes, exercise localization, and Progress deep-link.
- Produces: latest-performance summary, compact records, instructions, and collapsed five-entry journal disclosure.

- [ ] Add failing browser assertions that the journal is collapsed initially, exposes an entry count, expands five entries, loads five more, and does not render global technique.
- [ ] Run the focused scenario and confirm the current expanded journal fails.
- [ ] Derive latest working-set chips and simple best-weight/best-volume records from completed sets; keep the calculation local to this screen unless another consumer exists.
- [ ] Move instructions before the journal, implement native disclosure semantics, and progressively reveal five entries per action.
- [ ] Verify empty history, bodyweight/non-weight tracking, imported notes, both locales, and compact phone layout.
- [ ] Run focused tests and commit the slice.

### Task 7: Constitutional audit and delivery gate

**Files:**

- Modify: any surfaced UI/i18n/test file required by failures.
- Output screenshots: `/Users/salvatoredicara/Workspace/Codex/overload-final-screens/`

**Interfaces:**

- Produces: a verified build and user-facing phone screenshots for Home Week/Month/Year, Train expanded/collapsed/actions/Create, and Exercise detail collapsed/expanded.

- [ ] Run the Impeccable detector on every changed UI file and resolve severe findings.
- [ ] Run `pnpm exec prettier --check .`, `pnpm i18n`, `pnpm test`, `pnpm build`, and `pnpm e2e`; fix failures at their source.
- [ ] Run Ponytail review on the complete diff and remove speculative state, helpers, and CSS.
- [ ] Exercise production-equivalent Italian and English flows at phone width with browser QA.
- [ ] Capture the Exercise options dialog over high-contrast underlying content and verify from the screenshot that the panel surface is opaque; repair the shared sheet/dialog surface if any bleed-through is visible.
- [ ] Capture the required final screenshots outside the repository and verify them visually before delivery.
- [ ] Run `git diff --check`, inspect the final diff, and report only results, screenshots, and any genuine deployment blocker.
