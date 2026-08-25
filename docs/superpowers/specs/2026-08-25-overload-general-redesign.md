# Overload general product redesign

**Date:** 2026-08-25  
**Status:** Approved through the user's explicit autonomy brief on 2026-08-25  
**Supersedes:** `2026-08-24-overload-design.md` where it encoded personal defaults

## Outcome

Turn the working Overload PWA into a general, configurable strength logger with a polished mobile-first interface. Preserve its local-first reliability and direct graphite/volt identity. Remove every product assumption that belongs to one person's comeback program.

The active workout is the load-bearing surface. Home, routine editing, exercise detail, history, progress, profile, import/export, login, global navigation, rest state, dialogs, and empty/loading/error states must all feel like one product.

## Design read

Redesign of an operational mobile PWA for independent lifters, with a restrained athletic language and dense but calm data entry. It borrows interaction discipline from Hevy, Strong, StrengthLog, and FitNotes without cloning their visual trade dress.

- `DESIGN_VARIANCE: 4` - stable alignment matters more than novelty during training.
- `MOTION_INTENSITY: 2` - motion is limited to action feedback and state transitions.
- `VISUAL_DENSITY: 7` - live training is information-dense, but text never shrinks to create room.
- Redesign mode: structural overhaul with brand, routes, offline behavior, and user data preserved.
- Foundation: the existing React/CSS-variable system, with no new component or animation dependency.

## Product boundaries

In scope:

- contextual Home and separate full history;
- generic routines/programs, editable preparation, increment, tracking type, and warm-up sets;
- history-based progression with no global phase calendar;
- technique and session note migration/model/UI;
- kg/lb display and input over canonical kilogram storage;
- account-isolation privacy fix and complete versioned backup;
- all-screen visual, spacing, copy, accessibility, and performance pass.

Out of scope:

- social/community/public profiles;
- subscriptions, ads, marketplaces, public plans, or challenges;
- AI programming, readiness, medical guidance, or automatic meal advice;
- scheduling, supersets, RPE/RIR, plates, or percentage warm-up generation;
- exact competitor assets, wording, composition, or proprietary media.

## Information architecture

Keep the five bottom destinations and their muscle memory:

1. **Home:** next action, week summary, recent activity.
2. **Train:** routines and programs only.
3. **Exercises:** search, filters, custom exercise creation, exercise detail.
4. **Progress:** training, body, and optional nutrition logs.
5. **Profile:** language, units, sync, backup/import, account, attribution.

Add one internal `history` route reached from Home. Detail routes remain grouped under their existing destination. The active workout still hides bottom navigation.

## Home behavior

### Active state

If a workout is active, the first module resumes it. The existing global active-workout bar remains as recovery affordance on other tabs.

### Next routine

If no workout is active and routines exist:

1. find the most recently completed routine;
2. if it belongs to a program, suggest the next routine in that program's stored order, wrapping once;
3. otherwise suggest the least recently performed routine;
4. never block the user from opening Train and choosing another.

If no routine exists, the primary action opens Train to create or adopt a neutral template.

### Dashboard content

- one primary next-action panel;
- current-week sessions, working sets, volume, and a seven-day consistency strip;
- latest three workouts;
- “All history” opens the full chronological list.

No user-configurable widget framework is introduced.

## Generic routines and progression

- Remove the program-start prompt and profile field.
- Ignore legacy `programStartDate` in progression while retaining it in settings/backup compatibility.
- Use double progression only: begin with the user's starting load, repeat while closing the rep range, then add the exercise's configured increment.
- Add editable routine preparation text using the existing `Routine.warmup` field.
- Expose `incrementKg` in the routine editor, converted to the selected display unit.
- Remove “Operazione Rientro” from public templates and the production bundle. Existing copied routines remain untouched.
- Offer neutral optional templates; initially Full Body and Push/Pull/Legs are sufficient.
- Remove the global curated-first exercise sort. Alphabetical search is neutral; later personalization may use the current user's actual history.

## Tracking and warm-up sets

Each routine exercise has a tracking type:

- `weight_reps` (legacy default);
- `reps`;
- `duration`.

Completed set records retain their tracking type so history remains truthful if the routine later changes.

Warm-up sets are explicit optional targets stored on the routine exercise. When a workout begins they become ordinary active rows marked `W`. Users can edit or toggle a row's warm-up status during the session. Warm-up rows are saved in history but excluded from volume, PRs, prior working-set prefills, and routine set-count updates.

## Note model and migration

### Durable technique

Extend `ExerciseNote` with an optional `technique` string. The existing dated `entries` remain for imported/legacy observations.

On reload, migrate routine exercise notes conservatively:

- collect non-empty legacy `RoutineExercise.note` strings by exercise;
- if no Technique exists, deduplicate and join those strings into Technique;
- do not delete the legacy routine fields;
- new UI reads and edits Technique only.

Technique can be changed from Routine Editor, Exercise Detail, and Active Workout. All three write the same exercise record.

### This session

Add optional `sessionNote` to each active exercise. Persist it inside local active-session recovery after every edit. On finish, save non-empty notes in `Workout.exerciseNotes` as `{ exerciseId, text }` entries.

This prevents same-day collisions because the note belongs to a workout ID and exercise, not a date key.

