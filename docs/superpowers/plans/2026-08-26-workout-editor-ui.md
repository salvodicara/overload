# Workout Editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken completed-workout form and oversized active-workout notes with the compact, localized interaction grammar shared by Hevy, Strong, Fitbod, and StrengthLog.

**Architecture:** Keep the existing workout data model and save flows. Reshape only the two presentation surfaces: reuse Overload's active-workout table grammar for completed sets, move exercise deletion into the conventional `…` menu, make workout metadata responsive, and present occurrence-scoped technique plus session-scoped notes through compact progressive disclosure.

**Tech Stack:** React 19, TypeScript, i18next, CSS, Playwright, Vitest.

**Spec:** `docs/research/fitness-app-editor-patterns.md`

## Global Constraints

- Hevy is the primary interaction reference; Strong, StrengthLog, and Fitbod provide corroboration.
- No proprietary assets, copy, or exact trade dress.
- Italian and English must contain no raw translation keys.
- Verify screenshots at 320, 375, and 412 CSS px with long text and no horizontal overflow.
- Preserve 44px accessible targets even when visual rows are compact.

---

### Task 1: Lock the regressions with browser tests

**Files:**
- Modify: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: existing `installCompletedWorkoutFixture`, `startNeutralWorkout`, and app navigation helpers.
- Produces: regression coverage for localized note scopes, compact set-table grammar, contextual removal, and responsive metadata geometry.

- [ ] **Step 1: Write failing tests**

Add a test that opens an active workout in Italian, expands `Tecnica e note`, and asserts `Tecnica della scheda` plus `Nota di oggi` are visible while `NOTES.TECHNIQUE` is absent. Add a completed-editor test that opens `newest-detail`, enters Edit Workout, checks the `Serie / Precedente / kg / Rip. / ✓` header, asserts removal lives in an exercise options menu, and verifies metadata controls never intersect or overflow at widths 320, 375, and 412.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec playwright test e2e/core.spec.ts --grep "localized technique|completed workout editor"`

Expected: FAIL because `notes.technique` is missing, the editor lacks the dense table header/options menu, and native metadata controls overlap.

- [ ] **Step 3: Keep the failure evidence**

Record the exact failed assertions in the task log before changing production code.

### Task 2: Localize and compact active-workout notes

**Files:**
- Modify: `src/screens/Workout.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `src/theme/tokens.css`
- Test: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: `NoteEditor`, `updateRoutineTechnique`, `updateSessionNote`, and occurrence-scoped routine prescriptions.
- Produces: a collapsed `Tecnica e note` trigger with distinct `Tecnica della scheda` and `Nota di oggi` rows and focused auto-growing editors.

- [ ] **Step 1: Add exact locale keys**

Define matching Italian/English keys for `notes.techniqueAndNotes`, `notes.routineTechnique`, and `notes.todayNote`; remove all use of the nonexistent `notes.technique` key.

- [ ] **Step 2: Implement progressive disclosure**

Keep one compact trigger below the exercise header. When expanded, render the routine cue and today's note as two short scoped rows; mount `NoteEditor` only for the row actively being edited. Keep previous-session context secondary and collapsed with the note flow.

- [ ] **Step 3: Apply compact styling**

Remove the nested oversized coach-note card treatment. Use the existing border and typography system, one-line summaries, a rotating chevron, and auto-growing textareas only while editing.

- [ ] **Step 4: Verify GREEN for active notes**

Run: `pnpm exec playwright test e2e/core.spec.ts --grep "localized technique|same exercise keeps|session notes stay"`

Expected: PASS.

### Task 3: Rebuild the completed-workout editor with leader grammar

**Files:**
- Modify: `src/screens/WorkoutEditor.tsx`
- Modify: `src/i18n/it.json`
- Modify: `src/i18n/en.json`
- Modify: `src/theme/tokens.css`
- Test: `e2e/core.spec.ts`

**Interfaces:**
- Consumes: `WorkoutDraft`, existing weight conversion helpers, `BottomSheet`, and icon components.
- Produces: compact responsive metadata and a dense set table with contextual exercise removal.

- [ ] **Step 1: Replace persistent destructive buttons**

Render an accessible `…` button in each exercise heading. Open a bottom sheet containing the localized Remove Exercise action; keep set removal as a trailing icon action.

- [ ] **Step 2: Add the compact set table**

Render one column header per exercise and one row per set using the same semantic order as the active workout: set marker, previous value placeholder, load/seconds/reps fields as applicable, and trailing completion/removal affordance. Keep `+ serie` as a quiet full-width row.

- [ ] **Step 3: Make metadata responsive by construction**

Give every label and native control `min-width: 0` and `width: 100%`. Use a full-width workout name, then compact date/start/duration controls that become separate rows before their intrinsic width can collide. Keep the overall note auto-growing.

- [ ] **Step 4: Verify GREEN for the editor**

Run: `pnpm exec playwright test e2e/core.spec.ts --grep "completed workout editor"`

Expected: PASS at 320, 375, and 412 px.

### Task 4: Visual, localization, and release-quality verification

**Files:**
- Modify only files already listed if screenshots reveal a defect.
- Create outside the repository: `/Users/salvatoredicara/Workspace/Codex/overload-ui-verification/`

**Interfaces:**
- Consumes: the finished UI and Playwright browser.
- Produces: final Italian/English screenshot evidence and clean verification output.

- [ ] **Step 1: Run automated verification**

Run: `pnpm run i18n && pnpm test && pnpm run build`

Expected: all commands exit 0 with no raw-key or TypeScript errors.

- [ ] **Step 2: Capture bounded screenshots**

Capture active-workout notes collapsed, technique editor expanded, and completed-workout editor at 320, 375, and 412 px in Italian and English. Include long technique/session/workout notes.

- [ ] **Step 3: Run the visual acceptance batch**

Check every screenshot for overlap, clipping, inconsistent heights, raw keys, unnecessary persistent empty space, and horizontal overflow. Fix all findings in one batch, then capture one confirmation set.

- [ ] **Step 4: Run final design and code gates**

Run the Impeccable detector once on changed UI files, apply the Browser QA workflow, read the UI/UX Pro Max pro rules, and run the project verification suite again.

