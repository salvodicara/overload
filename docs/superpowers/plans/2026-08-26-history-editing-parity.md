# History Editing Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make completed workouts fully correctable and history completely explorable without duplicating the Home overview.

**Architecture:** Use a pure workout-draft transformation and chronological derived-data recomputation. Add one explicit editor route and make Home and History two views over the same workout collection.

**Tech Stack:** React 19, TypeScript, Zustand, Dexie, Firebase mirror, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-overload-workout-lifecycle-parity.md`

## Global Constraints

- Editing preserves workout ID and source provenance.
- Saving is atomic locally and guarded remotely.
- Historical edits recompute all affected volume, PR, previous-set, journal, Home, and Progress facts.
- History remains accessible from Home rather than adding a sixth tab.

---

### Task 1: Workout draft and derived-data recomputation

**Files:**
- Create: `src/lib/workoutEditing.ts`
- Test: `src/lib/__tests__/workoutEditing.test.ts`
- Modify: `src/lib/volume.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `WorkoutDraft`, `draftFromWorkout(workout)`, `validateWorkoutDraft(draft)`, `workoutFromDraft(original, draft, now)`, `recomputeWorkoutFacts(workouts)`.

- [ ] **Step 1: Write failing tests for duration/end-time updates, exercise/set edits, imported provenance, duplicate occurrences, volume, and PR cascade after editing an old workout**
- [ ] **Step 2: Run `pnpm vitest run src/lib/__tests__/workoutEditing.test.ts`; expect FAIL**
- [ ] **Step 3: Implement validation and immutable conversion; reject end-before-start and zero-completed-set drafts**
- [ ] **Step 4: Implement chronological PR recomputation with stable newest-first output**
- [ ] **Step 5: Run workout-editing, volume, progression, notes, and training-period tests; expect PASS**
- [ ] **Step 6: Commit `feat: recompute workout facts after historical edits`**

### Task 2: Atomic completed-workout actions

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/state/useStore.ts`
- Test: `src/lib/__tests__/db.test.ts`
- Test: `src/lib/__tests__/authConcurrency.test.ts`

**Interfaces:**
- Adds store actions: `updateWorkout(draft)`, `repeatWorkout(id)`, `saveWorkoutAsRoutine(id, name, folderId?)`.
- Consumes: transformations from Task 1 and active occurrence functions from the active-workout plan.

- [ ] **Step 1: Add failing database/store tests for atomic update, stale-account rejection, repeat, and save-as-routine**
- [ ] **Step 2: Run the focused tests; expect missing actions**
- [ ] **Step 3: Implement one Dexie transaction for all workouts whose PR flags change and update the remote mirror only while ownership remains current**
- [ ] **Step 4: Implement repeat as a new persisted active session and save-as-routine with fresh routine occurrence IDs**
- [ ] **Step 5: Run database and concurrency suites; expect PASS**
- [ ] **Step 6: Commit `feat: edit repeat and convert completed workouts`**

### Task 3: Completed workout detail and editor

**Files:**
- Create: `src/screens/WorkoutEditor.tsx`
- Modify: `src/screens/WorkoutDetail.tsx`
- Modify: `src/App.tsx`
- Modify: `src/state/useStore.ts`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `src/theme/tokens.css`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Adds route `{ view: 'workoutEditor'; id: string }`.
- Consumes: completed-workout actions from Task 2.

- [ ] **Step 1: Add failing E2E test opening an old workout, editing date/start/duration/notes/exercises/sets, and asserting corrected detail metrics**
- [ ] **Step 2: Run the focused E2E test; expect missing overflow/editor**
- [ ] **Step 3: Add detail metrics and conventional overflow actions: edit, repeat, save as routine, delete**
- [ ] **Step 4: Build editor from a local draft using the active set-table grammar without timer/completion controls; explicit Save and Cancel only**
- [ ] **Step 5: Verify long notes, large values, duration-only sets, duplicate exercises, and imported workouts**
- [ ] **Step 6: Run focused E2E, unit tests, i18n, and build; expect PASS**
- [ ] **Step 7: Commit `feat: make completed workouts fully editable`**

### Task 4: Full archive exploration

**Files:**
- Modify: `src/screens/History.tsx`
- Modify: `src/screens/Home.tsx`
- Modify: `src/components/WorkoutList.tsx`
- Modify: `src/lib/trainingPeriods.ts`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `src/theme/tokens.css`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: reversible History surface state and shared workout collection.
- Produces: list/calendar mode, unbounded progressive list, query, routine filter, exercise filter.

- [ ] **Step 1: Add failing E2E test for Home selected-period list versus full History search/filter/calendar behavior**
- [ ] **Step 2: Run focused E2E; expect missing controls**
- [ ] **Step 3: Keep Home period-specific and route `Tutto lo storico` to History**
- [ ] **Step 4: Implement History list/calendar switch, localized search, routine/exercise filters, progressive loading, month groups, and compact duration/volume/set metrics**
- [ ] **Step 5: Run reversible-navigation regressions to prove exact return state from both Home and History**
- [ ] **Step 6: Run full test/build gates; expect PASS**
- [ ] **Step 7: Commit `feat: add complete explorable workout archive`**
