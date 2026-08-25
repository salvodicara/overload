# Pattern benchmark decisions

The sources and competitor tiers are recorded in `2026-08-25-competitive-scope.md`. This document turns that evidence into product decisions for Overload.

## Home

Adopt the hierarchy of StrengthLog and StrongLifts, not their total feature surface:

1. resume an active workout;
2. show one credible next routine with a primary start action;
3. summarize the current week;
4. show the latest three workouts and a path to full history;
5. show no feed, challenge, news, public program, or engagement widget.

The next routine is derived from the user's own completed routine sequence. It is a suggestion, never an enforced schedule.

## Active workout

Adopt the convergent Hevy/Strong pattern:

- sticky header with minimize, elapsed time, and Finish;
- per-set columns for set, previous, current value(s), and completion;
- one tap completes a set and starts its rest timer;
- previous values come from the most recent matching exercise and remain visible;
- routine targets and progression guidance are subordinate context, not chips competing with data entry;
- add/remove series and exercise settings remain reachable without a trip to another screen.

## Notes

Expose exactly two note scopes:

- **Technique:** one durable note per exercise. It belongs to the exercise rather than a routine and can be edited from routine editing, exercise detail, or the live workout.
- **This session:** one observation for an exercise inside one workout. It is persisted on the completed workout, appears in workout detail, and becomes part of the exercise journal.

Existing routine notes migrate into Technique without erasing legacy fields. Imported dated Hevy entries stay in the journal as legacy observations. A workout-level imported note can remain readable in workout detail but is not promoted as a third live-workout note action.

## Warm-up and routine ownership

Use two optional, user-owned levels:

- a free-text preparation field on the routine;
- explicit warm-up set rows marked `W`, with editable load/repetitions and exclusion from working volume, progression, and PRs.

Do not add a percentage generator in this redesign. A future generator may only create ordinary editable `W` rows.

Every adopted template becomes an independent copy. Name, order, preparation, exercises, set targets, warm-up sets, rest, increment, technique, and tracking type remain editable.

## General tracking

Support the smallest useful tracking set:

- weight plus repetitions;
- repetitions only;
- duration.

The routine exercise stores the choice so Plank does not need a note saying “seconds.” Existing records default to weight plus repetitions. Weight remains canonical in kilograms in storage; users may display and enter kg or lb without migrating history.

## History and progress

Keep FitNotes' information discipline with a smaller surface:

- separate dashboard from full chronological history;
- session detail includes warm-up/working sets and per-exercise session notes;
- exercise detail combines instructions, durable Technique, recent performance, journal, and one main progress path;
- preserve the existing Progress destination for deeper charts, body measurements, and optional calorie/protein logging;
- remove fixed meal advice and goal assumptions.

## Data ownership

The JSON backup must include every local collection and remain backward-compatible with version 1. CSV remains a human-readable workout/set export. Account changes must clear every local collection before another user's sync starts.

## Patterns explicitly rejected

- Hevy's social Home and Discover surfaces;
- StrengthLog's challenges, news, and infinitely configurable dashboard;
- Fitbod's opaque workout generation and mixed note semantics;
- StrongLifts' non-editable generated warm-ups and program-specific rigidity;
- JEFIT's community and feature density;
- set-level comments, RPE/RIR, supersets, scheduling, and AI coaching in this redesign.