### Journal

Exercise Detail builds one reverse-chronological journal from:

- workout-linked `exerciseNotes` with session date and workout ID;
- legacy/imported dated `ExerciseNote.entries`.

Workout Detail displays each exercise's session note beside its sets. Existing `Workout.note` remains visible for imported data but is not another primary note control.

## Units

Store all weight in kilograms. Add `Settings.unit` with `kg` and `lb`. A single helper converts display/input values and labels in Workout, Routine Editor, Home, History, Summary, Workout Detail, Progress, Profile, and body weight. CSV keeps its explicit canonical `weight_kg` column.

## Complete backup and account safety

Introduce backup version 2 containing workouts, routines, folders, exercise notes, measurements, nutrition, custom exercises, and settings. Import accepts both version 1 and version 2. A version 1 import keeps absent collections unchanged; version 2 restores included records without duplicating workout IDs.

Before a different authenticated UID starts syncing, clear every Dexie table, active session, rest state, and corresponding in-memory collection. Never upload the previous account's local data to the new account.

## Active workout layout

### Sticky header

- minimize button;
- routine name and elapsed time;
- visible Finish button with 48px minimum target.

The destructive abandon action moves to an overflow/bottom action and keeps confirmation. Finish remains keyboard-reachable before the long set list.

### Routine preparation

Preparation is collapsed to a quiet disclosure after first review. It is readable during training and editable only from Routine Editor, where scope is unambiguous.

### Exercise section

- exercise name is the single route to detail/video/instructions;
- one quiet target/progression line;
- separate labeled `Technique` and `This session` disclosures;
- Technique shows durable content and an edit action;
- This session shows the most recent prior session observation as context and edits only the active workout field;
- no duplicate technique chip and no mixed information/action chip row.

### Set grid

`SET | PREVIOUS | KG/LB | REPS | DONE` for weighted work. Repetition-only and duration tracking remove irrelevant columns. Controls are at least 48px tall, numeric text is tabular, values select on focus, and rows never overflow at 320px.

## Visual system

Preserve graphite/volt, Archivo, JetBrains Mono, dark-first behavior, and system light mode. Recalibrate rather than rebrand.

- spacing: 4, 8, 12, 16, 24, 32, 40;
- type: 12 metadata, 14 secondary, 16 body/control, 20 section, 28 page, 36 summary;
- control minimum: 48px; icon-only target: 44px minimum, 48px for primary workout controls;
- radii: 12px controls, 16px surfaces, pill only for true binary filters/status;
- cards only for meaningful modules or exercise boundaries; lists use grouping and spacing;
- one accent, no decorative navigation dot, no glow, no glass-card stack, no tiny uppercase decoration;
- animations only for screen/state entry, set completion, rest-bar entry, and toast feedback; all reduced-motion safe.

## Accessibility and interaction contract

- wrap routed content in `main`, add a skip link, and use page/header landmarks;
- visible WCAG 2.2 AA focus, body text contrast, light-mode semantic contrast, and focus not obscured by sticky/fixed UI;
- toast uses `role="status"`/`aria-live="polite"`;
- one shared bottom-sheet/dialog primitive provides initial focus, Tab containment, Escape, scrim dismissal where safe, and trigger focus restoration;
- every form has a persistent label; placeholder is example/help only;
- all horizontal filter strips remain keyboard reachable and expose selected state;
- disabled states use more than opacity;
- safe-area padding is maintained in navigation, rest, workout header, and sheets.

## Performance contract

- lazy-load non-initial route modules;
- load the 1MB exercise catalog only when a visible screen needs names/search, with idle prefetch after the first useful paint;
- preserve route and active-session recovery while modules load;
- avoid new runtime dependencies and animation libraries;
- target no single application chunk above Vite's 500KB warning threshold and verify production request/transfer behavior.

## Copy contract

- neutral product voice in Italian and English;
- no support copy that speaks as a personal developer;
- no bulk/surplus assumption, fixed meals, personal warm-up, personal start weight, or comeback phase;
- note labels always state their scope;
- “complete backup” is used only after version 2 includes every local collection;
- review every visible string in both languages before deploy.

## State matrix

Every screen must be checked in relevant states:

- new account/no routines/no history;
- routines but no history;
- active/resumed workout, active rest, offline and pending sync;
- empty/loading/no-result library;
- exercise with/without media, Technique, session journal, and imported notes;
- progress/body/nutrition with zero, one, and many records;
- import valid, duplicate, invalid, busy, and completed;
- destructive confirmation, disabled action, error, success, keyboard focus, and reduced motion;
- Italian/English, dark/light, 320px/390px/mobile landscape/desktop.

## Verification and cutover

- unit tests cover progression without global phases, units, tracking types, warm-up exclusion, note migration, same-day session notes, full backup versions, and account clearing;
- component/e2e tests cover Home next action, routine preparation editing, active workout input, sticky Finish, notes, history/detail, dialogs, import/export, and both languages;
- all existing data remains readable and all current intended behavior stays covered;
- two bounded visual QA rounds compare every route in mobile dark/light and representative desktop;
- accessibility review follows the current Vercel Web Interface Guidelines plus automated checks where available;
- production deploy is followed by authenticated/public smoke checks and repository/branch reconciliation.
