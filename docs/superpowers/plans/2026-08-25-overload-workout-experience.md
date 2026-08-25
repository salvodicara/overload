# Overload Workout Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the contextual Home, fully editable routine workflow, fastest-possible active workout, and truthful Technique/session journal experience on top of the generalized data contracts.

**Architecture:** Keep the current five-tab state router and add one internal history route. Extract pure next-routine and workout-display helpers, then reshape existing screens without introducing a second state system. Use one active exercise section per exercise, a sticky task header, adaptive set grids by tracking type, and shared note records from the data plan.

**Tech Stack:** React 19, TypeScript, Zustand, i18next, existing CSS variables, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-overload-general-redesign.md`

## Global Constraints

- Complete `2026-08-25-overload-data-generalization.md` first.
- No new UI, form, icon, or animation dependency.
- All task controls remain usable at 320px and one-handed at 390px.
- Finish appears before the set list in DOM and remains sticky.
- Previous values are working sets only.
- Technique writes the global exercise note; This session writes only active state.
- Every visible string exists in Italian and English.
- Hevy/Strong patterns guide interaction only; do not copy trade dress or proprietary copy.

## E2E helper contract

At the start of Task 2, replace the personal starter setup in `e2e/core.spec.ts` with these helpers and reuse them in every later task:

```ts
const NEUTRAL_ROUTINE = /full body a/i;

async function installNeutralTemplate(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /^(use|usa)$/i }).first().click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
}

async function startNeutralWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /start full body a|inizia full body a/i }).click();
  await expect(page.getByText(NEUTRAL_ROUTINE).first()).toBeVisible();
}

async function openNeutralRoutineEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
  await page.getByRole('button', { name: /edit full body a|modifica full body a/i }).click();
  await expect(page.getByRole('heading', { name: /edit routine|modifica scheda/i })).toBeVisible();
}

async function completeAndFinishOneSet(page: Page): Promise<void> {
  await page.getByRole('button', { name: /set 1|serie 1/i }).first().click();
  await page.getByRole('button', { name: /finish workout|termina allenamento/i }).click();
  await page.getByRole('button', { name: /back home|torna alla home/i }).click();
}
```

Make RoutineCard's two controls expose the accessible names `Edit <routine>` and `Start <routine>` in both locales. `test.beforeEach` resets storage, reloads, and calls `installNeutralTemplate(page)`; it no longer sets a program date.

---

### Task 1: Deterministic next-routine selection

**Files:**
- Create: `src/lib/routines.ts`
- Create: `src/lib/__tests__/routines.test.ts`
- Modify: `src/screens/Train.tsx`

**Interfaces:**
- Produces: `nextRoutine(routines: Routine[], folders: Folder[], workouts: Workout[]): Routine | null`.
- Produces: `lastCompletedFor(routine, workouts): Workout | null`.
- Train and Home consume the same selector.

- [ ] **Step 1: Write failing selector tests**

```ts
it('selects the first routine for a new program', () => {
  expect(nextRoutine([a, b], [program], [])?.id).toBe('a');
});

it('advances within the most recently used program and wraps', () => {
  expect(nextRoutine([a, b], [program], [done('a', 100)])?.id).toBe('b');
  expect(nextRoutine([a, b], [program], [done('b', 200)])?.id).toBe('a');
});

