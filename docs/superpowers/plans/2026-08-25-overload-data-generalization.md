# Overload Data Generalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace personal program assumptions with a generic, backward-compatible data model for progression, units, tracking types, warm-up sets, two note scopes, complete backup, and account isolation.

**Architecture:** Keep kilograms as canonical storage and extend existing records with optional fields so legacy IndexedDB/Firestore data remains valid. Put conversions, session construction, note migration, and journal composition in pure tested helpers; Zustand coordinates persistence and sync. Keep legacy program and routine-note fields readable but stop using them as product behavior.

**Tech Stack:** TypeScript, Zustand, Dexie, Vitest, Firebase record sync.

**Spec:** `docs/superpowers/specs/2026-08-25-overload-general-redesign.md`

## Global Constraints

- No new runtime dependency.
- Existing workouts, routines, imported notes, and settings remain readable.
- IndexedDB remains authoritative; Firestore mirrors stamped records.
- Store weight canonically in kilograms; conversion happens at UI/helper boundaries.
- Warm-up sets never affect working volume, PRs, previous working values, or progression.
- Expose exactly Technique and This session as live note scopes.
- Personal comeback phase logic is ignored; `programStartDate` remains a legacy schema field.
- Use `apply_patch` for edits and keep unrelated user changes intact.

---

### Task 1: Canonical units helper

**Files:**
- Create: `src/lib/units.ts`
- Create: `src/lib/__tests__/units.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `WeightUnit = 'kg' | 'lb'`.
- Produces: `weightLabel(unit): string`, `displayWeight(kg, unit): number`, `canonicalWeight(value, unit): number`, and `formatWeight(kg, unit, locale): string`.
- Adds: `Settings.unit?: WeightUnit`.

- [ ] **Step 1: Write the failing conversion tests**

```ts
import { describe, expect, it } from 'vitest';
import { canonicalWeight, displayWeight, formatWeight, weightLabel } from '../units';

