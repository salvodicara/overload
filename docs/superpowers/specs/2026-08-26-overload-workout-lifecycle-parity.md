# Overload Workout Lifecycle Parity

**Date:** 2026-08-26  
**Status:** Approved design, implementation specification  
**Product authority:** `PRODUCT.md`  
**Interaction baseline:** Hevy's private workout-logging lifecycle; Overload keeps its own identity, local-first architecture, progression model, and anti-social scope.

## 1. Objective

Complete the workout lifecycle so a user never discovers that a supported Overload concept becomes read-only or loses context in a neighboring screen. A routine must remain a reusable prescription; an active workout must be freely adaptable; a completed workout must remain correctable; history must be fully explorable; browser back must restore the exact originating view; timer notifications must stop being relevant when the timer does; and browser/PWA presentation must feel finished.

Success means the supported private logging workflow reaches at least Hevy parity while Overload remains clearer about data scope and better at progression guidance.

## 2. Scope and parity boundary

### In scope

- Start an active workout from a routine, an empty workout, or a completed workout.
- Add, remove, replace, and reorder exercises during an active workout.
- Add and remove warm-up and working sets; edit tracked values and rest.
- Pause and resume the workout clock.
- Consult and edit routine-scoped technique from an active workout.
- Write session-scoped exercise observations without changing technique.
- Review all material changes before deciding whether to update the originating routine.
- Edit a completed workout's identity, time, duration, notes, exercises, order, sets, and tracked values.
- Recompute volume, records, journal context, summaries, and progress after historical edits.
- Repeat a completed workout or save it as a new routine.
- Explore the complete workout archive through calendar, list, search, and filters.
- Restore navigation state exactly when returning from a detail screen.
- Close stale rest-complete notifications.
- Finish browser, favicon, manifest, PWA, desktop, motion, and edge-state polish.
- Maintain complete Italian and English localization.

### Explicit non-goals

- Social feeds, follows, likes, comments, public visibility, or challenges.
- Subscriptions or artificial free-tier limits.
- Photos, workout media, smartwatch logging, Health/Strava integrations, or calorie estimates.
- RPE, supersets, plate calculation, and automatic warm-up calculation in this batch. They are separate product capabilities, not hidden omissions inside the approved tracking model.
- Copying competitor assets, proprietary copy, or exact trade dress.

## 3. Domain rules

### 3.1 Stable exercise-occurrence identity

An exercise name is not a sufficient identity. The same exercise may occur in multiple routines, multiple times in one routine, or with different technique in different positions. Introduce a stable occurrence identifier across the lifecycle:

- every `RoutineExercise` has a stable occurrence ID;
- every `ActiveExercise` records its active instance ID and optional originating routine-occurrence ID;
- completed sets and exercise notes retain the workout exercise-instance ID;
- completed workouts retain explicit exercise order.

Legacy routines and workouts receive deterministic compatible identities during hydration or migration. Import/export remains backward compatible, and the next native backup version preserves occurrence identity.

### 3.2 Technique and session observations

- Technique belongs only to the exact `RoutineExercise` occurrence.
- During an active workout, technique is visible in the exercise disclosure.
- `Modifica tecnica della scheda` opens an editor that explicitly names the routine and explains that the change is permanent for that occurrence.
- Saving technique updates the routine immediately and updates the active view. Abandoning the workout does not undo this separate routine edit.
- A session observation belongs only to the active exercise instance and is saved with the completed workout.
- Historical workout observations remain editable from the completed-workout editor without mutating routine technique.
- Technique never moves into the global exercise catalog or journal.

### 3.3 Active-workout structural changes

Active-workout mutations are session-local until completion:

- exercises may be added, removed, replaced, and reordered;
- sets may be added or removed and reclassified as warm-up or working;
- rest may be changed for the session;
- tracked values remain actual performance, not routine prescription.

At completion, compare the active structure against the originating routine by stable occurrence identity. If exercises, order, set structure, or rest changed, show one clear decision:

- **Aggiorna scheda:** apply the structural changes to the routine;
- **Solo questo allenamento:** keep the routine unchanged.

Weight, reps, and duration values are saved as performance history. They do not silently overwrite rep-range prescriptions. Overload's next-target algorithm remains responsible for progression guidance.

### 3.4 Workout timing