it('uses least recently performed when routines are ungrouped', () => {
  expect(nextRoutine([ungroupedA, ungroupedB], [], [done('u-a', 200)])?.id).toBe('u-b');
});
```

Define the fixtures above the tests exactly as follows:

```ts
const program: Folder = { id: 'p', name: 'Program', updatedAt: 1 };
const makeRoutine = (id: string, folderId?: string): Routine => ({
  id, name: id, folderId, exercises: [], updatedAt: 1,
});
const a = makeRoutine('a', 'p');
const b = makeRoutine('b', 'p');
const ungroupedA = makeRoutine('u-a');
const ungroupedB = makeRoutine('u-b');
const done = (routineId: string, startTs: number): Workout => ({
  id: `w-${routineId}-${startTs}`, routineId, date: '2026-08-25', startTs,
  sets: [], volumeKg: 0, updatedAt: startTs, source: 'app',
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `pnpm vitest run src/lib/__tests__/routines.test.ts`

Expected: FAIL because `routines.ts` does not exist.

- [ ] **Step 3: Implement the selector and replace Train duplication**

Sort evidence by `startTs`, not array position. If the latest routine belongs to a known folder, use the stored `routines` array order restricted to that folder. For untrained data choose the first routine. For ungrouped data choose the routine with the oldest last completion, treating never as oldest.

- [ ] **Step 4: Run tests and build**

Run: `pnpm vitest run src/lib/__tests__/routines.test.ts && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routines.ts src/lib/__tests__/routines.test.ts src/screens/Train.tsx
git commit -m "feat: derive the next routine from user history"
```

### Task 2: Contextual Home and full history route

**Files:**
- Create: `src/screens/Home.tsx`
- Create: `src/components/WorkoutList.tsx`
- Modify: `src/screens/History.tsx`
- Modify: `src/state/useStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Nav.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: `nextRoutine` and unit formatting.
- Adds route: `{ view: 'history' }`, grouped under Home in bottom navigation.
- `WorkoutList` accepts `{ workouts, limit?, onOpen }` and renders the existing workout summary content.

- [ ] **Step 1: Add failing Home e2e expectations**

```ts
test('home prioritizes the next routine and keeps history secondary', async ({ page }) => {
  await page.getByRole('button', { name: /home/i }).click();
  await expect(page.getByRole('heading', { name: /next workout|prossimo allenamento/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /start|inizia/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /all history|tutto lo storico/i })).toBeVisible();
});
```

Use the E2E helper contract above; `beforeEach` has already installed the neutral template.

- [ ] **Step 2: Run the e2e test to verify RED**

Run: `pnpm e2e --grep "home prioritizes"`

Expected: FAIL because Home has no next-workout heading or history route.

- [ ] **Step 3: Implement Home and extract the list**

Home order is active resume, next routine/empty onboarding, seven-day week strip plus sessions/working sets/volume, and latest three workouts. “All history” navigates to `history`. `History.tsx` becomes a titled screen containing the unbounded `WorkoutList`. Use semantic `<header>` and `<section aria-labelledby>` structure.

- [ ] **Step 4: Run the focused e2e test, i18n check, and build**

Run: `pnpm e2e --grep "home prioritizes" && pnpm i18n && pnpm build`

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Home.tsx src/components/WorkoutList.tsx src/screens/History.tsx src/state/useStore.ts src/App.tsx src/components/Nav.tsx src/i18n/it.json src/i18n/en.json e2e/core.spec.ts
git commit -m "feat: turn home into a training dashboard"
```

### Task 3: Routine editor owns preparation, increment, tracking, and warm-ups

**Files:**
- Modify: `src/screens/RoutineEditor.tsx`
- Modify: `src/screens/Train.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: `saveTechniqueNote`, units helpers, `RoutineExercise.tracking`, and `RoutineExercise.warmupSets`.
- Produces no new persistence API; uses `saveRoutine` and `saveTechniqueNote`.

- [ ] **Step 1: Add a failing routine-editing e2e test**

```ts
test('routine preparation and exercise settings remain editable', async ({ page }) => {
  await openNeutralRoutineEditor(page);
  await page.getByLabel(/warm-up|riscaldamento/i).fill('5 min easy bike');
  await page.getByLabel(/tracking|tracciamento/i).selectOption('duration');
  await page.getByRole('button', { name: /add warm-up set|aggiungi serie di riscaldamento/i }).click();
  await page.getByLabel(/technique|tecnica/i).fill('Brace before the timer starts');
  await page.getByRole('button', { name: /back|indietro/i }).click();
  await openNeutralRoutineEditor(page);
  await expect(page.getByLabel(/warm-up|riscaldamento/i)).toHaveValue('5 min easy bike');
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm e2e --grep "routine preparation"`

Expected: FAIL because those labeled controls do not exist.

- [ ] **Step 3: Implement the routine controls**

Add persistent labels above fields. Place routine preparation after name/program. For each exercise, use a compact settings disclosure containing tracking select, working sets, rep/time range, rest, start weight when applicable, increment when weighted, and a warm-up-set list with add/remove. Replace `RoutineExercise.note` authoring with the shared Technique editor. Keep move/remove actions at 44px minimum.

Remove the program-start card and Momentum card from Train. Train renders only create, next suggestion, routines/programs, and neutral templates.

- [ ] **Step 4: Run the focused e2e test, i18n, and build**

Run: `pnpm e2e --grep "routine preparation" && pnpm i18n && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/RoutineEditor.tsx src/screens/Train.tsx src/i18n/it.json src/i18n/en.json e2e/core.spec.ts
git commit -m "feat: make every routine prescription editable"
```

### Task 4: Active workout task header and adaptive set grid

**Files:**
- Modify: `src/screens/Workout.tsx`
- Modify: `src/lib/format.ts`
- Modify: `src/theme/tokens.css`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: active set tracking/kind, unit helpers, `previousSets`, `toggleSetKind`, and sticky Finish store action.
- Produces CSS classes: `.workout-header`, `.exercise-block`, `.set-table`, `.set-row`, `.set-previous`, `.workout-actions`.

- [ ] **Step 1: Add failing active-workout e2e checks**

```ts
test('active workout keeps finish and previous values in reach', async ({ page }) => {
  await startNeutralWorkout(page);
  const finish = page.getByRole('button', { name: /finish workout|termina allenamento/i });
  await expect(finish).toBeVisible();
  await expect(page.getByText(/previous|precedente/i).first()).toBeVisible();
  await page.getByLabel(/set 1|serie 1/i).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm e2e --grep "active workout keeps"`

Expected: FAIL because Finish is after the full list and previous values are prose rather than a column.

- [ ] **Step 3: Rebuild the task surface**

Move Finish into the sticky header before the list in DOM. Keep minimize, a single-line/clamped routine title, elapsed time, and Finish. Put abandon at the bottom under a destructive disclosure.

For `weight_reps`, render `set | previous | unit | reps | done`; for `reps`, render `set | previous | reps | done`; for `duration`, render `set | previous | seconds | done`. Warm-up rows show `W`, can toggle kind, and use the same input sizes. Select numeric input text on focus. Exercise name is the only detail navigation action. Remove the duplicate video/Technique chip.

- [ ] **Step 4: Run focused e2e, i18n, unit tests, and build**

Run: `pnpm e2e --grep "active workout keeps" && pnpm i18n && pnpm test && pnpm build`

Expected: PASS and no horizontal overflow at 320px.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Workout.tsx src/lib/format.ts src/theme/tokens.css src/i18n/it.json src/i18n/en.json e2e/core.spec.ts
git commit -m "feat: rebuild the active workout task surface"
```

### Task 5: Two-scope notes in the live workout

**Files:**
- Modify: `src/screens/Workout.tsx`
- Modify: `src/components/NoteEditor.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: `saveTechniqueNote`, `updateSessionNote`, active `sessionNote`, and `exerciseJournal`.
- Technique and This session each use a persistent visible label and their own disclosure/editor.

- [ ] **Step 1: Replace the ambiguous note e2e with scope tests**

```ts
test('technique persists globally and session notes stay on the workout', async ({ page }) => {
  await startNeutralWorkout(page);
  await page.getByRole('button', { name: /^technique|^tecnica/i }).first().click();
  await page.getByLabel(/^technique|^tecnica/i).fill('Seat 4, neutral grip');
  await page.getByRole('button', { name: /^this session|^questa sessione/i }).first().click();
  await page.getByLabel(/^this session|^questa sessione/i).fill('Left shoulder felt good');
  await completeAndFinishOneSet(page);
  await expect(page.getByText('Left shoulder felt good')).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm e2e --grep "technique persists globally"`

Expected: FAIL because the current editor writes one date-keyed note.

- [ ] **Step 3: Implement labeled scope disclosures**

Technique reads `ExerciseNote.technique` and saves through `saveTechniqueNote`. This session reads/writes `active.ex[ei].sessionNote` immediately through `updateSessionNote`. Under This session, show the newest previous workout-linked journal entry as quiet context when present. `NoteEditor` receives a visible label ID or is wrapped by a labeled section; autosize and Done remain.

- [ ] **Step 4: Run focused e2e, i18n, and full unit tests**

Run: `pnpm e2e --grep "technique persists globally" && pnpm i18n && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Workout.tsx src/components/NoteEditor.tsx src/i18n/it.json src/i18n/en.json e2e/core.spec.ts
git commit -m "feat: clarify workout note scopes"
```

### Task 6: Exercise journal and workout detail

**Files:**
- Modify: `src/screens/ExerciseSheet.tsx`
- Modify: `src/screens/WorkoutDetail.tsx`
- Modify: `src/screens/Summary.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: `exerciseJournal`, `saveTechniqueNote`, tracking/unit formatters, and workout `exerciseNotes`.

- [ ] **Step 1: Add failing history/journal e2e coverage**

```ts
test('exercise journal links session observations to distinct workouts', async ({ page }) => {
  await createTwoSameDayWorkoutNotes(page, 'First session', 'Second session');
  await openExerciseDetail(page);
  await expect(page.getByText('First session')).toBeVisible();
  await expect(page.getByText('Second session')).toBeVisible();
  await page.getByText('Second session').click();
  await expect(page.getByRole('heading', { name: /workout|allenamento/i })).toBeVisible();
});
```

Define the helpers above this test:

```ts
async function finishWithSessionNote(page: Page, text: string): Promise<void> {
  await startNeutralWorkout(page);
  await page.getByRole('button', { name: /^this session|^questa sessione/i }).first().click();
  await page.getByLabel(/^this session|^questa sessione/i).fill(text);
  await completeAndFinishOneSet(page);
  await page.getByRole('button', { name: /^(train|allenati)$/i }).click();
}

async function createTwoSameDayWorkoutNotes(page: Page, first: string, second: string): Promise<void> {
  await finishWithSessionNote(page, first);
  await finishWithSessionNote(page, second);
}

async function openExerciseDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(exercises|esercizi)$/i }).click();
  await page.getByRole('searchbox').fill('squat');
  await page.getByRole('button', { name: /barbell squat|squat con bilanciere/i }).first().click();
}
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm e2e --grep "exercise journal links"`

Expected: FAIL because dated notes collide and journal entries do not link to workouts.

- [ ] **Step 3: Implement Technique, performance, and journal sections**

Exercise Detail order is header/media, exercise identity, latest working performance, Technique editor, instructions/video, then Journal. Workout-linked entries are buttons to `workoutDetail`; legacy entries are static and labeled imported/legacy only when necessary.

Workout Detail groups warm-up and working sets truthfully, formats the chosen tracking type, and places `exerciseNotes` within the matching exercise section. Summary counts working sets, keeps duration/PR/volume, and does not create another note scope.

- [ ] **Step 4: Run focused e2e, i18n, and build**

Run: `pnpm e2e --grep "exercise journal links" && pnpm i18n && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ExerciseSheet.tsx src/screens/WorkoutDetail.tsx src/screens/Summary.tsx src/i18n/it.json src/i18n/en.json e2e/core.spec.ts
git commit -m "feat: connect exercise journals to workouts"
```

### Task 7: Workout-experience review gate

**Files:**
- Review: Home, Train, Routine Editor, Workout, Exercise Detail, Summary, Workout Detail, History, shared state/helpers.
- Update if needed: `e2e/core.spec.ts`, localized copy, focused screen files.

**Interfaces:**
- Produces the complete task flow consumed by the all-screen polish plan.

- [ ] **Step 1: Run the core mobile flow**

Run: `pnpm e2e --project=chromium`

Expected: all current and new E2E tests PASS.

- [ ] **Step 2: Run static scope checks**

Run: `rg -n "nota per la prossima|note for next time|programStart|phase1|deload|Operazione Rientro" src`

Expected: no visible production copy or behavior matches.

- [ ] **Step 3: Verify same-day notes and warm-up exclusions**

Run: `pnpm vitest run src/lib/__tests__/notes.test.ts src/lib/__tests__/volume.test.ts src/lib/__tests__/session.test.ts`

Expected: PASS.

- [ ] **Step 4: Verify compile and translations**

Run: `pnpm i18n && pnpm build`

Expected: PASS.

- [ ] **Step 5: Commit review fixes if any**

```bash
git add src e2e
git commit -m "test: harden the mobile workout experience"
```

If the review requires no changes, do not create an empty commit.