describe('weight units', () => {
  it('keeps kg canonical', () => {
    expect(displayWeight(42.5, 'kg')).toBe(42.5);
    expect(canonicalWeight(42.5, 'kg')).toBe(42.5);
  });

  it('round-trips pounds without changing storage units', () => {
    const pounds = displayWeight(100, 'lb');
    expect(pounds).toBe(220.5);
    expect(canonicalWeight(pounds, 'lb')).toBeCloseTo(100, 1);
  });

  it('formats one shared label and locale-aware value', () => {
    expect(weightLabel('lb')).toBe('lb');
    expect(formatWeight(20, 'kg', 'it')).toBe('20 kg');
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm vitest run src/lib/__tests__/units.test.ts`

Expected: FAIL because `../units` does not exist.

- [ ] **Step 3: Implement the minimal canonical conversion**

```ts
export type WeightUnit = 'kg' | 'lb';
const LB_PER_KG = 2.2046226218;

const roundInput = (value: number): number => Math.round(value * 10) / 10;

export function displayWeight(kg: number, unit: WeightUnit): number {
  return roundInput(unit === 'lb' ? kg * LB_PER_KG : kg);
}

export function canonicalWeight(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

export function weightLabel(unit: WeightUnit): string {
  return unit;
}

export function formatWeight(kg: number, unit: WeightUnit, locale: string): string {
  return `${displayWeight(kg, unit).toLocaleString(locale === 'it' ? 'it-IT' : 'en-GB')} ${unit}`;
}
```

Add `unit?: WeightUnit` to `Settings` using a type-only import.

- [ ] **Step 4: Run the focused and full unit suites**

Run: `pnpm vitest run src/lib/__tests__/units.test.ts && pnpm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/units.ts src/lib/types.ts src/lib/__tests__/units.test.ts
git commit -m "feat: add canonical weight unit conversion"
```

### Task 2: Generic tracking and warm-up semantics

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/volume.ts`
- Modify: `src/lib/progression.ts`
- Modify: `src/lib/format.ts`
- Modify: `src/lib/__tests__/volume.test.ts`
- Modify: `src/lib/__tests__/progression.test.ts`

**Interfaces:**
- Produces: `TrackingType = 'weight_reps' | 'reps' | 'duration'` and `SetKind = 'warmup' | 'working'`.
- Adds to `RoutineExercise`: `tracking?: TrackingType`, `warmupSets?: { weightKg?: number; reps?: number; durationSec?: number }[]`.
- Adds to `SetLog`: `tracking?: TrackingType`, `kind?: SetKind`, `durationSec?: number` while retaining required legacy `weightKg` and `reps` numbers.
- Changes `suggest(rx, history)` to have no phase parameter and to ignore warm-up sets.
- Produces: `previousSets(workouts, exerciseId)` returning the most recent working sets.

- [ ] **Step 1: Add failing tests for working-only calculations**

```ts
it('excludes warm-up and duration sets from weight volume', () => {
  const sets: SetLog[] = [
    { exerciseId: 'squat', weightKg: 20, reps: 10, done: true, kind: 'warmup' },
    { exerciseId: 'squat', weightKg: 60, reps: 5, done: true, kind: 'working' },
    { exerciseId: 'plank', weightKg: 0, reps: 0, durationSec: 60, tracking: 'duration', done: true },
  ];
  expect(computeVolume(sets)).toBe(300);
});

it('does not use warm-up rows for progression', () => {
  const history = [workout('w1', '2026-06-01', [
    { ...set(20, 10), kind: 'warmup' },
    { ...set(40, 8), kind: 'working' },
    { ...set(40, 8), kind: 'working' },
    { ...set(40, 8), kind: 'working' },
  ])];
  expect(suggest(rx(), history).weights).toEqual([40, 40, 40]);
});
```

Delete phase-calendar expectations and replace every `suggest(rx(), history, null)` call with `suggest(rx(), history)`.

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `pnpm vitest run src/lib/__tests__/volume.test.ts src/lib/__tests__/progression.test.ts`

Expected: FAIL because warm-up rows are included and `suggest` still accepts phase behavior.

- [ ] **Step 3: Implement working-set filters and remove phase logic**

Use these exact defaults:

```ts
export const trackingOf = (value?: TrackingType): TrackingType => value ?? 'weight_reps';
export const kindOf = (value?: SetKind): SetKind => value ?? 'working';
```

Filter `kindOf(s.kind) === 'working'` in volume, PR, latest-set, and progression helpers. `computeVolume` additionally requires `trackingOf(s.tracking) === 'weight_reps'`. Remove `Phase`, `PhaseKey`, `getPhase`, deload constants, and phase branches from `progression.ts`. Keep the existing double-progression rules and default increment.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/lib/__tests__/volume.test.ts src/lib/__tests__/progression.test.ts && pnpm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/volume.ts src/lib/progression.ts src/lib/format.ts src/lib/__tests__/volume.test.ts src/lib/__tests__/progression.test.ts
git commit -m "feat: generalize set tracking and warmups"
```

### Task 3: Pure active-session construction and completion

**Files:**
- Create: `src/lib/session.ts`
- Create: `src/lib/__tests__/session.test.ts`
- Modify: `src/state/useStore.ts`

**Interfaces:**
- Consumes: `TrackingType`, `SetKind`, `RoutineExercise`, `SetLog`, and phase-free `suggest`.
- Produces: `buildActiveExercise(rx, history)` and `completedSets(activeExercise)`.
- Extends `ActiveSet`: `durationSec: number | null`, `kind: SetKind`.
- Extends active exercise: `tracking: TrackingType`, `sessionNote?: string`.
- Adds store actions: `updateSessionNote(ei, text)`, `toggleSetKind(ei, si)`.

- [ ] **Step 1: Write failing session helper tests**

```ts
it('prepends editable warm-up rows and creates working rows', () => {
  const active = buildActiveExercise({
    exerciseId: 'squat', sets: 3, repMin: 5, repMax: 5, restSec: 120,
    warmupSets: [{ weightKg: 20, reps: 8 }, { weightKg: 40, reps: 5 }],
  }, []);
  expect(active.sets.map((s) => s.kind)).toEqual(['warmup', 'warmup', 'working', 'working', 'working']);
});

it('builds duration rows without fake repetitions', () => {
  const active = buildActiveExercise({
    exerciseId: 'plank', sets: 2, repMin: 45, repMax: 60, restSec: 60, tracking: 'duration',
  }, []);
  expect(active.tracking).toBe('duration');
  expect(active.sets[0]).toMatchObject({ durationSec: 45, reps: null, weightKg: null });
});

it('serializes only completed rows and carries tracking/kind', () => {
  expect(completedSets({ exerciseId: 'squat', tracking: 'weight_reps', hintKey: 'suggest.repeat', sets: [
    { weightKg: 20, reps: 8, durationSec: null, kind: 'warmup', done: true },
    { weightKg: 60, reps: 5, durationSec: null, kind: 'working', done: false },
  ] })).toEqual([{ exerciseId: 'squat', weightKg: 20, reps: 8, done: true, tracking: 'weight_reps', kind: 'warmup' }]);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm vitest run src/lib/__tests__/session.test.ts`

Expected: FAIL because `session.ts` does not exist.

- [ ] **Step 3: Implement helpers and wire store persistence**

`buildActiveExercise` maps explicit warm-up targets first, then the phase-free suggested working weights. For `duration`, initialize working `durationSec` from `repMin`; for `reps`, initialize `reps` from `repMin` and leave weight null. `completedSets` emits required legacy numeric zeroes for irrelevant weight/reps plus explicit tracking/duration metadata.

Use `buildActiveExercise` in `startWorkout`, `completedSets` in `finishWorkout`, persist after `updateSessionNote` and `toggleSetKind`, and compare working set count only when proposing routine changes.

- [ ] **Step 4: Run the session and full test suites**

Run: `pnpm vitest run src/lib/__tests__/session.test.ts && pnpm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/__tests__/session.test.ts src/state/useStore.ts
git commit -m "feat: persist generic active sessions"
```

### Task 4: Technique migration and session journal

**Files:**
- Create: `src/lib/notes.ts`
- Create: `src/lib/__tests__/notes.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/state/useStore.ts`

**Interfaces:**
- Adds: `ExerciseNote.technique?: string`.
- Adds: `Workout.exerciseNotes?: { exerciseId: string; text: string }[]`.
- Produces: `routineTechniqueMigrations(routines, notes): ExerciseNote[]` and `exerciseJournal(workouts, note, exerciseId): JournalEntry[]`.
- Adds store action: `saveTechniqueNote(exerciseId, text): Promise<void>`.
- Retains `addNoteEntry` only for legacy/import paths; live workout no longer calls it.

- [ ] **Step 1: Write failing migration and same-day journal tests**

```ts
const routineWith = (exerciseId: string, note: string): Routine => ({
  id: crypto.randomUUID(),
  name: 'Routine',
  exercises: [{ exerciseId, sets: 3, repMin: 8, repMax: 10, restSec: 90, note }],
  updatedAt: 1,
});

const workoutWithNote = (
  id: string,
  date: string,
  startTs: number,
  exerciseId: string,
  text: string,
): Workout => ({
  id, date, startTs, sets: [], volumeKg: 0, updatedAt: startTs, source: 'app',
  exerciseNotes: [{ exerciseId, text }],
});

it('deduplicates legacy routine notes into one technique note', () => {
  const routines = [
    routineWith('bench', 'Scapole ferme'),
    routineWith('bench', 'Scapole ferme'),
    routineWith('bench', 'Piedi stabili'),
  ];
  expect(routineTechniqueMigrations(routines, [])).toEqual([
    { id: 'bench', technique: 'Scapole ferme\n\nPiedi stabili', entries: [], updatedAt: 0 },
  ]);
});

it('keeps two notes from two workouts on the same day', () => {
  const workouts = [
    workoutWithNote('late', '2026-08-25', 200, 'bench', 'Shoulder fine'),
    workoutWithNote('early', '2026-08-25', 100, 'bench', 'Seat 4'),
  ];
  expect(exerciseJournal(workouts, undefined, 'bench').map((e) => e.text)).toEqual([
    'Shoulder fine', 'Seat 4',
  ]);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm vitest run src/lib/__tests__/notes.test.ts`

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement note helpers and persistence**

`routineTechniqueMigrations` skips exercises whose existing note already has non-empty Technique, preserves existing legacy entries, and returns only records needing a write. `exerciseJournal` sorts workout-linked notes by date then `startTs`, followed by legacy dated entries using stable IDs `workout:<workoutId>` and `legacy:<date>:<index>`.

During `reload`, compute migrations after loading routines/notes, save each migrated note locally, sync it when authenticated, and expose the merged list once. `saveTechniqueNote` trims text, preserves entries, allows empty text to clear Technique, stamps `updatedAt`, saves, updates state, and pushes the `notes` record.

When finishing a workout, collect trimmed active `sessionNote` values into `workout.exerciseNotes`.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/lib/__tests__/notes.test.ts && pnpm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notes.ts src/lib/__tests__/notes.test.ts src/lib/types.ts src/state/useStore.ts
git commit -m "feat: separate technique and session notes"
```

### Task 5: Complete versioned backup

**Files:**
- Modify: `src/lib/importer.ts`
- Modify: `src/lib/exporter.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/state/useStore.ts`
- Modify: `src/lib/__tests__/importer.test.ts`
- Modify: `src/lib/__tests__/exporter.test.ts`
- Modify: `src/lib/__tests__/db.test.ts`

**Interfaces:**
- Produces: `BackupV1`, `BackupV2`, and `Backup = BackupV1 | BackupV2`.
- `BackupV2` contains `workouts`, `routines`, `folders`, `notes`, `measurements`, `nutrition`, `customExercises`, and `settings`.
- Changes `toBackupJson(data: BackupData): string` to always emit version 2.
- Produces: `restoreBackupCollections(backup: BackupV2): Promise<void>` in `db.ts`.

- [ ] **Step 1: Write failing v1/v2 round-trip tests**

```ts
it('round-trips every local collection in a version 2 backup', () => {
  const json = toBackupJson({
    workouts: WORKOUTS, routines: ROUTINES, folders: FOLDERS, notes: NOTES,
    measurements: MEASUREMENTS, nutrition: NUTRITION,
    customExercises: CUSTOM_EXERCISES, settings: SETTINGS,
  });
  expect(parseBackup(json)).toEqual({
    version: 2, workouts: WORKOUTS, routines: ROUTINES, folders: FOLDERS,
    notes: NOTES, measurements: MEASUREMENTS, nutrition: NUTRITION,
    customExercises: CUSTOM_EXERCISES, settings: SETTINGS,
  });
});

it('still accepts a legacy version 1 backup', () => {
  expect(parseBackup(JSON.stringify({ version: 1, workouts: [], routines: [] }))).toEqual({
    version: 1, workouts: [], routines: [],
  });
});
```

Add a DB test that restores one record into every table and asserts every list function returns it.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `pnpm vitest run src/lib/__tests__/importer.test.ts src/lib/__tests__/exporter.test.ts src/lib/__tests__/db.test.ts`

Expected: FAIL because version 2 and collection restore do not exist.

- [ ] **Step 3: Implement strict versioned parsing and restore**

Validate each required version-2 field with `Array.isArray`, require an object settings record with `id === 'settings'`, and keep version-1 validation unchanged. `restoreBackupCollections` uses one Dexie transaction across every table and `bulkPut`s each included collection. Store import reloads once after restore and pushes restored records to Firestore collection-by-collection when authenticated.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/lib/__tests__/importer.test.ts src/lib/__tests__/exporter.test.ts src/lib/__tests__/db.test.ts && pnpm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/importer.ts src/lib/exporter.ts src/lib/db.ts src/state/useStore.ts src/lib/__tests__/importer.test.ts src/lib/__tests__/exporter.test.ts src/lib/__tests__/db.test.ts
git commit -m "feat: make JSON backup complete"
```

### Task 6: Full account isolation and legacy phase removal

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/state/useStore.ts`
- Modify: `src/lib/__tests__/db.test.ts`
- Modify: `src/data/templates.ts`
- Modify: `src/lib/exercises.ts`
- Delete: `src/data/seedRoutine.ts`

**Interfaces:**
- Produces: `clearAllUserData(): Promise<void>`.
- Store no longer exposes `phase()` and no longer imports `getPhase` or `todayISO` for progression.
- `TEMPLATES` contains only neutral copyable packs.

- [ ] **Step 1: Write a failing all-table clear test**

```ts
it('clears every user-owned table together', async () => {
  await db.workouts.put({
    id: 'w', date: '2026-08-25', startTs: 1, sets: [], volumeKg: 0, updatedAt: 1, source: 'app',
  });
  await db.routines.put({ id: 'r', name: 'Routine', exercises: [], updatedAt: 1 });
  await db.folders.put({ id: 'f', name: 'Program', updatedAt: 1 });
  await db.notes.put({ id: 'bench', entries: [], technique: 'Brace', updatedAt: 1 });
  await db.measurements.put({ id: 'm', date: '2026-08-25', metric: 'weight', value: 80, updatedAt: 1 });
  await db.nutrition.put({ id: '2026-08-25', date: '2026-08-25', kcal: 2000, proteinG: 120, updatedAt: 1 });
  await db.customExercises.put({ id: 'custom:x', name: 'Carry', muscleGroup: 'core', updatedAt: 1 });
  await db.settings.put({ id: 'settings', locale: 'it', updatedAt: 1 });
  await clearAllUserData();
  expect(await Promise.all([
    db.workouts.count(), db.routines.count(), db.folders.count(), db.notes.count(),
    db.measurements.count(), db.nutrition.count(), db.customExercises.count(), db.settings.count(),
  ])).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
});
```

- [ ] **Step 2: Run the DB test to verify RED**

Run: `pnpm vitest run src/lib/__tests__/db.test.ts`

Expected: FAIL because `clearAllUserData` does not exist.

- [ ] **Step 3: Implement atomic clearing and neutral defaults**

Use one Dexie read-write transaction to clear all eight tables. In `setUser`, call it before starting sync for a changed UID, clear `overload_active`, release the wake lock, and reset every collection plus active/rest/pending state in memory.

Remove the phase method and call `suggest(rx, history)`. Remove the personal seed import from `templates.ts`, delete `seedRoutine.ts`, and define a neutral Full Body A/B pack beside the existing PPL pack. Sort exercise search alphabetically without `CURATED` priority.

- [ ] **Step 4: Run all tests and the production build**

Run: `pnpm test && pnpm build`

Expected: all tests PASS and build completes without references to deleted phase/seed exports.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/state/useStore.ts src/lib/__tests__/db.test.ts src/data/templates.ts src/lib/exercises.ts
git rm src/data/seedRoutine.ts
git commit -m "fix: remove personal defaults and isolate accounts"
```

### Task 7: Data-layer review gate

**Files:**
- Review: all files changed in Tasks 1-6
- Update if needed: focused tests only

**Interfaces:**
- Produces the stable contracts consumed by the workout/UI plan.

- [ ] **Step 1: Inspect the cumulative diff**

Run: `git diff 3bc0eaa -- src/lib src/state src/data`

Expected: no deletion of legacy fields, no direct pounds stored, no personal seed reference, no phase call.

- [ ] **Step 2: Run static searches for forbidden behavior**

Run: `rg -n "getPhase|phase\(|SEED_|Operazione Rientro|reactivation|deload" src --glob '!src/i18n/*.json'`

Expected: no production matches; historical fixture text may be renamed instead of exempted.

- [ ] **Step 3: Run full verification**

Run: `pnpm i18n && pnpm test && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 4: Review persistence safety**

Confirm manually in the diff that account change clears all tables before `startSync`, active-session writes happen after every note/kind change, and version-1 parsing is retained.

- [ ] **Step 5: Commit review fixes if any**

```bash
git add src
git commit -m "test: harden generalized data contracts"
```

If the review requires no changes, do not create an empty commit.
