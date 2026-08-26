# Active Workout Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make routines, active workouts, technique, timing, and routine-update decisions form one complete Hevy-parity workflow.

**Architecture:** Introduce stable exercise-occurrence identity and pure transformations for session structure, timing, and routine diffs. Keep IndexedDB/Zustand persistence and add UI actions on top of tested store primitives.

**Tech Stack:** React 19, TypeScript, Zustand, Dexie, Firebase mirror, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-overload-workout-lifecycle-parity.md`

## Global Constraints

- Technique belongs to a routine exercise occurrence; session observations belong to a workout occurrence.
- Active structural edits remain session-local until the explicit completion decision.
- Weight/reps/duration performance never silently rewrites rep-range prescriptions.
- Existing data, Hevy CSV import, offline recovery, and account-generation guards remain valid.

---

### Task 1: Stable occurrence identity and compatibility

**Files:**
- Create: `src/lib/workoutOccurrences.ts`
- Test: `src/lib/__tests__/workoutOccurrences.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/migrate.ts`
- Modify: `src/lib/importer.ts`
- Modify: `src/lib/exporter.ts`

**Interfaces:**
- Produces: `occurrenceId(routineId, index, exerciseId)`, `normalizeRoutineOccurrences(routine)`, `normalizeWorkoutOccurrences(workout)`.
- Extends: `RoutineExercise.occurrenceId`, `ActiveExercise.instanceId`, `ActiveExercise.routineOccurrenceId`, `SetLog.exerciseInstanceId`, `Workout.exerciseOrder`, scoped exercise-note instance IDs.

- [ ] **Step 1: Write failing tests for duplicate exercises retaining separate technique, set groups, and order after normalization**
- [ ] **Step 2: Run `pnpm vitest run src/lib/__tests__/workoutOccurrences.test.ts`; expect missing functions/types**
- [ ] **Step 3: Implement deterministic legacy IDs and random IDs for newly created occurrences**

```ts
export function occurrenceId(routineId: string, index: number, exerciseId: string): string {
  return `rx:${routineId}:${index}:${exerciseId}`;
}
```

- [ ] **Step 4: Thread occurrence identity through routine creation, active-session construction, completed sets, notes, backup parsing, and export**
- [ ] **Step 5: Run importer, exporter, session, database, and occurrence tests; expect PASS**
- [ ] **Step 6: Commit `feat: identify exercise occurrences across workout lifecycle`**

### Task 2: Active session structural operations and timing

**Files:**
- Create: `src/lib/activeWorkout.ts`
- Create: `src/lib/workoutTiming.ts`
- Test: `src/lib/__tests__/activeWorkout.test.ts`
- Test: `src/lib/__tests__/workoutTiming.test.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/state/useStore.ts`

**Interfaces:**
- Produces: pure `addActiveExercise`, `removeActiveExercise`, `replaceActiveExercise`, `moveActiveExercise`, `elapsedWorkoutMs`, `pauseWorkout`, `resumeWorkout`.
- Store actions: `addWorkoutExercise`, `removeWorkoutExercise`, `replaceWorkoutExercise`, `moveWorkoutExercise`, `pauseWorkoutClock`, `resumeWorkoutClock`, `updateRoutineTechnique`.

- [ ] **Step 1: Write failing tests for add/remove/replace/reorder with duplicate exercise IDs and for pause-refresh-resume elapsed time**
- [ ] **Step 2: Run both focused tests and verify FAIL**
- [ ] **Step 3: Implement immutable transformations and timing fields `pausedAt?: number`, `pausedTotalMs?: number`**
- [ ] **Step 4: Add store actions using `persistActive()` after every successful mutation and guarded routine saving for technique**
- [ ] **Step 5: Run focused tests plus `session.test.ts` and `db.test.ts`; expect PASS**
- [ ] **Step 6: Commit `feat: support complete active workout editing`**

### Task 3: Structural routine diff

**Files:**
- Create: `src/lib/routineDiff.ts`
- Test: `src/lib/__tests__/routineDiff.test.ts`
- Modify: `src/state/useStore.ts`
- Modify: `src/screens/Summary.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`

**Interfaces:**
- Produces: `diffRoutineSession(routine, active): RoutineSessionDiff`, `applyRoutineSessionDiff(routine, diff): Routine`.
- `RoutineSessionDiff` carries ordered add/remove/replace/move operations plus set-count and rest changes keyed by occurrence ID.

- [ ] **Step 1: Write failing tests for no-op, order-only, added/removed exercise, duplicate exercise, set-count, and rest diffs**
- [ ] **Step 2: Run the focused test; expect FAIL**
- [ ] **Step 3: Implement pure diff/apply functions and replace index-based pending changes in the store**
- [ ] **Step 4: Update Summary copy to concise localized change counts and keep the two decisions `Aggiorna scheda` / `Solo questo allenamento`**
- [ ] **Step 5: Run focused tests, i18n gate, and build; expect PASS**
- [ ] **Step 6: Commit `feat: persist structural workout changes by choice`**

### Task 4: Active-workout interface

**Files:**
- Modify: `src/screens/Workout.tsx`
- Modify: `src/components/NoteEditor.tsx`
- Modify: `src/components/Icons.tsx`
- Modify: `src/screens/Library.tsx`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: store actions from Task 2 and structural diff from Task 3.
- Produces: compact clock control, technique editor, exercise options, reorder UX, and add-exercise picker.

- [ ] **Step 1: Add failing E2E flow for editing technique, pausing the clock, adding/reordering/removing an exercise, and selecting each routine-update outcome**
- [ ] **Step 2: Run the focused E2E test; expect missing controls**
- [ ] **Step 3: Implement compact controls using existing BottomSheet, Library picker, NoteEditor, and drag/keyboard reorder conventions**
- [ ] **Step 4: Ensure technique save names its routine scope and session notes remain separate auto-growing fields**
- [ ] **Step 5: Run focused E2E, `pnpm test`, `pnpm i18n`, and `pnpm build`; expect PASS**
- [ ] **Step 6: Commit `feat: complete active workout interaction parity`**