An active session stores effective elapsed time, not only `Date.now() - startTs`:

- pause records a pause start;
- resume accumulates paused duration;
- refresh and offline restoration preserve the paused/running state;
- finish derives the correct duration after subtracting pauses.

A completed workout stores start and end time. Editing may change date, start time, end time, or duration; changing duration updates the end time deterministically. Invalid intervals are rejected inline.

### 3.5 Historical edits and derived facts

Editing a completed workout preserves its ID and source lineage, updates `updatedAt`, saves locally first, and syncs under the existing account-generation guard.

After an edit:

- volume is recomputed from completed working sets according to existing product rules;
- exercise order and notes remain stable;
- the full chronological PR sequence is recomputed because changing an old workout can change later record status;
- Home summaries, period charts, exercise journals, previous-set values, progression suggestions, and Progress views consume the updated facts;
- no originating routine changes unless the user explicitly edits that routine.

Imported workouts become editable without losing their imported provenance.

## 4. User experience

### 4.1 Active workout

Keep the current dense Hevy-like set table and Overload identity. Add:

- a compact workout-clock control with pause/resume;
- a routine-technique row with a visible edit affordance;
- a separate collapsible session-note editor;
- an exercise options menu for replace, reorder, and remove;
- an `Aggiungi esercizio` action at the end of the workout;
- existing set actions integrated into the same visual grammar;
- auto-growing note fields with bounded initial height and comfortable long-text editing.

All structural actions need touch-friendly controls, accessible names, undo or confirmation where destructive, and reduced-motion behavior.

### 4.2 Save and routine update

Finishing first opens the existing workout summary/save surface. It exposes editable name, date/time, and duration before final save. Routine-update choice is shown only when a material structural diff exists. The diff is summarized in plain language, not implementation terms.

### 4.3 Completed workout detail and editor

The detail header shows date, start time, duration, working sets, and volume. A conventional overflow menu contains:

- Modifica allenamento;
- Ripeti allenamento;
- Salva come scheda;
- Elimina.

Edit mode reuses the active-workout set grammar but removes timer and completion controls. It supports exercise and set changes, overall note, exercise observations, and all supported tracking modes. Save is explicit; cancel leaves the stored workout untouched.

### 4.4 Home versus complete history

There is one workout history dataset with two views:

- **Home** is the temporal overview. Week, month, and year selection drive aggregate metrics, chart, and the compact list of workouts in that period.
- **Tutto lo storico** is the operational archive. It offers an unbounded month-grouped list, calendar navigation, search, and filters for routine and exercise.

The archive is reached from Home and does not become a sixth bottom tab. Both views open the same workout detail and restore their own exact state on return.

### 4.5 Universal reversible navigation

Every browser-history entry carries a typed, serializable surface snapshot rather than only a route name. Navigation-relevant state includes:

- Home period unit, anchor, selected day, chart metric, and scroll;
- History calendar/list mode, date, query, filters, pagination, and scroll;
- Library query, muscle filter, revealed result count, and scroll;
- Progress section, selected exercise, metric, range, and scroll;
- Train expanded program and scroll;
- equivalent state for any source surface that opens a detail route.

Browser back, hardware back, swipe-back where supplied by the host, and in-app back all traverse the same history entries. Scroll restoration is keyed by history-entry identity and runs after the restored screen has rendered. Switching tabs preserves each tab's last surface snapshot.

Transient animation frames, pointer state, toasts, and destructive confirmation sheets are not restored. Unsaved editors must warn before navigation rather than silently serializing invalid drafts.

### 4.6 Rest-complete notification lifecycle

Use one stable notification tag. A rest-complete notification:

- replaces any prior rest notification;
- is explicitly non-interaction-required;
- is closed through `getNotifications({ tag })` and `close()` after a short relevance window when execution permits;
- closes immediately when the app becomes visible, the notification is activated, rest is stopped, or a new timer starts;
- degrades safely when the browser or operating system suspends background execution.

The notification is an alert, not a persistent status card.

### 4.7 Browser and PWA polish

Preserve the graphite/volt identity. Complete:

- a master Overload app mark and derived SVG/PNG favicon set;
- 16, 32, 180, 192, 512, and maskable assets with visual safe-zone checks;
- explicit favicon, Apple touch icon, application name, description, theme colors, and manifest metadata;
- route-aware document titles;
- coherent light/dark browser chrome and standalone splash colors;
- desktop max-width, hover, focus, keyboard, empty, loading, offline, and error states;
- purposeful route, accordion, calendar, and sheet motion with reduced-motion equivalents.

## 5. Architecture

### 5.1 State and persistence

- Extend the existing Zustand store rather than introduce another state library.
- Keep IndexedDB authoritative and Firestore a guarded mirror.
- Isolate pure transformations for active structural diffs, workout editing, occurrence migration, timing, and PR recomputation.
- Save complex workout edits as one local transaction before publishing the new in-memory state and remote mirror.
- Keep active-session persistence compatible with refresh and offline use.

### 5.2 Navigation state

Create one navigation-state adapter around `history.state`:

- generate an entry key;
- read and replace the current surface snapshot;
- push detail routes without discarding the origin snapshot;
- restore route, snapshot, and keyed scroll on `popstate`;
- provide small typed hooks per surface.

Remove ad-hoc screen-specific history handling after its state is migrated to the adapter. The Library's existing query/group restoration is evidence for the pattern, not a second implementation.

### 5.3 Compatibility

- Normalize legacy data at read boundaries.
- Preserve Hevy CSV imports and existing native backups.
- Export corrected workout facts after edits.
- Never commit personal workout data or account-specific fixtures.

## 6. Failure handling and edge cases

- Reject a completed workout with no completed set unless explicitly deleted.
- Confirm destructive exercise removal when completed data would be lost.
- Preserve duplicate exercises through occurrence IDs.
- Handle very long notes, very large weights/volumes, long exercise names, zero-volume bodyweight work, duration-only work, and mixed warm-up/working sets.
- Clamp dates and durations to valid values without silently changing user input.
- Editing an old workout must not reorder the archive incorrectly or leave stale chart/PR caches.
- Account changes during local or remote writes fail closed under the existing generation guard.
- Notification cleanup is best effort and never blocks workout state changes.
- Browser refresh restores the current route and serializable surface state; missing or malformed history state falls back safely.

## 7. Verification contract

### Unit and integration tests

- occurrence-ID normalization and duplicate-exercise behavior;
- active structural diff and routine application;
- technique scope versus session-note scope;
- paused-duration calculation and refresh normalization;
- historical workout editing and volume recalculation;
- chronological PR recomputation after old-workout edits;
- backup/import compatibility;
- notification show, replacement, and cleanup calls;
- navigation snapshot serialization, malformed-state fallback, and keyed scroll restoration;
- complete Italian/English key parity.

### End-to-end flows

- edit technique during an active routine and verify only that routine occurrence changes;
- add/remove/reorder/replace exercises and choose both routine-update outcomes;
- pause, refresh, resume, and finish a workout with correct duration;
- edit a three-month-old workout and verify Home, History, Progress, volume, and PR consequences;
- repeat a workout and save one as a routine;
- navigate old week/month/year → workout detail → back and verify exact state and scroll;
- verify equivalent restoration from Library, Progress, Train, and History;
- complete a hidden PWA rest timer and verify the tagged notification is cleaned when relevance ends;
- exercise all new flows in Italian and English.

### Visual verification

Run one bounded screenshot pass on representative phone and desktop viewports, fix findings in one batch, then run one confirmation pass. Required final evidence includes:

- Home week, month, and year;
- complete History list and calendar;
- active workout with technique/session notes and exercise menu;
- completed-workout detail and editor;
- routine-update decision;
- favicon/browser tab and installable PWA assets;
- light and dark mode where materially different;
- long notes, large values, empty/loading/error states.

The screenshots are the final visual authority; code inspection alone cannot close this work.

## 8. Delivery order

1. Domain identity, migrations, and pure workout transformations.
2. Reversible navigation state and regression coverage.
3. Active workout editing, technique, timer pause, and routine diff.
4. Completed workout editor, derived-data recomputation, repeat, and save-as-routine.
5. Full History exploration and Home integration.
6. Notification lifecycle cleanup.
7. Browser/PWA polish, localization gate, browser QA, and final screenshots.

Each phase must keep the app buildable and preserve existing user data. Deployment occurs only after the complete verification contract passes.
